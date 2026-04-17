import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-client-source, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TYPE_LABELS: Record<string, string> = {
  review: "고객 리뷰",
  inquiry: "고객 문의",
  claim: "클레임/불만",
};

// [6] 이미지 업로드 보안 상수
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_PREFIXES = ["data:image/png", "data:image/jpeg", "data:image/webp"];

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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return jsonRes({ error: "인증이 유효하지 않습니다." }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check suspended
    const { data: profile } = await adminClient
      .from("profiles")
      .select("suspended")
      .eq("user_id", userId)
      .single();

    if (!profile) return jsonRes({ error: "사용자를 찾을 수 없습니다." }, 404);
    if (profile.suspended) return jsonRes({ error: "계정이 정지되었습니다." }, 403);

    // [7] Rate limit (batch는 별도 제한: 초당 1회)
    const { data: allowed } = await adminClient.rpc("check_rate_limit", {
      _user_id: userId,
      _action: "extract_image",
      _max_per_second: 1,
    });
    if (!allowed) {
      return jsonRes({ error: "요청이 너무 빠릅니다." }, 429);
    }

    const { image, type } = await req.json();

    if (!image) {
      return jsonRes({ error: "이미지가 필요합니다." }, 400);
    }

    if (!type || !["review", "inquiry", "claim"].includes(type)) {
      return jsonRes({ error: "잘못된 요청입니다." }, 400);
    }

    // [6] 이미지 크기 검증 (base64 → 원본 크기 추정)
    if (typeof image !== "string") {
      return jsonRes({ error: "잘못된 이미지 형식입니다." }, 400);
    }
    const estimatedBytes = (image.length * 3) / 4;
    if (estimatedBytes > MAX_IMAGE_SIZE_BYTES) {
      return jsonRes({ error: "이미지 크기는 5MB 이하만 허용됩니다." }, 400);
    }

    // [10] Audit log
    await adminClient.from("audit_logs").insert({
      user_id: userId,
      action: "extract_image",
      details: { type, image_size_kb: Math.round(estimatedBytes / 1024) },
      severity: "info",
    });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return jsonRes({ error: "서비스 설정 오류입니다." }, 500);
    }

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
      console.error(`AI gateway error: ${response.status}`);
      if (response.status === 429) {
        return jsonRes({ error: "요청이 너무 많습니다." }, 429);
      }
      return jsonRes({ error: "이미지 처리에 실패했습니다." }, 500);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{"items": []}';
    
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { items: [] };
    } catch {
      parsed = { items: [] };
    }

    return jsonRes({ items: parsed.items || [] });
  } catch (e) {
    console.error("extract-from-image error:", e);
    return jsonRes({ error: "요청을 처리할 수 없습니다." }, 500);
  }
});
