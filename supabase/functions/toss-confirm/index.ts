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

// 플랜 + 사이클 → 가격(원) 매핑. 클라이언트가 보낸 plan/cycle 기반으로 서버에서만 검증.
const PLAN_PRICES: Record<string, Record<string, number>> = {
  basic: { monthly: 9900, yearly: 99000 },
  pro: { monthly: 29900, yearly: 299000 },
};

const PLAN_ENERGY: Record<string, { max: number; monthly: number }> = {
  basic: { max: 500, monthly: 200 },
  pro: { max: 2000, monthly: 1000 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    const body = await req.json().catch(() => ({}));
    const { paymentKey, orderId, amount, plan, cycle, coupon_code } = body ?? {};

    if (!paymentKey || !orderId || typeof amount !== "number" || amount <= 0) {
      return jsonRes({ error: "필수 결제 정보가 누락되었습니다." }, 400);
    }
    if (!plan || !cycle || !PLAN_PRICES[plan]?.[cycle]) {
      return jsonRes({ error: "유효하지 않은 플랜 정보입니다." }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // 중복 처리 방지
    const { data: dup } = await adminClient
      .from("audit_logs")
      .select("id")
      .eq("action", "payment_success")
      .contains("details", { orderId })
      .maybeSingle();
    if (dup) return jsonRes({ error: "이미 처리된 결제입니다." }, 409);

    // 서버 기준 최종 금액 계산 (쿠폰 적용 시 validate_coupon 사용)
    const basePrice = PLAN_PRICES[plan][cycle];
    let expectedAmount = basePrice;
    let couponInfo: any = null;

    if (coupon_code && typeof coupon_code === "string") {
      const { data: cv } = await userClient.rpc("validate_coupon", {
        _code: coupon_code,
        _amount: basePrice,
        _target_type: "subscription",
        _target_plan: plan,
      });
      if (!cv || !cv.valid) {
        return jsonRes({ error: cv?.error || "쿠폰을 사용할 수 없습니다." }, 400);
      }
      couponInfo = cv;
      expectedAmount = cv.final_amount;
    }

    if (amount !== expectedAmount) {
      await adminClient.from("audit_logs").insert({
        user_id: userId,
        action: "payment_amount_mismatch",
        details: { orderId, client_amount: amount, expected: expectedAmount, plan, cycle },
        severity: "warning",
      });
      return jsonRes({ error: "결제 금액이 일치하지 않습니다." }, 400);
    }

    await adminClient.from("audit_logs").insert({
      user_id: userId,
      action: "payment_attempt",
      details: { paymentKey, orderId, amount, plan, cycle },
      severity: "info",
    });

    // Toss 서버 승인
    const TOSS_SECRET_KEY = Deno.env.get("TOSS_SECRET_KEY");
    if (!TOSS_SECRET_KEY) {
      return jsonRes({ error: "결제 시스템 설정 오류입니다." }, 500);
    }

    const tossResponse = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(TOSS_SECRET_KEY + ":")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentKey, orderId, amount: expectedAmount }),
    });

    const tossData = await tossResponse.json().catch(() => ({}));

    if (!tossResponse.ok) {
      await adminClient.from("payments").insert({
        user_id: userId,
        amount: expectedAmount,
        product_name: `${plan === "pro" ? "Pro" : "Basic"} ${cycle === "yearly" ? "연간" : "월간"}`,
        status: "failed",
        payment_method: "toss",
      });
      await adminClient.from("audit_logs").insert({
        user_id: userId,
        action: "payment_failed",
        details: { orderId, toss_code: tossData?.code, toss_message: tossData?.message },
        severity: "warning",
      });
      return jsonRes({ error: tossData?.message || "결제 검증에 실패했습니다." }, 400);
    }

    if (typeof tossData?.totalAmount !== "number" || tossData.totalAmount !== expectedAmount) {
      await adminClient.from("audit_logs").insert({
        user_id: userId,
        action: "payment_toss_amount_mismatch",
        details: { orderId, toss_total: tossData?.totalAmount, expected: expectedAmount },
        severity: "error",
      });
      return jsonRes({ error: "결제 금액 검증에 실패했습니다." }, 400);
    }

    // 결제 성공 기록
    await adminClient.from("payments").insert({
      user_id: userId,
      amount: tossData.totalAmount,
      product_name: `${plan === "pro" ? "Pro" : "Basic"} ${cycle === "yearly" ? "연간" : "월간"}${couponInfo ? ` (쿠폰 ${couponInfo.coupon_code})` : ""}`,
      status: "success",
      payment_method: tossData.method || "toss",
    });

    // 구독 업데이트 (기존 active 행 갱신, 없으면 새로 생성)
    const periodDays = cycle === "yearly" ? 365 : 30;
    const expiresAt = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000).toISOString();

    const { data: existingSub } = await adminClient
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (existingSub) {
      await adminClient
        .from("subscriptions")
        .update({
          plan,
          billing_cycle: cycle,
          started_at: new Date().toISOString(),
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingSub.id);
    } else {
      await adminClient.from("subscriptions").insert({
        user_id: userId,
        plan,
        status: "active",
        billing_cycle: cycle,
        expires_at: expiresAt,
      });
    }

    // 에너지 최대치 + 월간 에너지 지급
    const energy = PLAN_ENERGY[plan];
    await adminClient
      .from("profiles")
      .update({ max_energy: energy.max })
      .eq("user_id", userId);

    await adminClient.rpc("earn_energy", {
      _user_id: userId,
      _amount: energy.monthly,
      _reason: "subscription",
      _description: `${plan === "pro" ? "Pro" : "Basic"} ${cycle === "yearly" ? "연간" : "월간"} 결제 에너지`,
      _source: "subscription",
      _expire_days: null,
    });

    // 쿠폰 사용 기록
    if (couponInfo) {
      await adminClient.rpc("consume_coupon", {
        _user_id: userId,
        _coupon_id: couponInfo.coupon_id,
        _original_amount: basePrice,
        _discount_amount: couponInfo.discount_amount,
        _final_amount: expectedAmount,
        _target_type: "subscription",
        _billing_order_id: orderId,
      });
    }

    // 추천인 결제 보상
    await adminClient.rpc("grant_referral_payment_bonus", { _user_id: userId });

    await adminClient.from("audit_logs").insert({
      user_id: userId,
      action: "payment_success",
      details: { orderId, plan, cycle, amount: tossData.totalAmount },
      severity: "info",
    });

    return jsonRes({
      success: true,
      plan,
      cycle,
      expires_at: expiresAt,
      message: "결제가 완료되었습니다.",
    });
  } catch (e) {
    console.error("toss-confirm error:", e);
    return jsonRes({ error: "결제 처리 중 오류가 발생했습니다." }, 500);
  }
});
