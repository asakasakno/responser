import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLAN_LIMITS: Record<string, { maxPerDay: number }> = {
  free: { maxPerDay: 20 },
  basic: { maxPerDay: 200 },
  pro: { maxPerDay: 1000 },
};

const SYSTEM_PROMPTS: Record<string, string> = {
  review: `당신은 네이버 스마트스토어 셀러의 고객 리뷰 응대 전문가입니다.
고객 리뷰에 대해 전문적이고 친절한 답변을 작성해주세요.
- 감사 인사로 시작
- 구체적인 리뷰 내용에 맞는 답변
- 재구매 유도 멘트 포함
- 자연스럽고 정중한 톤
- 200자 내외로 작성`,

  inquiry: `당신은 네이버 스마트스토어 셀러의 고객 문의 응대 전문가입니다.
고객 문의에 대해 정확하고 도움이 되는 답변을 작성해주세요.
- 문의 내용을 정확히 파악
- 명확하고 구체적인 답변
- 추가 문의 안내
- 친절하고 전문적인 톤
- 200자 내외로 작성`,

  claim: `당신은 네이버 스마트스토어 셀러의 클레임/불만 대응 전문가입니다.
고객 불만이나 클레임에 대해 전문적으로 대응하는 답변을 작성해주세요.
- 진심 어린 사과로 시작
- 문제 상황 인정
- 구체적인 해결 방안 제시 (교환/환불/보상 등)
- 재발 방지 약속
- 정중하면서도 신뢰감 있는 톤
- 250자 내외로 작성`,
};

function jsonRes(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    // Verify JWT via getClaims
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return jsonRes({ error: "인증이 유효하지 않습니다." }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if user is suspended
    const { data: profile } = await adminClient
      .from("profiles")
      .select("suspended, energy_balance")
      .eq("user_id", userId)
      .single();

    if (!profile) return jsonRes({ error: "사용자를 찾을 수 없습니다." }, 404);
    if (profile.suspended) return jsonRes({ error: "계정이 정지되었습니다." }, 403);

    // [7] Rate limit check
    const { data: allowed } = await adminClient.rpc("check_rate_limit", {
      _user_id: userId,
      _action: "generate",
      _max_per_second: 2,
    });
    if (!allowed) {
      return jsonRes({ error: "요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요." }, 429);
    }

    // Parse body
    const { type, text, product, energy_cost } = await req.json();

    if (!type || !text) {
      return jsonRes({ error: "필수 항목이 누락되었습니다." }, 400);
    }

    if (!["review", "inquiry", "claim"].includes(type)) {
      return jsonRes({ error: "잘못된 요청입니다." }, 400);
    }

    // Sanitize text input length
    if (typeof text !== "string" || text.length > 5000) {
      return jsonRes({ error: "입력이 너무 깁니다." }, 400);
    }

    const cost = energy_cost || 1;

    // [2] 서버에서 에너지 차감 (spend_energy RPC는 이미 SECURITY DEFINER)
    const { data: spendResult, error: spendError } = await userClient.rpc("spend_energy", {
      _amount: cost,
      _reason: type,
      _description: `${type === "review" ? "리뷰 답변" : type === "inquiry" ? "문의 답변" : "클레임 대응"} 생성`,
    });

    if (spendError) {
      return jsonRes({ error: "처리 중 오류가 발생했습니다." }, 500);
    }

    const result = spendResult as any;
    if (!result?.success) {
      return jsonRes({ error: result?.error === "Insufficient energy" ? "에너지가 부족합니다." : "요청을 처리할 수 없습니다." }, 403);
    }

    // Increment usage for streak tracking
    await userClient.rpc("increment_usage");

    // [10] Audit log
    await adminClient.from("audit_logs").insert({
      user_id: userId,
      action: "generate",
      details: { type, text_length: text.length, energy_cost: cost },
      severity: "info",
    });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return jsonRes({ error: "서비스 설정 오류입니다." }, 500);
    }

    let systemPrompt = SYSTEM_PROMPTS[type] || SYSTEM_PROMPTS.review;

    if (product) {
      systemPrompt += `\n\n[상품 정보]\n상품명: ${product.name}\n카테고리: ${product.category}`;
      if (product.note) systemPrompt += `\n특이사항: ${product.note}`;
      systemPrompt += `\n\n위 상품 정보를 참고하여 더 정확한 답변을 작성해주세요.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
      }),
    });

    if (!response.ok) {
      // [9] 에러 메시지 최소화 - 내부 상세 노출 금지
      console.error(`AI gateway error: ${response.status}`);
      if (response.status === 429) {
        return jsonRes({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, 429);
      }
      return jsonRes({ error: "답변 생성에 실패했습니다." }, 500);
    }

    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content || "답변을 생성할 수 없습니다.";

    return jsonRes({ response: responseText });
  } catch (e) {
    // [9] 에러 메시지 최소화
    console.error("generate-response error:", e);
    return jsonRes({ error: "요청을 처리할 수 없습니다." }, 500);
  }
});
