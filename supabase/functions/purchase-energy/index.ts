import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// 토스 결제 연동 전 임시 구현: 결제 검증 단계는 추후 toss-confirm에서 호출.
// 현재는 결제 성공 가정 시 호출되는 내부 엔드포인트로 유지하며, 인증된 사용자만 호출 가능.
// 실제 결제 시에는 toss-confirm이 끝난 뒤 service role 클라이언트로 grant_purchased_energy 호출 권장.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const { pack_id, payment_key, order_id } = await req.json();
    if (!pack_id) return jsonRes({ error: "상품을 선택해주세요." }, 400);

    // TODO: 토스 연동 시 payment_key/order_id로 toss-confirm 검증 호출
    // 지금은 결제 미연동 → 안전을 위해 결제 키가 없으면 실제 지급 거부
    if (!payment_key || !order_id) {
      return jsonRes({ error: "결제 시스템 연동 후 이용 가능합니다." }, 400);
    }

    const { data: pack } = await admin
      .from('energy_packs')
      .select('id, energy, price, active')
      .eq('id', pack_id)
      .maybeSingle();
    if (!pack || !pack.active) return jsonRes({ error: "유효하지 않은 상품입니다." }, 400);

    // 에너지 지급 (구매분: 무기한, max 캡 적용)
    const { data: result } = await admin.rpc('earn_energy', {
      _user_id: userId,
      _amount: pack.energy,
      _reason: 'purchase',
      _description: `에너지 ${pack.energy}개 추가 구매`,
      _source: 'purchase',
      _expire_days: null,
    });

    // 결제 기록
    await admin.from('payments').insert({
      user_id: userId,
      amount: pack.price,
      product_name: `에너지 ${pack.energy}개`,
      status: 'success',
      payment_method: 'toss',
    });

    await admin.from('audit_logs').insert({
      user_id: userId, action: 'purchase_energy',
      details: { pack_id, energy: pack.energy, price: pack.price, order_id },
    });

    return jsonRes({ success: true, result });
  } catch (e) {
    console.error("purchase-energy error:", e);
    return jsonRes({ error: "요청을 처리할 수 없습니다." }, 500);
  }
});
