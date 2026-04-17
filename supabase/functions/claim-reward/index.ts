import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REWARD_DEFS: Record<string, { amount: number; description: string; check: (ctx: any) => Promise<boolean> }> = {
  first_generation: {
    amount: 5,
    description: '첫 응답 생성 보너스',
    check: async ({ admin, userId }) => {
      const { count } = await admin.from('generations').select('id', { count: 'exact', head: true }).eq('user_id', userId);
      return (count ?? 0) >= 1;
    },
  },
  ten_generations: {
    amount: 10,
    description: '응답 10건 생성 보너스',
    check: async ({ admin, userId }) => {
      const { count } = await admin.from('generations').select('id', { count: 'exact', head: true }).eq('user_id', userId);
      return (count ?? 0) >= 10;
    },
  },
  streak_3day: {
    amount: 15,
    description: '3일 연속 사용 보너스',
    check: async ({ admin, userId }) => {
      const { data } = await admin.from('usage').select('date').eq('user_id', userId).order('date', { ascending: false }).limit(7);
      if (!data || data.length < 3) return false;
      const dates = data.map((u: any) => u.date);
      let streak = 1;
      for (let i = 0; i < dates.length - 1; i++) {
        const diff = (new Date(dates[i]).getTime() - new Date(dates[i + 1]).getTime()) / 86400000;
        if (diff === 1) streak++;
        else break;
      }
      return streak >= 3;
    },
  },
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
    const { reward_key } = await req.json();
    const def = REWARD_DEFS[reward_key];
    if (!def) return jsonRes({ error: "알 수 없는 보상입니다." }, 400);

    const ok = await def.check({ admin, userId });
    if (!ok) return jsonRes({ error: "조건을 충족하지 않습니다." }, 400);

    const { data: result } = await admin.rpc('claim_reward', {
      _reward_key: reward_key,
      _amount: def.amount,
      _description: def.description,
    });
    const r = result as any;
    if (!r?.success) return jsonRes({ error: r?.error === 'Already claimed' ? '이미 받은 보상입니다.' : '지급 실패' }, 400);

    return jsonRes({ success: true, balance: r.balance, earned: r.earned });
  } catch (e) {
    console.error("claim-reward error:", e);
    return jsonRes({ error: "요청을 처리할 수 없습니다." }, 500);
  }
});
