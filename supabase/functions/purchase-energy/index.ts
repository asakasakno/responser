import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// 에너지 추가 구매: Toss Payments 서버 검증 후에만 에너지 지급
// 클라이언트가 보낸 payment_key/order_id/amount는 절대 신뢰하지 않고,
// Toss confirm API로 검증 + 금액 일치 확인 후에만 grant.

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonRes({ error: "인증이 필요합니다." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return jsonRes({ error: "인증 실패" }, 401);
    const userId = claimsData.claims.sub as string;

    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const { pack_id, payment_key, order_id, amount, coupon_code } = body ?? {};

    // 입력 검증
    if (!pack_id || typeof pack_id !== "string") {
      return jsonRes({ error: "상품을 선택해주세요." }, 400);
    }
    if (!payment_key || !order_id || typeof payment_key !== "string" || typeof order_id !== "string") {
      return jsonRes({ error: "결제 정보가 누락되었습니다." }, 400);
    }
    if (typeof amount !== "number" || amount <= 0) {
      return jsonRes({ error: "잘못된 결제 금액입니다." }, 400);
    }

    // 상품(에너지팩) 조회 - 가격은 서버 DB 기준만 신뢰
    const { data: pack } = await admin
      .from("energy_packs")
      .select("id, energy, price, active")
      .eq("id", pack_id)
      .maybeSingle();
    if (!pack || !pack.active) return jsonRes({ error: "유효하지 않은 상품입니다." }, 400);

    // 쿠폰 적용 시 서버에서 최종 금액 계산
    let couponInfo: any = null;
    let expectedAmount = pack.price;
    if (coupon_code && typeof coupon_code === "string") {
      const { data: cv } = await userClient.rpc("validate_coupon", {
        _code: coupon_code,
        _amount: pack.price,
        _target_type: "energy",
        _target_plan: null,
      });
      if (!cv || !cv.valid) {
        return jsonRes({ error: cv?.error || "쿠폰을 사용할 수 없습니다." }, 400);
      }
      couponInfo = cv;
      expectedAmount = cv.final_amount;
    }

    // 클라이언트 amount와 서버 계산 최종 금액 일치 검증
    if (amount !== expectedAmount) {
      await admin.from("audit_logs").insert({
        user_id: userId,
        action: "purchase_energy_amount_mismatch",
        details: { pack_id, client_amount: amount, expected: expectedAmount, order_id },
        severity: "warning",
      });
      return jsonRes({ error: "결제 금액이 일치하지 않습니다." }, 400);
    }

    // 중복 처리 방지: 동일 order_id로 이미 성공 결제가 있으면 거부
    const { data: existing } = await admin
      .from("audit_logs")
      .select("id")
      .eq("action", "purchase_energy_success")
      .contains("details", { order_id })
      .maybeSingle();
    if (existing) {
      return jsonRes({ error: "이미 처리된 결제입니다." }, 409);
    }

    // 결제 시도 감사 로그
    await admin.from("audit_logs").insert({
      user_id: userId,
      action: "purchase_energy_attempt",
      details: { pack_id, payment_key, order_id, amount },
      severity: "info",
    });

    // Toss Payments 서버 검증
    const TOSS_SECRET_KEY = Deno.env.get("TOSS_SECRET_KEY");
    if (!TOSS_SECRET_KEY) {
      console.error("TOSS_SECRET_KEY not configured");
      return jsonRes({ error: "결제 시스템이 설정되지 않았습니다." }, 503);
    }

    const tossResponse = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(TOSS_SECRET_KEY + ":")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentKey: payment_key, orderId: order_id, amount: expectedAmount }),
    });

    const tossData = await tossResponse.json().catch(() => ({}));

    if (!tossResponse.ok) {
      await admin.from("payments").insert({
        user_id: userId,
        amount: pack.price,
        product_name: `에너지 ${pack.energy}개`,
        status: "failed",
        payment_method: "toss",
      });
      await admin.from("audit_logs").insert({
        user_id: userId,
        action: "purchase_energy_failed",
        details: { pack_id, order_id, toss_code: tossData?.code, toss_message: tossData?.message },
        severity: "warning",
      });
      return jsonRes({ error: "결제 검증에 실패했습니다." }, 400);
    }

    // Toss 응답 금액과 서버 최종 금액 재검증
    if (typeof tossData?.totalAmount !== "number" || tossData.totalAmount !== expectedAmount) {
      await admin.from("audit_logs").insert({
        user_id: userId,
        action: "purchase_energy_toss_amount_mismatch",
        details: { pack_id, order_id, toss_total: tossData?.totalAmount, server_price: pack.price },
        severity: "error",
      });
      return jsonRes({ error: "결제 금액 검증에 실패했습니다." }, 400);
    }

    // 검증 성공 → 에너지 지급 (구매분: 무기한, max 캡 적용)
    const { data: result } = await admin.rpc("earn_energy", {
      _user_id: userId,
      _amount: pack.energy,
      _reason: "purchase",
      _description: `에너지 ${pack.energy}개 추가 구매`,
      _source: "purchase",
      _expire_days: null,
    });

    // 쿠폰 사용 기록
    if (couponInfo) {
      await admin.rpc("consume_coupon", {
        _user_id: userId,
        _coupon_id: couponInfo.coupon_id,
        _original_amount: pack.price,
        _discount_amount: couponInfo.discount_amount,
        _final_amount: expectedAmount,
        _target_type: "energy",
        _billing_order_id: order_id,
      });
    }

    // 결제 성공 기록
    await admin.from("payments").insert({
      user_id: userId,
      amount: expectedAmount,
      product_name: `에너지 ${pack.energy}개${couponInfo ? ` (쿠폰 ${couponInfo.coupon_code})` : ''}`,
      status: "success",
      payment_method: tossData?.method || "toss",
    });

    await admin.from("audit_logs").insert({
      user_id: userId,
      action: "purchase_energy_success",
      details: { pack_id, energy: pack.energy, original_price: pack.price, paid: expectedAmount, coupon: couponInfo?.coupon_code, order_id },
      severity: "info",
    });

    return jsonRes({ success: true, result });
  } catch (e) {
    console.error("purchase-energy error:", e);
    return jsonRes({ error: "요청을 처리할 수 없습니다." }, 500);
  }
});
