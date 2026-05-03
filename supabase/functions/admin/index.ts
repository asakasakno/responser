import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const PROD_ORIGINS = [
  "https://responser.lovable.app",
];
const DEV_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];

const allowedOrigins = new Set([
  ...PROD_ORIGINS,
  ...DEV_ORIGINS,
  ...((Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)),
]);

function buildCorsHeaders(origin: string | null) {
  const isAllowed = !!origin && allowedOrigins.has(origin);
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : PROD_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonResponse(data: any, corsHeaders: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const STEP_UP_WINDOW_MINUTES = Math.min(
  10,
  Math.max(5, Number(Deno.env.get("ADMIN_STEP_UP_WINDOW_MINUTES") ?? 10))
);
const STEP_UP_EXEMPT_ACTIONS = new Set(["step_up_status", "step_up_verify"]);

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = buildCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    if (origin && !allowedOrigins.has(origin)) {
      return new Response("forbidden", { status: 403, headers: corsHeaders });
    }
    return new Response("ok", { headers: corsHeaders });
  }

  if (origin && !allowedOrigins.has(origin)) {
    return jsonResponse({ error: "허용되지 않은 Origin입니다." }, corsHeaders, 403);
  }

  try {
    // [1][3] 서버 인증 - getClaims 기반
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "인증이 필요합니다." }, corsHeaders, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return jsonResponse({ error: "인증이 유효하지 않습니다." }, corsHeaders, 401);
    }
    const userId = claimsData.claims.sub as string | undefined;
    if (!userId) {
      return jsonResponse({ error: "인증이 유효하지 않습니다." }, corsHeaders, 401);
    }

    // [3] 관리자 권한 검증 - DB user_roles 테이블 기반 (프론트 조건문 금지)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      // [10] 비관리자 접근 시도 감사 로그
      await adminClient.from("audit_logs").insert({
        user_id: userId,
        action: "admin_access_denied",
        details: {},
        severity: "warning",
      });
      return jsonResponse({ error: "접근 권한이 없습니다." }, corsHeaders, 403);
    }

    const { action, ...params } = await req.json();
    if (!action || typeof action !== "string") {
      return jsonResponse({ error: "잘못된 요청입니다." }, corsHeaders, 400);
    }

    // Step-up: 관리자 API는 최근 재인증(기본 10분, 최소 5분) 없으면 거부
    if (!STEP_UP_EXEMPT_ACTIONS.has(action)) {
      const sinceIso = new Date(Date.now() - STEP_UP_WINDOW_MINUTES * 60 * 1000).toISOString();
      const { data: recentStepUp } = await adminClient
        .from("audit_logs")
        .select("id, created_at")
        .eq("user_id", userId)
        .eq("action", "admin_stepup_verified")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!recentStepUp) {
        await adminClient.from("audit_logs").insert({
          user_id: userId,
          action: "admin_stepup_required",
          details: { action, window_minutes: STEP_UP_WINDOW_MINUTES },
          severity: "warning",
        });
        return jsonResponse({
          error: "관리자 추가 인증이 필요합니다. 최근 재인증 후 다시 시도해주세요.",
          code: "STEP_UP_REQUIRED",
          step_up_window_minutes: STEP_UP_WINDOW_MINUTES,
        }, corsHeaders, 403);
      }
    }

    // [10] 관리자 액션 감사 로그
    await adminClient.from("audit_logs").insert({
      user_id: userId,
      action: `admin_${action}`,
      details: { params: Object.keys(params) },
      severity: "info",
    });

    switch (action) {
      // ========== STEP-UP STATUS ==========
      case "step_up_status": {
        const sinceIso = new Date(Date.now() - STEP_UP_WINDOW_MINUTES * 60 * 1000).toISOString();
        const { data: recentStepUp } = await adminClient
          .from("audit_logs")
          .select("created_at")
          .eq("user_id", userId)
          .eq("action", "admin_stepup_verified")
          .gte("created_at", sinceIso)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        return jsonResponse({
          verified: !!recentStepUp,
          window_minutes: STEP_UP_WINDOW_MINUTES,
          verified_at: recentStepUp?.created_at ?? null,
        }, corsHeaders);
      }

      // ========== STEP-UP VERIFY ==========
      case "step_up_verify": {
        const { password } = params as { password?: string };
        if (!password || typeof password !== "string" || password.length < 6) {
          return jsonResponse({ error: "비밀번호를 확인해주세요." }, corsHeaders, 400);
        }

        const { data: userData, error: userError } = await userClient.auth.getUser(token);
        const email = userData?.user?.email;
        if (userError || !email) {
          return jsonResponse({ error: "사용자 정보를 확인할 수 없습니다." }, corsHeaders, 401);
        }

        const verifyClient = createClient(supabaseUrl, supabaseAnonKey);
        const { data: signInData, error: signInError } = await verifyClient.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError || signInData.user?.id !== userId) {
          await adminClient.from("audit_logs").insert({
            user_id: userId,
            action: "admin_stepup_failed",
            details: {
              reason: "reauth_failed",
              error_code: typeof signInError?.status === "number" ? signInError.status : null,
            },
            severity: "warning",
          });
          return jsonResponse({ error: "관리자 추가 인증에 실패했습니다." }, corsHeaders, 401);
        }

        // 생성된 재인증 세션 정리
        await verifyClient.auth.signOut();

        await adminClient.from("audit_logs").insert({
          user_id: userId,
          action: "admin_stepup_verified",
          details: { method: "password_reauth", window_minutes: STEP_UP_WINDOW_MINUTES },
          severity: "info",
        });

        return jsonResponse({ success: true, verified: true, window_minutes: STEP_UP_WINDOW_MINUTES }, corsHeaders);
      }

      // ========== LIST USERS ==========
      case "list_users": {
        const { data: profiles } = await adminClient
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false });

        const { data: subscriptions } = await adminClient
          .from("subscriptions")
          .select("*")
          .eq("status", "active");

        const { data: usageData } = await adminClient
          .from("usage")
          .select("user_id, count, date");

        const users = (profiles || []).map((profile: any) => {
          const sub = (subscriptions || []).find((s: any) => s.user_id === profile.user_id);
          const userUsage = (usageData || []).filter((u: any) => u.user_id === profile.user_id);
          const todayUsage = userUsage.find((u: any) => u.date === new Date().toISOString().split("T")[0]);
          const totalUsage = userUsage.reduce((sum: number, u: any) => sum + u.count, 0);
          return {
            ...profile,
            platforms: profile.platforms || [],
            plan: sub?.plan || "free",
            payment_enabled: sub?.payment_enabled ?? true,
            subscription_id: sub?.id,
            today_usage: todayUsage?.count || 0,
            total_usage: totalUsage,
          };
        });

        return jsonResponse({ users, usage_all: usageData || [] }, corsHeaders);
      }

      // ========== CHANGE PLAN ==========
      case "change_plan": {
        const { user_id, plan } = params;
        if (!user_id || !plan) return jsonResponse({ error: "필수 항목이 누락되었습니다." }, corsHeaders, 400);
        if (!["free", "basic", "pro"].includes(plan)) return jsonResponse({ error: "잘못된 요청입니다." }, corsHeaders, 400);

        const PLAN_MAX: Record<string, number> = { free: 100, basic: 500, pro: 2000 };
        const expectedMax = PLAN_MAX[plan];

        // 변경 전 상태 스냅샷 — 가장 최근 구독 (status 무관, 관리자 오버라이드)
        const { data: beforeSub } = await adminClient
          .from("subscriptions")
          .select("id, plan, status")
          .eq("user_id", user_id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const { data: beforeProfile } = await adminClient
          .from("profiles")
          .select("max_energy, energy_balance")
          .eq("user_id", user_id)
          .maybeSingle();

        if (!beforeSub?.id) {
          return jsonResponse({ error: "구독 정보를 찾을 수 없습니다." }, corsHeaders, 404);
        }

        // 관리자가 플랜을 변경하면 status도 active로 복구 (해지 상태였더라도)
        const { error } = await adminClient
          .from("subscriptions")
          .update({ plan, status: "active", updated_at: new Date().toISOString() })
          .eq("id", beforeSub.id);

        if (error) {
          console.error("[change_plan update error]", error);
          return jsonResponse({ error: "처리에 실패했습니다." }, corsHeaders, 500);
        }

        // DB 트리거가 동기화하지만, 안전장치로 명시적으로도 동기화
        await adminClient
          .from("profiles")
          .update({ max_energy: expectedMax, updated_at: new Date().toISOString() })
          .eq("user_id", user_id);

        // ============ 정합성 검증 ============
        const { data: afterSub, error: afterSubErr } = await adminClient
          .from("subscriptions")
          .select("id, plan, status")
          .eq("id", beforeSub.id)
          .maybeSingle();
        if (afterSubErr) {
          console.error("[change_plan afterSub query error]", afterSubErr);
        }
        const { data: afterProfile } = await adminClient
          .from("profiles")
          .select("max_energy, energy_balance")
          .eq("user_id", user_id)
          .maybeSingle();

        const afterPlan = afterSub?.plan ? String(afterSub.plan) : undefined;
        const mismatches: string[] = [];
        if (afterPlan !== plan) {
          mismatches.push(`subscriptions.plan=${afterPlan} (expected ${plan})`);
        }
        if (afterProfile?.max_energy !== expectedMax) {
          mismatches.push(`profiles.max_energy=${afterProfile?.max_energy} (expected ${expectedMax})`);
        }
        if ((afterProfile?.energy_balance ?? 0) > expectedMax) {
          mismatches.push(`energy_balance=${afterProfile?.energy_balance} > max_energy=${expectedMax}`);
        }

        const consistent = mismatches.length === 0;

        await adminClient.from("audit_logs").insert({
          user_id: userId,
          action: consistent ? "plan_change_verified" : "plan_change_mismatch",
          severity: consistent ? "info" : "error",
          details: {
            target_user_id: user_id,
            before: { plan: beforeSub?.plan, max_energy: beforeProfile?.max_energy, energy_balance: beforeProfile?.energy_balance },
            after: { plan: afterSub?.plan, max_energy: afterProfile?.max_energy, energy_balance: afterProfile?.energy_balance },
            expected: { plan, max_energy: expectedMax },
            mismatches,
          },
        });

        if (!consistent) {
          console.error("[change_plan mismatch]", { user_id, mismatches });
          // 검증은 실패했지만 update 자체는 성공했으므로 경고만 반환
          return jsonResponse({
            success: true,
            verified: false,
            warning: "플랜 변경은 적용되었으나 정합성 검증에 실패했습니다.",
            mismatches,
          }, corsHeaders);
        }

        return jsonResponse({ success: true, verified: true }, corsHeaders);
      }

      // ========== VERIFY PLAN CONSISTENCY (전 사용자 검증) ==========
      case "verify_plan_consistency": {
        const PLAN_MAX: Record<string, number> = { free: 100, basic: 500, pro: 2000 };

        const { data: profiles } = await adminClient
          .from("profiles")
          .select("user_id, email, max_energy, energy_balance");
        const { data: subs } = await adminClient
          .from("subscriptions")
          .select("user_id, plan")
          .eq("status", "active");

        const subMap = new Map((subs || []).map((s: any) => [s.user_id, s.plan]));
        const issues: any[] = [];

        for (const p of profiles || []) {
          const plan = subMap.get(p.user_id) || "free";
          const expectedMax = PLAN_MAX[plan];
          const problems: string[] = [];
          if (p.max_energy !== expectedMax) {
            problems.push(`max_energy=${p.max_energy}, expected=${expectedMax}`);
          }
          if (p.energy_balance > p.max_energy) {
            problems.push(`balance(${p.energy_balance}) > max(${p.max_energy})`);
          }
          if (problems.length) {
            issues.push({
              user_id: p.user_id,
              email: p.email,
              plan,
              max_energy: p.max_energy,
              energy_balance: p.energy_balance,
              expected_max: expectedMax,
              problems,
            });
          }
        }

        await adminClient.from("audit_logs").insert({
          user_id: userId,
          action: "verify_plan_consistency",
          severity: issues.length ? "warning" : "info",
          details: { total_checked: profiles?.length || 0, issue_count: issues.length },
        });

        return jsonResponse({
          success: true,
          total_checked: profiles?.length || 0,
          issue_count: issues.length,
          issues,
        }, corsHeaders);
      }

      // ========== TOGGLE PAYMENT ==========
      case "toggle_payment": {
        const { user_id, payment_enabled } = params;
        if (!user_id || payment_enabled === undefined) return jsonResponse({ error: "필수 항목이 누락되었습니다." }, corsHeaders, 400);

        const { error } = await adminClient
          .from("subscriptions")
          .update({ payment_enabled, updated_at: new Date().toISOString() })
          .eq("user_id", user_id)
          .eq("status", "active");

        if (error) return jsonResponse({ error: "처리에 실패했습니다." }, corsHeaders, 500);
        return jsonResponse({ success: true }, corsHeaders);
      }

      // ========== TOGGLE SUSPEND ==========
      case "toggle_suspend": {
        const { user_id, suspended } = params;
        if (!user_id || suspended === undefined) return jsonResponse({ error: "필수 항목이 누락되었습니다." }, corsHeaders, 400);

        const { error } = await adminClient
          .from("profiles")
          .update({ suspended, updated_at: new Date().toISOString() })
          .eq("user_id", user_id);

        if (error) return jsonResponse({ error: "처리에 실패했습니다." }, corsHeaders, 500);
        return jsonResponse({ success: true }, corsHeaders);
      }

      // ========== ADMIN ENERGY ADJUST ==========
      case "adjust_energy": {
        const { user_id, amount, reason, type } = params;
        if (!user_id || !amount || !reason || !type) return jsonResponse({ error: "필수 항목이 누락되었습니다." }, corsHeaders, 400);

        if (type === "earn") {
          const { data, error } = await adminClient.rpc("earn_energy", {
            _user_id: user_id,
            _amount: Math.abs(amount),
            _reason: reason,
            _description: `관리자 수동 지급: ${reason}`,
            _source: "admin",
            _expire_days: null,
          });
          if (error) return jsonResponse({ error: "처리에 실패했습니다." }, corsHeaders, 500);
          return jsonResponse({ success: true, ...data }, corsHeaders);
        } else {
          const absAmount = Math.abs(amount);
          const { data, error } = await adminClient.rpc("admin_spend_energy", {
            _user_id: user_id,
            _amount: absAmount,
            _reason: reason,
            _description: `관리자 수동 차감: ${reason}`,
          });
          if (error) {
            console.error("admin_spend_energy error", error);
            return jsonResponse({ error: "처리에 실패했습니다." }, corsHeaders, 500);
          }
          if (data && (data as any).success === false) {
            return jsonResponse({ error: (data as any).error || "에너지가 부족합니다." }, corsHeaders, 400);
          }
          return jsonResponse({ success: true, ...(data as any) }, corsHeaders);
        }
      }

      // ========== DASHBOARD STATS ==========
      case "dashboard_stats": {
        const { data: profiles } = await adminClient.from("profiles").select("user_id, energy_balance, created_at");
        const { data: subscriptions } = await adminClient.from("subscriptions").select("user_id, plan, status").eq("status", "active");
        const { data: usageData } = await adminClient.from("usage").select("user_id, count, date");
        const { data: payments } = await adminClient.from("payments").select("amount, status, created_at");
        const { data: generations } = await adminClient.from("generations").select("id, created_at");

        const totalUsers = (profiles || []).length;
        const paidUsers = (subscriptions || []).filter((s: any) => s.plan !== "free").length;

        const today = new Date().toISOString().split("T")[0];
        const thisMonth = today.substring(0, 7);

        const successPayments = (payments || []).filter((p: any) => p.status === "success");
        const todayRevenue = successPayments
          .filter((p: any) => p.created_at.startsWith(today))
          .reduce((sum: number, p: any) => sum + p.amount, 0);
        const monthRevenue = successPayments
          .filter((p: any) => p.created_at.startsWith(thisMonth))
          .reduce((sum: number, p: any) => sum + p.amount, 0);
        const totalRevenue = successPayments.reduce((sum: number, p: any) => sum + p.amount, 0);

        const totalGenerations = (generations || []).length;
        const totalUsageCount = (usageData || []).reduce((sum: number, u: any) => sum + u.count, 0);
        const avgUsage = totalUsers > 0 ? Math.round(totalUsageCount / totalUsers) : 0;

        const dailyUsageMap = new Map<string, number>();
        (usageData || []).forEach((u: any) => {
          dailyUsageMap.set(u.date, (dailyUsageMap.get(u.date) || 0) + u.count);
        });
        const dailyUsage = Array.from(dailyUsageMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-30)
          .map(([date, count]) => ({ date, count }));

        const dailyRevenueMap = new Map<string, number>();
        successPayments.forEach((p: any) => {
          const d = p.created_at.split("T")[0];
          dailyRevenueMap.set(d, (dailyRevenueMap.get(d) || 0) + p.amount);
        });
        const dailyRevenue = Array.from(dailyRevenueMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-30)
          .map(([date, amount]) => ({ date, amount }));

        return jsonResponse({
          totalUsers, paidUsers, todayRevenue, monthRevenue, totalRevenue,
          totalGenerations, avgUsage, dailyUsage, dailyRevenue,
        }, corsHeaders);
      }

      // ========== ENERGY STATS ==========
      case "energy_stats": {
        const { data: transactions } = await adminClient
          .from("energy_transactions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500);

        const { data: profiles } = await adminClient.from("profiles").select("energy_balance");

        const totalEarned = (transactions || []).filter((t: any) => t.type === "earn").reduce((s: number, t: any) => s + t.amount, 0);
        const totalSpent = (transactions || []).filter((t: any) => t.type === "spend").reduce((s: number, t: any) => s + t.amount, 0);
        const avgBalance = (profiles || []).length > 0
          ? Math.round((profiles || []).reduce((s: number, p: any) => s + p.energy_balance, 0) / (profiles || []).length)
          : 0;

        return jsonResponse({ totalEarned, totalSpent, avgBalance, transactions: transactions || [] }, corsHeaders);
      }

      // ========== PAYMENT STATS ==========
      case "payment_stats": {
        const { data: payments } = await adminClient
          .from("payments")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500);

        const { data: profiles } = await adminClient.from("profiles").select("user_id, email");
        const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p.email]));

        const today = new Date().toISOString().split("T")[0];
        const thisMonth = today.substring(0, 7);

        const allPayments = payments || [];
        const successPayments = allPayments.filter((p: any) => p.status === "success");
        const todayRevenue = successPayments.filter((p: any) => p.created_at.startsWith(today)).reduce((s: number, p: any) => s + p.amount, 0);
        const monthRevenue = successPayments.filter((p: any) => p.created_at.startsWith(thisMonth)).reduce((s: number, p: any) => s + p.amount, 0);
        const totalRevenue = successPayments.reduce((s: number, p: any) => s + p.amount, 0);
        const successRate = allPayments.length > 0 ? Math.round((successPayments.length / allPayments.length) * 100) : 0;

        const paymentsWithEmail = allPayments.map((p: any) => ({
          ...p,
          email: profileMap.get(p.user_id) || "알 수 없음",
        }));

        return jsonResponse({ todayRevenue, monthRevenue, totalRevenue, successRate, payments: paymentsWithEmail }, corsHeaders);
      }

      // ========== UPDATE PAYMENT STATUS ==========
      case "update_payment_status": {
        const { payment_id, status } = params;
        if (!payment_id || !status) return jsonResponse({ error: "필수 항목이 누락되었습니다." }, corsHeaders, 400);

        const { error } = await adminClient
          .from("payments")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("id", payment_id);

        if (error) return jsonResponse({ error: "처리에 실패했습니다." }, corsHeaders, 500);
        return jsonResponse({ success: true }, corsHeaders);
      }

      // ========== AI USAGE STATS ==========
      case "ai_usage_stats": {
        const { data: usageData } = await adminClient.from("usage").select("user_id, count, date");
        const { data: profiles } = await adminClient.from("profiles").select("user_id, email");
        const { data: generations } = await adminClient.from("generations").select("user_id, created_at");

        const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p.email]));
        const today = new Date().toISOString().split("T")[0];

        const todayTotal = (usageData || [])
          .filter((u: any) => u.date === today)
          .reduce((s: number, u: any) => s + u.count, 0);

        const userStatsMap = new Map<string, { todayCount: number; totalCount: number; lastUsed: string }>();
        (usageData || []).forEach((u: any) => {
          const existing = userStatsMap.get(u.user_id) || { todayCount: 0, totalCount: 0, lastUsed: "" };
          existing.totalCount += u.count;
          if (u.date === today) existing.todayCount += u.count;
          if (u.date > existing.lastUsed) existing.lastUsed = u.date;
          userStatsMap.set(u.user_id, existing);
        });

        const userStats = Array.from(userStatsMap.entries()).map(([uid, stats]) => ({
          user_id: uid,
          email: profileMap.get(uid) || "알 수 없음",
          ...stats,
        }));

        return jsonResponse({ todayTotal, totalGenerations: (generations || []).length, userStats }, corsHeaders);
      }

      // ========== CONVERSION STATS ==========
      case "conversion_stats": {
        const { data: profiles } = await adminClient.from("profiles").select("user_id, created_at");
        const { data: subscriptions } = await adminClient.from("subscriptions").select("user_id, plan, status").eq("status", "active");
        const { data: generations } = await adminClient.from("generations").select("user_id, created_at");
        const { data: usageData } = await adminClient.from("usage").select("user_id, count, date");

        const totalUsers = (profiles || []).length;
        const usersWithGen = new Set((generations || []).map((g: any) => g.user_id));
        const firstUseConversion = totalUsers > 0 ? Math.round((usersWithGen.size / totalUsers) * 100) : 0;

        const paidUsers = new Set((subscriptions || []).filter((s: any) => s.plan !== "free").map((s: any) => s.user_id));
        const firstUseToPaid = usersWithGen.size > 0 ? Math.round((paidUsers.size / usersWithGen.size) * 100) : 0;
        const freeToPaid = totalUsers > 0 ? Math.round((paidUsers.size / totalUsers) * 100) : 0;

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const eligibleUsers = (profiles || []).filter((p: any) => p.created_at.split("T")[0] <= sevenDaysAgo);
        const recentUsers = new Set(
          (usageData || []).filter((u: any) => u.date >= sevenDaysAgo).map((u: any) => u.user_id)
        );
        const retainedCount = eligibleUsers.filter((p: any) => recentUsers.has(p.user_id)).length;
        const retention7d = eligibleUsers.length > 0 ? Math.round((retainedCount / eligibleUsers.length) * 100) : 0;

        return jsonResponse({
          totalUsers, usersWithFirstUse: usersWithGen.size, paidUsers: paidUsers.size,
          firstUseConversion, firstUseToPaid, freeToPaid, retention7d,
        }, corsHeaders);
      }

      // ========== ALERTS / ABUSE DETECTION ==========
      case "alerts": {
        const { data: usageData } = await adminClient.from("usage").select("user_id, count, date");
        const { data: profiles } = await adminClient.from("profiles").select("user_id, email, energy_balance");
        const { data: payments } = await adminClient.from("payments").select("user_id, status, created_at");
        const { data: energyTx } = await adminClient
          .from("energy_transactions")
          .select("user_id, type, amount, created_at")
          .eq("type", "earn")
          .order("created_at", { ascending: false })
          .limit(200);

        const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p.email]));
        const alerts: any[] = [];
        const today = new Date().toISOString().split("T")[0];

        (usageData || []).forEach((u: any) => {
          if (u.date === today && u.count >= 100) {
            alerts.push({
              type: "high_usage", severity: "warning",
              message: `하루 ${u.count}회 사용`,
              email: profileMap.get(u.user_id) || "알 수 없음",
              user_id: u.user_id, date: today,
            });
          }
        });

        const dailyEarnings = new Map<string, number>();
        (energyTx || []).forEach((t: any) => {
          const key = `${t.user_id}|${t.created_at.split("T")[0]}`;
          dailyEarnings.set(key, (dailyEarnings.get(key) || 0) + t.amount);
        });
        dailyEarnings.forEach((amount, key) => {
          if (amount >= 500) {
            const [uid] = key.split("|");
            alerts.push({
              type: "abnormal_energy", severity: "critical",
              message: `비정상적 에너지 증가: +${amount}`,
              email: profileMap.get(uid) || "알 수 없음",
              user_id: uid, date: key.split("|")[1],
            });
          }
        });

        const failureCount = new Map<string, number>();
        (payments || []).filter((p: any) => p.status === "failed").forEach((p: any) => {
          failureCount.set(p.user_id, (failureCount.get(p.user_id) || 0) + 1);
        });
        failureCount.forEach((count, uid) => {
          if (count >= 3) {
            alerts.push({
              type: "payment_failure", severity: "warning",
              message: `결제 실패 ${count}회 반복`,
              email: profileMap.get(uid) || "알 수 없음",
              user_id: uid, date: today,
            });
          }
        });

        return jsonResponse({ alerts }, corsHeaders);
      }

      // ========== FORCE LOGOUT ==========
      case "force_logout": {
        const { user_id } = params;
        if (!user_id) return jsonResponse({ error: "필수 항목이 누락되었습니다." }, corsHeaders, 400);

        const { error } = await adminClient.auth.admin.signOut(user_id);
        if (error) return jsonResponse({ error: "처리에 실패했습니다." }, corsHeaders, 500);
        return jsonResponse({ success: true }, corsHeaders);
      }

      default:
        return jsonResponse({ error: "잘못된 요청입니다." }, corsHeaders, 400);
    }
  } catch (err) {
    // [9] 에러 메시지 최소화 - stack trace 노출 금지
    console.error("Admin function error:", err);
    return jsonResponse({ error: "요청을 처리할 수 없습니다." }, corsHeaders, 500);
  }
});
