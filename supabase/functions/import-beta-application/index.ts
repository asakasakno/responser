import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-beta-import-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toArray(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string")
    return v.split(/[,\n;|]/).map((s) => s.trim()).filter(Boolean);
  return [];
}

async function processApplication(admin: any, payload: any) {
  const rawEmail = String(payload.email ?? "").trim();
  const email = rawEmail.toLowerCase();
  const business_name = payload.business_name ? String(payload.business_name).trim() : null;
  const industry = payload.industry ? String(payload.industry).trim() : null;
  const platforms = toArray(payload.platforms);
  const needed_features = toArray(payload.needed_features);
  const pain_point = payload.pain_point ? String(payload.pain_point).trim().slice(0, 4000) : null;
  const consent = payload.consent === true || payload.consent === "true" || payload.consent === "Y" || payload.consent === "동의" || payload.consent === "동의함";

  if (!email || !EMAIL_RE.test(email)) {
    // Still log as failed
    await admin.from("beta_applications").insert({
      email: rawEmail || "(empty)",
      business_name, industry, platforms, needed_features, pain_point, consent,
      raw_payload: payload, status: "failed", error_message: "invalid_email",
    });
    await admin.from("audit_logs").insert({
      action: "beta_pro_failed", severity: "warning",
      details: { email: rawEmail, reason: "invalid_email" },
    });
    return { ok: false, status: "failed", reason: "invalid_email" };
  }

  // Duplicate check (active = pending|applied)
  const { data: existing } = await admin
    .from("beta_applications")
    .select("id, status")
    .ilike("email", email)
    .in("status", ["pending", "applied"])
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { data: dupRow } = await admin.from("beta_applications").insert({
      email, business_name, industry, platforms, needed_features, pain_point, consent,
      raw_payload: payload, status: "duplicate",
      error_message: `previous_id=${existing.id} status=${existing.status}`,
    }).select("id").single();
    await admin.from("audit_logs").insert({
      action: "beta_pro_duplicate", severity: "info",
      details: { email, previous_id: existing.id, application_id: dupRow?.id },
    });
    return { ok: true, status: "duplicate", application_id: dupRow?.id };
  }

  // Find user via auth.admin.listUsers (paginate via email filter is not supported; use direct REST)
  // Use auth.admin.getUserByEmail-ish via filter
  let matchedUserId: string | null = null;
  try {
    // Try profiles first (cheaper)
    const { data: prof } = await admin
      .from("profiles")
      .select("user_id, email")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    if (prof?.user_id) matchedUserId = prof.user_id;
  } catch (_) { /* ignore */ }

  if (!matchedUserId) {
    // Fallback: scan auth.users via admin API
    try {
      let page = 1;
      while (page < 20 && !matchedUserId) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error || !data?.users?.length) break;
        const hit = data.users.find((u: any) => (u.email ?? "").toLowerCase() === email);
        if (hit) { matchedUserId = hit.id; break; }
        if (data.users.length < 200) break;
        page++;
      }
    } catch (_) { /* ignore */ }
  }

  if (!matchedUserId) {
    const { data: row } = await admin.from("beta_applications").insert({
      email, business_name, industry, platforms, needed_features, pain_point, consent,
      raw_payload: payload, status: "not_found",
    }).select("id").single();
    await admin.from("audit_logs").insert({
      action: "beta_pro_not_found", severity: "info",
      details: { email, application_id: row?.id },
    });
    return { ok: true, status: "not_found", application_id: row?.id };
  }

  // Check admin role — block auto-apply
  const { data: roleRow } = await admin
    .from("user_roles").select("role").eq("user_id", matchedUserId).eq("role", "admin").maybeSingle();
  if (roleRow) {
    const { data: row } = await admin.from("beta_applications").insert({
      email, business_name, industry, platforms, needed_features, pain_point, consent,
      raw_payload: payload, status: "skipped",
      matched_user_id: matchedUserId, error_message: "admin_account",
    }).select("id").single();
    await admin.from("audit_logs").insert({
      action: "beta_pro_skipped", severity: "warning",
      user_id: matchedUserId,
      details: { email, reason: "admin_account", application_id: row?.id },
    });
    return { ok: true, status: "skipped", reason: "admin_account", application_id: row?.id };
  }

  // Inspect current subscription — protect existing paid pro/basic
  const { data: curSub } = await admin
    .from("subscriptions")
    .select("id, plan, status, is_beta, expires_at")
    .eq("user_id", matchedUserId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isPaid = curSub && (curSub.plan === "pro" || curSub.plan === "basic")
    && curSub.status === "active" && !curSub.is_beta;

  if (isPaid) {
    const { data: row } = await admin.from("beta_applications").insert({
      email, business_name, industry, platforms, needed_features, pain_point, consent,
      raw_payload: payload, status: "skipped",
      matched_user_id: matchedUserId, error_message: `existing_paid_plan:${curSub.plan}`,
    }).select("id").single();
    await admin.from("audit_logs").insert({
      action: "beta_pro_skipped", severity: "info",
      user_id: matchedUserId,
      details: { email, reason: "existing_paid_plan", current_plan: curSub.plan, application_id: row?.id },
    });
    return { ok: true, status: "skipped", reason: "existing_paid_plan", application_id: row?.id };
  }

  // Apply beta_pro: plan=pro + is_beta=true + beta_until=2026-12-31
  const betaUntil = "2026-12-31T23:59:59+09:00";
  const nowIso = new Date().toISOString();

  if (curSub?.id) {
    const { error: updErr } = await admin.from("subscriptions").update({
      plan: "pro", status: "active",
      is_beta: true, beta_until: betaUntil, beta_source: "google_form",
      expires_at: betaUntil, updated_at: nowIso,
    }).eq("id", curSub.id);
    if (updErr) {
      const { data: row } = await admin.from("beta_applications").insert({
        email, business_name, industry, platforms, needed_features, pain_point, consent,
        raw_payload: payload, status: "failed",
        matched_user_id: matchedUserId, error_message: updErr.message,
      }).select("id").single();
      return { ok: false, status: "failed", reason: updErr.message, application_id: row?.id };
    }
  } else {
    const { error: insErr } = await admin.from("subscriptions").insert({
      user_id: matchedUserId, plan: "pro", status: "active",
      billing_cycle: "monthly",
      is_beta: true, beta_until: betaUntil, beta_source: "google_form",
      expires_at: betaUntil,
    });
    if (insErr) {
      const { data: row } = await admin.from("beta_applications").insert({
        email, business_name, industry, platforms, needed_features, pain_point, consent,
        raw_payload: payload, status: "failed",
        matched_user_id: matchedUserId, error_message: insErr.message,
      }).select("id").single();
      return { ok: false, status: "failed", reason: insErr.message, application_id: row?.id };
    }
  }

  // Bump max_energy to pro (DB triggers may already do this, but be explicit)
  await admin.from("profiles").update({ max_energy: 2000, updated_at: nowIso })
    .eq("user_id", matchedUserId);

  const { data: row } = await admin.from("beta_applications").insert({
    email, business_name, industry, platforms, needed_features, pain_point, consent,
    raw_payload: payload, status: "applied",
    matched_user_id: matchedUserId, applied_at: nowIso,
  }).select("id").single();

  await admin.from("audit_logs").insert({
    action: "beta_pro_auto_applied", severity: "info",
    user_id: matchedUserId,
    details: {
      email, source: "google_form", application_id: row?.id,
      beta_until: betaUntil, business_name, industry, platforms,
    },
  });

  return { ok: true, status: "applied", application_id: row?.id, user_id: matchedUserId, beta_until: betaUntil };
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SECRET = Deno.env.get("BETA_IMPORT_SECRET");
    if (!SECRET) return json({ error: "server_misconfigured" }, 500);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Compute IP hash early so we can log unauthorized attempts without
    // ever persisting the raw IP, UA, or the provided secret value.
    const ipEarly = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    const uaEarly = req.headers.get("user-agent") ?? "";
    const ipHash = (await sha256Hex(`${ipEarly}|${uaEarly}`)).slice(0, 32);

    // Header-only auth. Query-string fallback removed to prevent secret
    // exposure in CDN / proxy / edge access logs.
    const provided = req.headers.get("x-beta-import-secret");
    if (!provided || provided !== SECRET) {
      // Log the failed attempt WITHOUT the provided secret value.
      // Only metadata: ip_hash, presence flag, and length bucket.
      try {
        await admin.rpc("log_rate_limit_attempt", {
          _action: "beta_import_unauthorized",
          _ip_hash: ipHash,
          _severity: "warning",
          _extra: {
            had_header: !!provided,
            provided_length: provided ? Math.min(provided.length, 256) : 0,
          },
        });
      } catch (_) { /* never block auth response on logging */ }
      return json({ error: "unauthorized" }, 401);
    }

    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "invalid_json" }, 400);

    // IP-based rate limit (in addition to the secret). 10분 / 5회.
    // ipHash was already computed above for the unauthorized-attempt log.

    const { data: rl } = await admin.rpc("check_ip_rate_limit", {
      _action: "beta_import_request",
      _ip_hash: ipHash,
      _max_per_window: 5,
      _window_seconds: 600,
    });

    if (rl && rl.allowed === false) {
      await admin.rpc("log_rate_limit_attempt", {
        _action: "beta_import_rate_limited",
        _ip_hash: ipHash,
        _severity: "warning",
        _extra: { count: rl.count, limit: rl.limit },
      });
      return json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, 429);
    }

    // Log a fresh attempt so future calls count it.
    await admin.rpc("log_rate_limit_attempt", {
      _action: "beta_import_request",
      _ip_hash: ipHash,
      _severity: "info",
    });

    // Support batch (rows: [...]) or single object
    const rows: any[] = Array.isArray(body?.rows) ? body.rows
      : Array.isArray(body) ? body : [body];

    const results: any[] = [];
    for (const r of rows) {
      try {
        results.push(await processApplication(admin, r));
      } catch (e: any) {
        console.error("[import-beta-application] row error", e);
        results.push({ ok: false, status: "failed", reason: "internal_error" });
      }
    }

    return json({ ok: true, count: results.length, results });
  } catch (e: any) {
    console.error("[import-beta-application]", e);
    return json({ error: "internal_error" }, 500);
  }
});
