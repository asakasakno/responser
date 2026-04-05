import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, text, product } = await req.json();

    if (!type || !text) {
      return new Response(JSON.stringify({ error: "type과 text는 필수입니다" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "크레딧이 부족합니다." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content || "답변을 생성할 수 없습니다.";

    return new Response(JSON.stringify({ response: responseText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-response error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
