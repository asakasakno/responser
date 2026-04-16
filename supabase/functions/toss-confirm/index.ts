import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonRes(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const PLAN_AMOUNTS: Record<number, string> = {
  9900: "basic",
  29900: "pro",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // [1] 서버 인증 필수
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonRes({ error: "인증이 필요합니다." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return jsonRes({ error: "인증이 유효하지 않습니다." }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const { paymentKey, orderId, amount } = await req.json();

    // [4] 필수 파라미터 검증
    if (!paymentKey || !orderId || !amount) {
      return jsonRes({ error: "필수 결제 정보가 누락되었습니다." }, 400);
    }

    if (typeof amount !== "number" || amount <= 0) {
      return jsonRes({ error: "잘못된 결제 금액입니다." }, 400);
    }

    // 금액 → 플랜 매핑 검증
    const expectedPlan = PLAN_AMOUNTS[amount];
    if (!expectedPlan) {
      return jsonRes({ error: "유효하지 않은 결제 금액입니다." }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // [10] 결제 시도 감사 로그
    await adminClient.from("audit_logs").insert({
      user_id: userId,
      action: "payment_attempt",
      details: { paymentKey, orderId, amount },
      severity: "info",
    });

    // [4] Toss Payments 서버 검증 - confirm API 호출
    const TOSS_SECRET_KEY = Deno.env.get("TOSS_SECRET_KEY");
    if (!TOSS_SECRET_KEY) {
      console.error("TOSS_SECRET_KEY not configured");
      return jsonRes({ error: "결제 시스템 설정 오류입니다." }, 500);
    }

    const tossResponse = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(TOSS_SECRET_KEY + ":")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    const tossData = await tossResponse.json();

    if (!tossResponse.ok) {
      // 결제 실패 기록
      await adminClient.from("payments").insert({
        user_id: userId,
        amount,
        product_name: expectedPlan === "basic" ? "Basic 플랜" : "Pro 플랜",
        status: "failed",
        payment_method: "toss",
      });

      await adminClient.from("audit_logs").insert({
        user_id: userId,
        action: "payment_failed",
        details: { orderId, toss_code: tossData.code },
        severity: "warning",
      });

      return jsonRes({ error: "결제 검증에 실패했습니다." }, 400);
    }

    // [4] 서버에서 검증 성공 시에만 플랜 변경
    // 결제 성공 기록
    await adminClient.from("payments").insert({
      user_id: userId,
      amount: tossData.totalAmount,
      product_name: expectedPlan === "basic" ? "Basic 플랜" : "Pro 플랜",
      status: "success",
      payment_method: tossData.method || "toss",
    });

    // 구독 플랜 업그레이드 (서버에서만 처리)
    await adminClient
      .from("subscriptions")
      .update({
        plan: expectedPlan,
        updated_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("user_id", userId)
      .eq("status", "active");

    // 에너지 최대치 업데이트
    const maxEnergy = expectedPlan === "pro" ? 2000 : 500;
    const monthlyEnergy = expectedPlan === "pro" ? 1000 : 200;
    await adminClient
      .from("profiles")
      .update({ max_energy: maxEnergy })
      .eq("user_id", userId);

    // 월간 에너지 지급
    await adminClient.rpc("earn_energy", {
      _user_id: userId,
      _amount: monthlyEnergy,
      _reason: "subscription",
      _description: `${expectedPlan === "pro" ? "Pro" : "Basic"} 플랜 결제 에너지`,
    });

    // [10] 결제 성공 감사 로그
    await adminClient.from("audit_logs").insert({
      user_id: userId,
      action: "payment_success",
      details: { orderId, plan: expectedPlan, amount: tossData.totalAmount },
      severity: "info",
    });

    return jsonRes({
      success: true,
      plan: expectedPlan,
      message: "결제가 완료되었습니다.",
    });
  } catch (e) {
    console.error("toss-confirm error:", e);
    return jsonRes({ error: "결제 처리 중 오류가 발생했습니다." }, 500);
  }
});
