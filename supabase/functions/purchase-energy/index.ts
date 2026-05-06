import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// 에너지 추가 구매: Toss Payments 서버 검증 후에만 에너지 지급
// 클라이언트가 보낸 payment_key/order_id/amount는 절대 신뢰하지 않고,
// Toss confirm API로 검증 + 금액 일치 확인 후에만 grant.

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
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonRes(data: any, corsHeaders: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function maskId(value: string): string {
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = buildCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    if (origin && !allowedOrigins.has(origin)) {
      return new Response("forbidden", { status: 403, headers: corsHeaders });
    }
    return new Response(null, { headers: corsHeaders });
  }

  if (origin && !allowedOrigins.has(origin)) {
    return jsonRes({ error: "허용되지 않은 Origin입니다." }, corsHeaders, 403);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonRes({ error: "인증이 필요합니다." }, corsHeaders, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return jsonRes({ error: "인증 실패" }, corsHeaders, 401);
    const userId = claimsData.claims.sub as string | undefined;
    if (!userId) return jsonRes({ error: "인증 실패" }, corsHeaders, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const { pack_id, payment_key, order_id, amount, coupon_code } = body ?? {};

    // 입력 검증
    if (!pack_id || typeof pack_id !== "string") {
      return jsonRes({ error: "상품을 선택해주세요." }, corsHeaders, 400);
    }
    if (!payment_key || !order_id || typeof payment_key !== "string" || typeof order_id !== "string") {
      return jsonRes({ error: "결제 정보가 누락되었습니다." }, corsHeaders, 400);
    }
    if (typeof amount !== "number" || amount <= 0) {
      return jsonRes({ error: "잘못된 결제 금액입니다." }, corsHeaders, 400);
    }

    const orderIdHash = await sha256Hex(order_id);
    const paymentKeyHash = await sha256Hex(payment_key);
    const orderIdMasked = maskId(order_id);
    const paymentKeyMasked = maskId(payment_key);

    // 상품(에너지팩) 조회 - 가격은 서버 DB 기준만 신뢰
    const { data: pack } = await admin
      .from("energy_packs")
      .select("id, energy, price, active")
      .eq("id", pack_id)
      .maybeSingle();
    if (!pack || !pack.active) return jsonRes({ error: "유효하지 않은 상품입니다." }, corsHeaders, 400);

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
        return jsonRes({ error: cv?.error || "쿠폰을 사용할 수 없습니다." }, corsHeaders, 400);
      }
      couponInfo = cv;
      expectedAmount = cv.final_amount;
    }

    // 클라이언트 amount와 서버 계산 최종 금액 일치 검증
    if (amount !== expectedAmount) {
      await admin.from("audit_logs").insert({
        user_id: userId,
        action: "purchase_energy_amount_mismatch",
        details: { pack_id, client_amount: amount, expected: expectedAmount, order_id_masked: orderIdMasked, order_id_hash: orderIdHash },
        severity: "warning",
      });
      return jsonRes({ error: "결제 금액이 일치하지 않습니다." }, corsHeaders, 400);
    }

    // 결제 시도 감사 로그
    await admin.from("audit_logs").insert({
      user_id: userId,
      action: "purchase_energy_attempt",
      details: {
        pack_id,
        amount,
        order_id_masked: orderIdMasked,
        payment_key_masked: paymentKeyMasked,
        order_id_hash: orderIdHash,
        payment_key_hash: paymentKeyHash,
      },
      severity: "info",
    });

    // Toss Payments 서버 검증
    const TOSS_SECRET_KEY = Deno.env.get("TOSS_SECRET_KEY");
    if (!TOSS_SECRET_KEY) {
      console.error("TOSS_SECRET_KEY not configured");
      return jsonRes({ error: "결제 시스템이 설정되지 않았습니다." }, corsHeaders, 503);
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
        details: { pack_id, order_id_masked: orderIdMasked, order_id_hash: orderIdHash, toss_code: tossData?.code },
        severity: "warning",
      });
      return jsonRes({ error: "결제 검증에 실패했습니다." }, corsHeaders, 400);
    }

    // Toss 승인 결과의 핵심 필드 재검증 (클라이언트 값 신뢰 금지)
    if (tossData?.orderId !== order_id || tossData?.paymentKey !== payment_key) {
      await admin.from("audit_logs").insert({
        user_id: userId,
        action: "purchase_energy_toss_id_mismatch",
        details: { pack_id, order_id_hash: orderIdHash, payment_key_hash: paymentKeyHash },
        severity: "error",
      });
      return jsonRes({ error: "결제 식별자 검증에 실패했습니다." }, corsHeaders, 400);
    }

    // Toss 응답 금액과 서버 최종 금액 재검증
    if (typeof tossData?.totalAmount !== "number" || tossData.totalAmount !== expectedAmount) {
      await admin.from("audit_logs").insert({
        user_id: userId,
        action: "purchase_energy_toss_amount_mismatch",
        details: { pack_id, order_id_hash: orderIdHash, toss_total: tossData?.totalAmount, server_price: pack.price },
        severity: "error",
      });
      return jsonRes({ error: "결제 금액 검증에 실패했습니다." }, corsHeaders, 400);
    }

    // 승인 처리(결제 기록 + 에너지 지급)는 DB 함수에서 단일 트랜잭션으로 수행
    const { data: finalizeResult } = await admin.rpc("finalize_energy_purchase", {
      _user_id: userId,
      _amount: expectedAmount,
      _product_name: `에너지 ${pack.energy}개${couponInfo ? ` (쿠폰 ${couponInfo.coupon_code})` : ''}`,
      _payment_method: tossData?.method || "toss",
      _order_id: order_id,
      _payment_key: payment_key,
      _energy: pack.energy,
      _energy_description: `에너지 ${pack.energy}개 추가 구매`,
    });

    if (!finalizeResult?.success) {
      if (finalizeResult?.owner_mismatch) {
        return jsonRes({ error: "결제 소유자가 일치하지 않습니다." }, corsHeaders, 403);
      }
      return jsonRes({ error: "결제 후 처리에 실패했습니다." }, corsHeaders, 500);
    }

    // 쿠폰 사용 기록 (중복 결제는 위에서 409로 차단된 뒤에만 실행)
    if (couponInfo && !finalizeResult?.already_processed) {
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

    if (!finalizeResult?.already_processed) {
      await admin.from("audit_logs").insert({
        user_id: userId,
        action: "purchase_energy_success",
        details: {
          pack_id,
          energy: pack.energy,
          original_price: pack.price,
          paid: expectedAmount,
          coupon: couponInfo?.coupon_code,
          order_id_masked: orderIdMasked,
          payment_key_masked: paymentKeyMasked,
          order_id_hash: orderIdHash,
          payment_key_hash: paymentKeyHash,
        },
        severity: "info",
      });
    }

    return jsonRes({
      success: true,
      idempotent_replay: !!finalizeResult?.already_processed,
      result: finalizeResult?.energy ?? null,
      payment: finalizeResult?.payment ?? null,
    }, corsHeaders);
  } catch (e) {
    console.error("purchase-energy error:", e);
    return jsonRes({ error: "요청을 처리할 수 없습니다." }, corsHeaders, 500);
  }
});
