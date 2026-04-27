import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_REASONS = new Set([
  "price",          // 가격 부담
  "missing_features", // 기능 부족
  "tech_issue",     // 기술 문제
  "not_using",      // 사용 빈도 낮음
  "switching",      // 다른 서비스 이용
  "other",          // 기타
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "로그인이 필요합니다." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "인증 실패" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 본문 (사유/상세)
    let reason = "other";
    let reasonDetail = "";
    try {
      const body = await req.json();
      if (body && typeof body.reason === "string" && ALLOWED_REASONS.has(body.reason)) {
        reason = body.reason;
      }
      if (body && typeof body.reason_detail === "string") {
        reasonDetail = body.reason_detail.slice(0, 500);
      }
    } catch (_) { /* no body */ }

    const admin = createClient(supabaseUrl, serviceKey);

    // 활성 구독 조회
    const { data: sub } = await admin
      .from("subscriptions")
      .select("id, plan, status, expires_at, billing_cycle")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) {
      return new Response(JSON.stringify({ error: "활성 구독이 없습니다." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // status='cancelled' 로 표기 (자동결제 중단). 이용기간은 expires_at 까지 유지.
    const { error: updErr } = await admin
      .from("subscriptions")
      .update({ status: "cancelled", payment_enabled: false, updated_at: new Date().toISOString() })
      .eq("id", sub.id);

    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cancelledAt = new Date().toISOString();
    const expiresAt = sub.expires_at;
    const expiresLabel = expiresAt
      ? new Date(expiresAt).toLocaleDateString("ko-KR")
      : "다음 결제일";

    // 감사 로그 (사유 포함)
    await admin.from("audit_logs").insert({
      user_id: user.id,
      action: "subscription_cancelled",
      severity: "info",
      details: {
        plan: sub.plan,
        billing_cycle: sub.billing_cycle,
        expires_at: expiresAt,
        cancelled_at: cancelledAt,
        reason,
        reason_detail: reasonDetail,
      },
    });

    // 앱 내 알림 생성
    await admin.from("notifications").insert({
      user_id: user.id,
      type: "subscription_cancelled",
      title: "구독이 해지되었습니다",
      body: `${expiresLabel}까지 현재 ${sub.plan.toUpperCase()} 플랜을 그대로 이용하실 수 있어요. 그 이후로는 자동결제가 중단됩니다.`,
    });

    // 이메일 알림 (도메인 미설정/오류 시 무시)
    try {
      await admin.functions.invoke("send-transactional-email", {
        body: {
          templateName: "subscription-cancelled",
          recipientEmail: user.email,
          idempotencyKey: `subscription-cancelled-${sub.id}-${cancelledAt}`,
          templateData: {
            plan: sub.plan,
            cancelledAt,
            expiresAt,
            expiresLabel,
            reason,
          },
        },
      });
    } catch (e) {
      console.warn("subscription-cancelled email skipped:", (e as Error).message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        expires_at: expiresAt,
        plan: sub.plan,
        cancelled_at: cancelledAt,
        reason,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? "처리 실패" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
