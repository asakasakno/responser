import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

// 쿠폰 검증 전용 (할인 미리보기). 실제 사용 기록은 결제 함수에서 처리.
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

    const body = await req.json().catch(() => ({}));
    const { code, amount, target_type, target_plan } = body ?? {};

    if (!code || typeof code !== "string" || code.length > 50) {
      return jsonRes({ valid: false, error: "코드를 입력해주세요." }, 400);
    }
    if (typeof amount !== "number" || amount <= 0 || amount > 10_000_000) {
      return jsonRes({ valid: false, error: "잘못된 금액입니다." }, 400);
    }
    if (!["subscription", "energy"].includes(target_type)) {
      return jsonRes({ valid: false, error: "잘못된 결제 종류입니다." }, 400);
    }

    // service role로 RPC 호출 시 auth.uid() 비어있음 → user 컨텍스트로 호출해야 함
    const { data, error } = await userClient.rpc("validate_coupon", {
      _code: code,
      _amount: Math.floor(amount),
      _target_type: target_type,
      _target_plan: target_plan ?? null,
    });

    if (error) {
      console.error("validate_coupon error:", error);
      return jsonRes({ valid: false, error: "쿠폰 검증에 실패했습니다." }, 400);
    }

    // audit
    const admin = createClient(supabaseUrl, serviceKey);
    await admin.from("audit_logs").insert({
      user_id: userId,
      action: "coupon_validate",
      details: { code, amount, target_type, target_plan, result: data },
      severity: "info",
    });

    return jsonRes(data ?? { valid: false, error: "검증 실패" });
  } catch (e) {
    console.error("validate-coupon error:", e);
    return jsonRes({ valid: false, error: "요청을 처리할 수 없습니다." }, 500);
  }
});
