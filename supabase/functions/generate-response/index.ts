import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-client-source, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

const STYLE_GUIDES: Record<string, string> = {
  thanks: '\n\n[답변 스타일: 감사형] 진심 어린 감사 표현을 강조하고, 따뜻하고 긍정적인 톤으로 작성하세요.',
  apology: '\n\n[답변 스타일: 사과형] 정중한 사과를 우선하고, 책임감 있게 문제를 인정하는 톤으로 작성하세요.',
  simple: '\n\n[답변 스타일: 간단형] 군더더기 없이 핵심만 짧고 명료하게 100자 내외로 작성하세요.',
  principle: '\n\n[답변 스타일: 원칙형] 회사 정책/원칙을 명확하고 일관되게 안내하는 톤으로 작성하세요.',
};

// 플랫폼별 응대 가이드 (각 플랫폼의 사용자층/정책/말투에 맞춘 톤 차별화)
const PLATFORM_GUIDES: Record<string, { name: string; review: string; inquiry: string; claim: string }> = {
  // 오픈마켓: 가격 민감·배송/CS 이슈가 많음 → 절제된 정중함, 빠른 해결 안내
  coupang: {
    name: '쿠팡',
    review: '쿠팡 셀러 톤으로 간결하고 신뢰감 있게. 로켓배송·빠른 발송에 대한 만족 표현이 있다면 자연스럽게 받아 응대하세요.',
    inquiry: '쿠팡 정책상 배송/반품/환불 응대가 빠르고 명확해야 합니다. 처리 절차와 예상 소요시간을 구체적으로 안내하세요.',
    claim: '쿠팡 CS 기준에 맞춰 즉각 사과 + 구체적 보상안(반품/교환/부분환불)을 제시하세요. 책임 회피 표현 금지.',
  },
  '11st': {
    name: '11번가',
    review: '11번가 톤. 정중하고 정성스러운 인사말, 재구매 유도 문구를 자연스럽게 포함하세요.',
    inquiry: '11번가 셀러 응답 가이드에 맞춰 명확하고 격식 있는 어조로 답변하세요.',
    claim: '판매자 중재 절차 가능성을 염두에 두고, 신속한 사과와 합리적 해결 방안을 정중하게 제시하세요.',
  },
  gmarket: {
    name: 'G마켓',
    review: 'G마켓 톤. 격식 있고 단정한 표현으로 감사 인사와 재구매 유도를 작성하세요.',
    inquiry: '정중하고 사무적인 톤으로 정확한 정보를 전달하세요.',
    claim: '판매자 책임 인정 후 환불/교환 절차를 단계별로 안내하세요.',
  },
  auction: {
    name: '옥션',
    review: '옥션 톤. 단정하고 신뢰감 있는 어조로 감사 표현과 재방문 유도를 작성하세요.',
    inquiry: '명확하고 사무적인 톤으로 답변하세요.',
    claim: '신속한 사과와 명확한 해결안을 제시하세요.',
  },
  tmon: {
    name: '티몬',
    review: '티몬 톤. 친근하면서도 정중하게, 딜·할인 만족 언급이 있다면 받아주세요.',
    inquiry: '딜/쿠폰/배송 관련 문의가 많으므로 정확한 적용 조건을 안내하세요.',
    claim: '정중한 사과와 빠른 보상안을 제시하세요.',
  },
  interpark: {
    name: '인터파크',
    review: '인터파크 톤. 격식 있고 정중한 표현을 사용하세요.',
    inquiry: '사무적이고 정확한 톤으로 안내하세요.',
    claim: '책임감 있는 사과와 해결 절차를 안내하세요.',
  },
  tossshopping: {
    name: '토스쇼핑',
    review: '토스쇼핑 톤. 짧고 깔끔하며 친근한 어조로, 핵심만 빠르게 전달하세요. 너무 격식 차린 인사말은 피하세요.',
    inquiry: '짧고 명확한 문장으로 핵심 정보만 빠르게 전달하세요.',
    claim: '간결한 사과와 즉시 해결 가능한 옵션을 제시하세요.',
  },
  // 스토어 운영
  naver: {
    name: '스마트스토어',
    review: '네이버 스마트스토어 톤. 정중하고 친절하게, 톡톡 알림 안내나 재구매 유도를 자연스럽게 포함하세요.',
    inquiry: '정중하고 자세하게 안내하되, 영업 정보(연락처/외부링크) 노출은 피하세요.',
    claim: '진심 어린 사과 + 교환/환불/보상 절차를 단계별로 정중하게 안내하세요.',
  },
  cafe24: {
    name: '카페24 자사몰',
    review: '자사몰 운영자로서 브랜드 보이스를 살려 따뜻하고 개성 있는 톤으로 응대하세요.',
    inquiry: '브랜드 톤을 유지하며 친절하고 자세히 안내하세요. 자사 회원 혜택/적립 안내를 자연스럽게 포함 가능합니다.',
    claim: '브랜드 신뢰도를 지키는 정중한 사과와 적극적인 해결안을 제시하세요.',
  },
  self: {
    name: '자사몰',
    review: '브랜드 보이스를 살려 따뜻하고 개성 있는 톤으로 감사 표현을 작성하세요.',
    inquiry: '브랜드 톤을 유지하며 친절하고 자세히 안내하세요.',
    claim: '브랜드 신뢰를 지키는 정중하고 적극적인 해결안을 제시하세요.',
  },
  // 패션
  musinsa: {
    name: '무신사',
    review: '무신사 톤. 트렌디하고 친근한 어조, 핏/사이즈/소재 만족 표현이 있다면 구체적으로 받아주세요. 너무 격식체는 피하세요.',
    inquiry: '사이즈/핏/소재/배송 문의에 명확히 답변하세요. 친근하지만 정확한 톤을 유지하세요.',
    claim: '쿨하게 사과하고 빠른 교환/반품 절차를 안내하세요. 과도한 격식보다 신속함이 중요합니다.',
  },
  ably: {
    name: '에이블리',
    review: '에이블리 톤. 친근하고 발랄한 어조로 감사 표현, 이모지 1~2개 정도 자연스럽게 사용 가능합니다.',
    inquiry: '친근하고 다정한 톤으로 답변하세요. 사이즈/핏 관련 문의에 구체적으로 답하세요.',
    claim: '진심 어린 사과를 친근한 어조로 표현하고, 빠른 해결안을 제시하세요.',
  },
  zigzag: {
    name: '지그재그',
    review: '지그재그 톤. 트렌디하고 친근한 어조, 20~30대 여성 톤에 맞춘 다정한 표현을 사용하세요.',
    inquiry: '친근하고 다정한 톤으로 사이즈/배송 등을 명확히 안내하세요.',
    claim: '다정한 사과와 함께 빠른 교환/환불 절차를 안내하세요.',
  },
  // 리빙
  ohouse: {
    name: '오늘의집',
    review: '오늘의집 톤. 인테리어/공간 활용 만족도가 핵심. 따뜻하고 감성적인 톤으로 사용 경험을 공감해주세요.',
    inquiry: '제품 사이즈, 색상, 설치, 배송 관련 문의에 정확하고 친절하게 답변하세요.',
    claim: '정중한 사과와 함께 교환/반품/A/S 절차를 명확히 안내하세요.',
  },
  // 배달앱
  baemin: {
    name: '배달의민족',
    review: '배민 톤. 친근하고 위트 있는 어조로 감사 표현. 너무 길지 않게 100자 내외로 짧고 따뜻하게 작성하세요.',
    inquiry: '친근하고 빠른 톤으로 메뉴/배달/포장 문의에 답하세요.',
    claim: '진심 사과 + 구체적 보상(쿠폰/재조리/환불)을 빠르게 제시하세요. 길게 끌지 마세요.',
  },
  yogiyo: {
    name: '요기요',
    review: '요기요 톤. 친근하고 정중하게, 짧고 따뜻한 감사 표현을 작성하세요.',
    inquiry: '친근하고 명확하게 답변하세요.',
    claim: '진심 사과와 빠른 보상안을 제시하세요.',
  },
  coupangeats: {
    name: '쿠팡이츠',
    review: '쿠팡이츠 톤. 짧고 깔끔하며 신뢰감 있게, 빠른 배달 만족 언급을 자연스럽게 받아주세요.',
    inquiry: '간결하고 명확하게 답변하세요.',
    claim: '신속한 사과와 즉시 보상안(환불/재조리)을 제시하세요.',
  },
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

    // 플랜 체크: 확장프로그램은 Basic+ 필요, 답변 스타일도 Basic+ 필요
    const clientSource = req.headers.get("x-client-source");
    const { data: sub } = await adminClient
      .from("subscriptions")
      .select("plan")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    const userPlan = sub?.plan ?? "free";

    if (clientSource === "extension" && userPlan === "free") {
      await adminClient.from("audit_logs").insert({
        user_id: userId,
        action: "extension_access_denied",
        details: { plan: userPlan },
        severity: "warning",
      });
      return jsonRes({ error: "크롬 확장프로그램은 Basic 이상 플랜에서 사용할 수 있습니다." }, 403);
    }

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
    const { type, text, product, energy_cost, style, platform } = await req.json();

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

    // 답변 스타일은 Basic 이상에서만 적용
    const validStyles = ["thanks", "apology", "simple", "principle"];
    let appliedStyle: string | null = null;
    if (style) {
      if (!validStyles.includes(style)) {
        return jsonRes({ error: "잘못된 스타일입니다." }, 400);
      }
      if (userPlan === "free") {
        return jsonRes({ error: "답변 스타일 선택은 Basic 이상 플랜에서 사용할 수 있습니다." }, 403);
      }
      appliedStyle = style;
    }

    // 상품 소유권 검증 (보안: 다른 사용자 상품 사용 차단)
    if (product && typeof product === "object" && product.id) {
      const { data: ownProduct } = await adminClient
        .from("products")
        .select("id")
        .eq("id", product.id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!ownProduct) {
        return jsonRes({ error: "상품 정보가 유효하지 않습니다." }, 403);
      }
    }

    const cost = Number.isFinite(energy_cost) && energy_cost > 0 && energy_cost <= 5 ? energy_cost : 1;

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

    // 사용 보너스 자동 지급 (reward_claims UNIQUE로 중복 방지)
    try {
      const { count: genCount } = await adminClient
        .from('generations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
      const total = (genCount ?? 0) + 1;
      if (total === 1) {
        await adminClient.rpc('claim_reward', { _reward_key: 'first_generation', _amount: 5, _description: '첫 응답 생성 보너스' });
      }
      if (total >= 10) {
        await adminClient.rpc('claim_reward', { _reward_key: 'ten_generations', _amount: 10, _description: '응답 10건 생성 보너스' });
      }
      const { data: usageDates } = await adminClient
        .from('usage').select('date').eq('user_id', userId).order('date', { ascending: false }).limit(3);
      if (usageDates && usageDates.length >= 3) {
        const d = usageDates.map((u: any) => new Date(u.date).getTime());
        if ((d[0] - d[1]) === 86400000 && (d[1] - d[2]) === 86400000) {
          await adminClient.rpc('claim_reward', { _reward_key: 'streak_3day', _amount: 15, _description: '3일 연속 사용 보너스' });
        }
      }
    } catch (_) { /* 보너스 실패는 본 응답에 영향 없음 */ }

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

    // 플랫폼별 응대 가이드 주입
    if (platform && typeof platform === "object" && typeof platform.id === "string") {
      const guide = PLATFORM_GUIDES[platform.id];
      if (guide) {
        const tone = (guide as any)[type] as string | undefined;
        systemPrompt += `\n\n[판매 플랫폼: ${guide.name}]\n${tone ?? ""}\n해당 플랫폼의 사용자층, 정책, 일반적인 응대 톤에 맞춰 답변해주세요.`;
      } else if (platform.id === "other" && typeof platform.label === "string" && platform.label.trim()) {
        systemPrompt += `\n\n[판매 플랫폼: ${platform.label.trim()}]\n해당 플랫폼의 일반적인 고객 응대 관행에 맞춰 자연스럽고 정중하게 답변해주세요.`;
      }
    }

    if (appliedStyle) {
      systemPrompt += STYLE_GUIDES[appliedStyle];
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
