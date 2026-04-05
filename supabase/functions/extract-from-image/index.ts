import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TYPE_LABELS: Record<string, string> = {
  review: "고객 리뷰",
  inquiry: "고객 문의",
  claim: "클레임/불만",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image, type } = await req.json();

    if (!image) {
      return new Response(JSON.stringify({ error: "image는 필수입니다" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const typeLabel = TYPE_LABELS[type] || "고객 리뷰";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `당신은 이미지에서 ${typeLabel} 텍스트를 추출하는 전문가입니다.
이미지에서 개별 ${typeLabel}을 식별하고 각각을 별도의 항목으로 추출해주세요.

반드시 다음 JSON 형식으로만 응답하세요:
{"items": ["첫 번째 리뷰/문의 내용", "두 번째 리뷰/문의 내용", ...]}

각 항목은 하나의 완전한 ${typeLabel}이어야 합니다.
이미지에서 텍스트를 찾을 수 없으면 {"items": []}를 반환하세요.`,
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:image/png;base64,${image}` },
              },
              {
                type: "text",
                text: `이 이미지에서 모든 ${typeLabel}을 추출해주세요.`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "요청이 너무 많습니다." }), {
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
    const content = data.choices?.[0]?.message?.content || '{"items": []}';
    
    // Parse JSON from the response, handling markdown code blocks
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { items: [] };
    } catch {
      parsed = { items: [] };
    }

    return new Response(JSON.stringify({ items: parsed.items || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-from-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
