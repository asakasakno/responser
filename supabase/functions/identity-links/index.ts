// Manage user-initiated social identity linking/unlinking.
// Actions (POST JSON):
//   { action: 'list' }                 -> active links for current user
//   { action: 'start_kakao_link' }     -> { url } to redirect for Kakao linking
//   { action: 'unlink', provider }     -> deactivate provider link (blocks last method)
//   { action: 'sync_google' }          -> sync google identity from auth.users.identities

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { buildCorsHeaders, isOriginAllowed } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const KAKAO_CLIENT_SECRET = Deno.env.get("KAKAO_CLIENT_SECRET")!;

function json(data: any, headers: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

// Sign payload using HMAC-SHA256 so kakao-auth callback can trust state.link_user_id
async function signPayload(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(KAKAO_CLIENT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = buildCorsHeaders(origin);

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (origin && !isOriginAllowed(origin)) {
    return json({ error: "허용되지 않은 Origin입니다." }, cors, 403);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "인증이 필요합니다." }, cors, 401);
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return json({ error: "인증이 유효하지 않습니다." }, cors, 401);
    }
    const userId = claimsData.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    const { data: roleData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    const isAdminUser = !!roleData;

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip");

    async function logAudit(act: string, details: any, severity: "info" | "warning" = "info") {
      await admin.from("audit_logs").insert({
        user_id: userId,
        action: act,
        details: { ...details, is_admin_account: isAdminUser },
        severity,
        ip_address: ip,
      });
    }

    // ======== LIST ========
    if (action === "list") {
      const { data, error } = await admin
        .from("user_identity_links")
        .select("provider, provider_email, email_verified, linked_at, is_active")
        .eq("user_id", userId)
        .eq("is_active", true);
      if (error) {
        console.error("identity-links list error", error);
        return json({ error: "처리에 실패했습니다." }, cors, 500);
      }
      return json({ links: data ?? [] }, cors);
    }

    // ======== START KAKAO LINK ========
    if (action === "start_kakao_link") {
      const KAKAO_REST_API_KEY = Deno.env.get("KAKAO_REST_API_KEY")!;
      const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/kakao-auth?action=callback`;

      const siteOrigin =
        origin && isOriginAllowed(origin) ? origin : "https://xn--vk1booh7ruql6wa.com";

      const payload = {
        o: siteOrigin,
        r: "/settings",
        m: "link",
        u: userId,
        n: crypto.randomUUID(),
        t: Date.now(),
      };
      const payloadStr = JSON.stringify(payload);
      const sig = await signPayload(payloadStr);
      const state = btoa(payloadStr).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_") +
        "." + sig;

      const url = new URL("https://kauth.kakao.com/oauth/authorize");
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", KAKAO_REST_API_KEY);
      url.searchParams.set("redirect_uri", REDIRECT_URI);
      url.searchParams.set("state", state);
      url.searchParams.set("scope", "account_email profile_nickname");
      // Force fresh consent so user re-consents to email
      url.searchParams.set("prompt", "login");

      return json({ url: url.toString() }, cors);
    }

    // ======== UNLINK ========
    if (action === "unlink") {
      const provider = body?.provider;
      if (!["email", "google", "kakao"].includes(provider)) {
        return json({ error: "잘못된 provider입니다." }, cors, 400);
      }

      const { data: links } = await admin
        .from("user_identity_links")
        .select("id, provider")
        .eq("user_id", userId)
        .eq("is_active", true);

      const activeCount = links?.length ?? 0;
      const target = links?.find((l) => l.provider === provider);
      if (!target) return json({ error: "연결되지 않은 방식입니다." }, cors, 400);
      if (activeCount <= 1) {
        return json({ error: "마지막 로그인 수단은 해제할 수 없습니다." }, cors, 400);
      }

      const { error: upErr } = await admin
        .from("user_identity_links")
        .update({ is_active: false, unlinked_at: new Date().toISOString() })
        .eq("id", target.id);
      if (upErr) {
        console.error("identity-links unlink error", upErr);
        return json({ error: "처리에 실패했습니다." }, cors, 500);
      }

      // Mirror provider field on profiles if removing the canonical provider
      if (provider === "kakao") {
        await admin.from("profiles")
          .update({ provider_user_id: null })
          .eq("user_id", userId)
          .eq("provider", "kakao");
      }

      await logAudit("identity_link_removed", { provider }, isAdminUser ? "warning" : "info");
      return json({ ok: true }, cors);
    }

    // ======== SYNC GOOGLE (after client linkIdentity) ========
    if (action === "sync_google") {
      const { data: { user: authUser } } = await admin.auth.admin.getUserById(userId);
      const googleIdent = authUser?.identities?.find((i: any) => i.provider === "google");
      if (!googleIdent) {
        return json({ error: "Google 연결이 확인되지 않았습니다." }, cors, 400);
      }
      const gEmail =
        (googleIdent.identity_data as any)?.email?.toLowerCase?.() ?? null;
      const gVerified =
        (googleIdent.identity_data as any)?.email_verified === true;

      // Check this google account isn't linked to another user
      if (googleIdent.id) {
        const { data: collide } = await admin
          .from("user_identity_links")
          .select("user_id")
          .eq("provider", "google")
          .eq("provider_user_id", googleIdent.id)
          .eq("is_active", true)
          .maybeSingle();
        if (collide && collide.user_id !== userId) {
          await logAudit("identity_link_blocked", { provider: "google", reason: "already_linked_to_other_user" }, "warning");
          return json({ error: "이미 다른 계정에 연결된 Google 계정입니다." }, cors, 409);
        }
      }

      // Upsert active link (deactivate any existing, then insert)
      await admin
        .from("user_identity_links")
        .update({ is_active: false, unlinked_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("provider", "google")
        .eq("is_active", true);

      const { error: insErr } = await admin.from("user_identity_links").insert({
        user_id: userId,
        provider: "google",
        provider_user_id: googleIdent.id ?? null,
        provider_email: gEmail,
        email_verified: gVerified,
        is_active: true,
      });
      if (insErr) {
        console.error("identity-links sync_google insert error", insErr);
        return json({ error: "처리에 실패했습니다." }, cors, 500);
      }

      await logAudit("identity_link_added", { provider: "google", provider_email: gEmail }, isAdminUser ? "warning" : "info");
      return json({ ok: true }, cors);
    }

    return json({ error: "알 수 없는 action" }, cors, 400);
  } catch (e: any) {
    console.error("identity-links error", e);
    return json({ error: "처리에 실패했습니다." }, buildCorsHeaders(origin), 500);
  }
});
