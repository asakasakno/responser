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

    // Pro 플랜 권한 체크 - 확장프로그램에서 호출 시
    const clientSource = req.headers.get("x-client-source");
    if (clientSource === "extension") {
      const { data: sub } = await adminClient
        .from("subscriptions")
        .select("plan")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();
      if (sub?.plan !== "pro") {
        await adminClient.from("audit_logs").insert({
          user_id: userId,
          action: "extension_access_denied",
          details: { plan: sub?.plan ?? "none", endpoint: "extract-from-image" },
          severity: "warning",
        });
        return jsonRes({ error: "크롬 확장프로그램은 Pro 플랜에서만 사용할 수 있습니다." }, 403);
      }
    }

    // [7] Burst rate limit
    const { data: burstOk } = await adminClient.rpc("check_rate_limit", {
      _user_id: userId,
      _action: "extract_image",
      _max_per_second: 1,
    });
    if (!burstOk) {
      return jsonRes({ error: "요청이 너무 빠릅니다." }, 429);
    }

    // Per-plan rate limit (minute + day)
    const { data: planLimit } = await userClient.rpc("check_plan_rate_limit", { _action: "extract_image" });
    const pl: any = planLimit;
    if (pl && pl.allowed === false) {
      const msg = pl.reason === "day"
        ? `오늘 이미지 처리 한도(${pl.limit}회)를 모두 사용했습니다.`
        : `분당 이미지 처리 한도(${pl.limit}회)를 초과했습니다.`;
      return jsonRes({ error: msg, plan: pl.plan }, 429);
    }

    const { image, type } = await req.json();

    if (!image) {
      return jsonRes({ error: "이미지가 필요합니다." }, 400);
    }

    if (!type || !["review", "inquiry", "claim"].includes(type)) {
      return jsonRes({ error: "잘못된 요청입니다." }, 400);
    }

    // [6] 이미지 형식/크기 검증
    if (typeof image !== "string" || image.length === 0) {
      return jsonRes({ error: "잘못된 이미지 형식입니다." }, 400);
    }

    // data URL이면 MIME 화이트리스트 검증, 아니면 raw base64로 간주
    let base64Data = image;
    let mimeType = "image/png";
    if (image.startsWith("data:")) {
      const isValidMime = ALLOWED_MIME_PREFIXES.some((p) => image.startsWith(p));
      if (!isValidMime) {
        return jsonRes({ error: "지원하지 않는 이미지 형식입니다. (png, jpeg, webp만 가능)" }, 400);
      }
      const commaIdx = image.indexOf(",");
      if (commaIdx === -1) {
        return jsonRes({ error: "잘못된 이미지 형식입니다." }, 400);
      }
      mimeType = image.substring(5, image.indexOf(";"));
      base64Data = image.substring(commaIdx + 1);
    } else {
      // raw base64 – 형식 검증 (Base64 문자만 허용)
      if (!/^[A-Za-z0-9+/=\s]+$/.test(image)) {
        return jsonRes({ error: "잘못된 이미지 형식입니다." }, 400);
      }
    }

    const estimatedBytes = (base64Data.length * 3) / 4;
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
            content: `당신은 이미지에서 ${typeLabel}을 카드 단위로 분리 추출하는 전문가입니다.

규칙:
- 한 이미지에 여러 ${typeLabel}이 있으면 각각을 반드시 별도의 항목으로 분리하세요.
- 분리 기준: 닉네임/별점/날짜/본문 등 리뷰 카드 단위, 줄바꿈/간격/구분선/레이아웃.
- 각 항목의 text는 해당 ${typeLabel}의 본문(필요 시 별점·작성자 단서를 자연어로 포함)이어야 합니다.
- UI 요소(버튼, 메뉴, 광고, 페이지 번호)는 무시하세요.
- 텍스트가 없으면 빈 배열을 반환하세요.

반드시 다음 JSON 형식으로만 응답하세요(설명 금지):
{"items":[{"review_index":0,"text":"첫 번째 ${typeLabel} 본문"},{"review_index":1,"text":"두 번째 ${typeLabel} 본문"}]}

review_index는 0부터 시작하는 정수입니다.`,
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64Data}` },
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
    
    let parsed: any;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { items: [] };
    } catch {
      parsed = { items: [] };
    }

    // Normalize items into [{ review_index, text }] regardless of model variation
    const rawItems = Array.isArray(parsed?.items) ? parsed.items : [];
    const normalized = rawItems
      .map((it: any, idx: number) => {
        if (typeof it === "string") return { review_index: idx, text: it.trim() };
        if (it && typeof it === "object") {
          const text = typeof it.text === "string" ? it.text.trim() : "";
          const ri = Number.isFinite(Number(it.review_index)) ? Number(it.review_index) : idx;
          return { review_index: ri, text };
        }
        return { review_index: idx, text: "" };
      })
      .filter((it: any) => it.text && it.text.length > 0)
      .map((it: any, idx: number) => ({ review_index: idx, text: it.text.slice(0, 4000) }));

    return jsonRes({ items: normalized });
  } catch (e) {
    console.error("extract-from-image error:", e);
    return jsonRes({ error: "요청을 처리할 수 없습니다." }, 500);
  }
});
  } catch (e) {
    console.error("extract-from-image error:", e);
    return jsonRes({ error: "요청을 처리할 수 없습니다." }, 500);
  }
});
