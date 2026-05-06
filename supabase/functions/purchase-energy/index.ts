import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { buildCorsHeaders, isOriginAllowed } from "../_shared/cors.ts";

const CORS_HEADERS = {
  allowHeaders:
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  allowMethods: "POST, OPTIONS",
};

function jsonResponse(data: unknown, corsHeaders: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function maskIdentifier(value: string): string {
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = buildCorsHeaders(origin, CORS_HEADERS);

  if (req.method === "OPTIONS") {
    if (origin && !isOriginAllowed(origin)) {
      return new Response("forbidden", { status: 403, headers: corsHeaders });
    }
    return new Response(null, { headers: corsHeaders });
  }

  if (origin && !isOriginAllowed(origin)) {
    return jsonResponse({ error: "Origin not allowed." }, corsHeaders, 403);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Authentication required." }, corsHeaders, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;
    if (claimsError || !userId) {
      return jsonResponse({ error: "Invalid authentication." }, corsHeaders, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json().catch(() => ({}));
    const { pack_id, payment_key, order_id, amount, coupon_code } = body ?? {};

    if (!pack_id || typeof pack_id !== "string") {
      return jsonResponse({ error: "A valid pack is required." }, corsHeaders, 400);
    }
    if (!payment_key || typeof payment_key !== "string" || !order_id || typeof order_id !== "string") {
      return jsonResponse({ error: "Payment information is missing." }, corsHeaders, 400);
    }
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      return jsonResponse({ error: "Invalid payment amount." }, corsHeaders, 400);
    }

    const orderIdHash = await sha256Hex(order_id);
    const paymentKeyHash = await sha256Hex(payment_key);
    const orderIdMasked = maskIdentifier(order_id);
    const paymentKeyMasked = maskIdentifier(payment_key);

    const { data: pack } = await adminClient
      .from("energy_packs")
      .select("id, energy, price, active")
      .eq("id", pack_id)
      .maybeSingle();

    if (!pack || !pack.active) {
      return jsonResponse({ error: "Energy pack not found." }, corsHeaders, 400);
    }

    let expectedAmount = pack.price;
    let couponInfo: any = null;

    if (coupon_code && typeof coupon_code === "string") {
      const { data: couponValidation } = await userClient.rpc("validate_coupon", {
        _code: coupon_code,
        _amount: pack.price,
        _target_type: "energy",
        _target_plan: null,
      });

      if (!couponValidation || !couponValidation.valid) {
        return jsonResponse(
          { error: couponValidation?.error || "Coupon is not valid." },
          corsHeaders,
          400,
        );
      }

      couponInfo = couponValidation;
      expectedAmount = couponValidation.final_amount;
    }

    if (amount !== expectedAmount) {
      await adminClient.from("audit_logs").insert({
        user_id: userId,
        action: "purchase_energy_amount_mismatch",
        details: {
          pack_id,
          client_amount: amount,
          expected_amount: expectedAmount,
          order_id_masked: orderIdMasked,
          order_id_hash: orderIdHash,
        },
        severity: "warning",
      });

      return jsonResponse({ error: "Payment amount mismatch." }, corsHeaders, 400);
    }

    await adminClient.from("audit_logs").insert({
      user_id: userId,
      action: "purchase_energy_attempt",
      details: {
        pack_id,
        amount: expectedAmount,
        order_id_masked: orderIdMasked,
        order_id_hash: orderIdHash,
        payment_key_masked: paymentKeyMasked,
        payment_key_hash: paymentKeyHash,
      },
      severity: "info",
    });

    const tossSecretKey = Deno.env.get("TOSS_SECRET_KEY");
    if (!tossSecretKey) {
      return jsonResponse({ error: "Payment service is unavailable." }, corsHeaders, 503);
    }

    const tossResponse = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${tossSecretKey}:`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        paymentKey: payment_key,
        orderId: order_id,
        amount: expectedAmount,
      }),
    });

    const tossData = await tossResponse.json().catch(() => ({}));

    if (!tossResponse.ok) {
      await adminClient.from("payments").insert({
        user_id: userId,
        amount: expectedAmount,
        product_name: `Energy ${pack.energy}`,
        status: "failed",
        payment_method: "toss",
      });

      await adminClient.from("audit_logs").insert({
        user_id: userId,
        action: "purchase_energy_failed",
        details: {
          pack_id,
          toss_code: tossData?.code ?? null,
          order_id_masked: orderIdMasked,
          order_id_hash: orderIdHash,
          payment_key_masked: paymentKeyMasked,
          payment_key_hash: paymentKeyHash,
        },
        severity: "warning",
      });

      return jsonResponse({ error: "Payment confirmation failed." }, corsHeaders, 400);
    }

    if (tossData?.orderId !== order_id || tossData?.paymentKey !== payment_key) {
      await adminClient.from("audit_logs").insert({
        user_id: userId,
        action: "purchase_energy_toss_id_mismatch",
        details: {
          pack_id,
          order_id_hash: orderIdHash,
          payment_key_hash: paymentKeyHash,
        },
        severity: "error",
      });

      return jsonResponse({ error: "Payment identifier verification failed." }, corsHeaders, 400);
    }

    if (typeof tossData?.totalAmount !== "number" || tossData.totalAmount !== expectedAmount) {
      await adminClient.from("audit_logs").insert({
        user_id: userId,
        action: "purchase_energy_toss_amount_mismatch",
        details: {
          pack_id,
          toss_total_amount: tossData?.totalAmount ?? null,
          expected_amount: expectedAmount,
          order_id_hash: orderIdHash,
        },
        severity: "error",
      });

      return jsonResponse({ error: "Payment amount verification failed." }, corsHeaders, 400);
    }

    const productName = `Energy ${pack.energy}${couponInfo ? ` (coupon ${couponInfo.coupon_code})` : ""}`;
    const { data: finalizeResult, error: finalizeError } = await adminClient.rpc("finalize_energy_purchase", {
      _user_id: userId,
      _amount: expectedAmount,
      _product_name: productName,
      _payment_method: tossData?.method || "toss",
      _order_id: order_id,
      _payment_key: payment_key,
      _energy: pack.energy,
      _energy_description: `Energy ${pack.energy} purchase`,
    });

    if (finalizeError) {
      console.error("finalize_energy_purchase error:", finalizeError);
      return jsonResponse({ error: "Payment finalization failed." }, corsHeaders, 500);
    }

    if (!finalizeResult?.success) {
      if (finalizeResult?.owner_mismatch) {
        await adminClient.from("audit_logs").insert({
          user_id: userId,
          action: "purchase_energy_owner_mismatch",
          details: {
            order_id_hash: orderIdHash,
            payment_key_hash: paymentKeyHash,
          },
          severity: "error",
        });

        return jsonResponse({ error: "Payment ownership mismatch." }, corsHeaders, 403);
      }

      return jsonResponse({ error: "Payment processing failed." }, corsHeaders, 500);
    }

    if (couponInfo && !finalizeResult?.already_processed) {
      await adminClient.rpc("consume_coupon", {
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
      await adminClient.from("audit_logs").insert({
        user_id: userId,
        action: "purchase_energy_success",
        details: {
          pack_id,
          energy: pack.energy,
          original_price: pack.price,
          paid_amount: expectedAmount,
          coupon_code: couponInfo?.coupon_code ?? null,
          order_id_masked: orderIdMasked,
          order_id_hash: orderIdHash,
          payment_key_masked: paymentKeyMasked,
          payment_key_hash: paymentKeyHash,
        },
        severity: "info",
      });
    }

    return jsonResponse({
      success: true,
      idempotent_replay: !!finalizeResult?.idempotent_replay || !!finalizeResult?.already_processed,
      result: finalizeResult?.energy ?? null,
      payment: finalizeResult?.payment ?? null,
    }, corsHeaders);
  } catch (error) {
    console.error("purchase-energy error:", error);
    return jsonResponse({ error: "Unable to process the purchase." }, corsHeaders, 500);
  }
});
