import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { buildCorsHeaders, isOriginAllowed } from "../_shared/cors.ts";

const CORS_HEADERS = {
  allowHeaders:
    "authorization, x-client-info, apikey, content-type, x-client-source, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  allowMethods: "POST, OPTIONS",
};

const PLAN_LIMITS: Record<string, { maxPerDay: number }> = {
  free: { maxPerDay: 20 },
  basic: { maxPerDay: 200 },
  pro: { maxPerDay: 1000 },
};

const PLAN_PER_MINUTE: Record<string, number> = {
  free: 3,
  basic: 10,
  pro: 30,
};

const TYPE_INSTRUCTIONS: Record<string, string> = {
  review: [
    "당신은 한국 이커머스 판매자의 고객 리뷰 답변을 작성하는 전문가입니다.",
    "공손하고 자연스럽게 감사 인사로 시작하세요.",
    "리뷰 내용에 맞는 구체적인 답변을 200자 이내로 작성하세요.",
  ].join("\n"),
  inquiry: [
    "당신은 한국 이커머스 판매자의 고객 문의 답변을 작성하는 전문가입니다.",
    "문의 내용을 정확하게 파악하고, 필요한 안내를 분명하게 설명하세요.",
    "공손하고 명확한 답변을 200자 이내로 작성하세요.",
  ].join("\n"),
  claim: [
    "당신은 한국 이커머스 판매자의 고객 불만 답변을 작성하는 전문가입니다.",
    "먼저 공감과 사과를 전하고, 해결 방법을 책임감 있게 제시하세요.",
    "과도한 변명 없이 250자 이내로 작성하세요.",
  ].join("\n"),
};

const STYLE_GUIDES: Record<string, string> = {
  thanks: "감사 표현을 조금 더 따뜻하고 적극적으로 강화하세요.",
  apology: "사과와 책임 인정을 우선하고 차분한 톤을 유지하세요.",
  simple: "군더더기 없이 짧고 명료하게 작성하세요.",
  principle: "정책과 원칙을 분명히 안내하되 차갑지 않게 설명하세요.",
};

const TONE_GUIDES: Record<string, string> = {
  friendly: "친근하고 다정한 말투로, 이모지는 1개 이내로 자연스럽게 사용하세요.",
  polite: "정중하고 공손한 존댓말 톤을 유지하세요.",
  professional: "전문적이고 신뢰감 있는 비즈니스 톤으로 작성하세요.",
  apology: "사과와 책임 인정을 우선하는 차분한 톤을 유지하세요.",
  firm: "정책에 따라 단호하지만 무례하지 않게 명확히 안내하세요.",
  humor: "가벼운 위트를 살짝 더해 친근하게 작성하세요. 단, 클레임에서는 사용 금지.",
};

const CATEGORY_GUIDES: Record<string, Record<string, string>> = {
  fashion: { rule: "사이즈/색상/소재 표현은 제품 라벨 기준으로 안내. 효능 표현 금지." },
  food: { rule: "효능·효과·치료 표현 금지. 알러지 정보는 신중히 안내." },
  beauty: { rule: "의약품 오인 표현(치료/완치) 금지. 개인차 안내 권장." },
  electronics: { rule: "제품 사양은 정확히, 보증/AS 정책을 명확히 안내." },
  living: { rule: "사용 환경에 따른 차이를 안내. 안전 주의사항 권장." },
  pet: { rule: "수의학적 진단/치료 표현 금지. 수의사 상담 권유 가능." },
  baby: { rule: "안전 인증 강조. 의약 효능 표현 금지." },
  digital: { rule: "환불·교환 정책(콘텐츠 특성)을 명확히 안내." },
  other: { rule: "" },
};

const INQUIRY_CATEGORY_HINT: Record<string, string> = {
  shipping: "배송 일정/방법에 대한 명확한 안내를 우선하세요.",
  exchange: "교환 절차와 비용 부담 주체를 명확히 안내하세요.",
  refund: "환불 절차/소요 기간/조건을 명확히 안내하세요.",
  size: "사이즈 가이드/측정 방법을 친절히 안내하세요.",
  stock: "재고 상황과 입고 예정을 명확히 안내하세요.",
  usage: "사용법을 단계별로 알기 쉽게 안내하세요.",
  other: "문의 핵심을 정확히 파악해 답변하세요.",
};

const COMPENSATION_LABEL: Record<string, string> = {
  reship: "재발송",
  partial_refund: "부분환불",
  full_refund: "전액환불",
  coupon: "쿠폰 제공",
  none: "별도 보상 없음(정중한 사과 중심)",
};

function jsonResponse(data: Record<string, unknown>, corsHeaders: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildPrompt(input: {
  type: string;
  text: string;
  style: string | null;
  product: any;
  platform: any;
  tone?: string | null;
  business_category?: string | null;
  review?: { rating?: number | null; nickname?: string | null } | null;
  inquiry?: { category?: string | null; slots?: Record<string, string> | null } | null;
  claim?: { severity?: string | null; compensations?: string[] | null } | null;
}) {
  const sections = [TYPE_INSTRUCTIONS[input.type] || TYPE_INSTRUCTIONS.review];

  if (input.product?.name) {
    sections.push(
      [
        "[상품 정보]",
        `상품명: ${input.product.name}`,
        input.product.category ? `카테고리: ${input.product.category}` : null,
        input.product.note ? `참고사항: ${input.product.note}` : null,
      ].filter(Boolean).join("\n"),
    );
  }

  if (input.business_category && CATEGORY_GUIDES[input.business_category]?.rule) {
    sections.push(`[업종 가이드: ${input.business_category}]\n${CATEGORY_GUIDES[input.business_category].rule}`);
  }

  if (input.platform?.label || input.platform?.id) {
    sections.push(
      `[판매 플랫폼]\n${input.platform.label || input.platform.id} 플랫폼의 톤과 고객 기대에 맞춰 답변하세요.`,
    );
  }

  if (input.tone && TONE_GUIDES[input.tone]) {
    sections.push(`[답변 톤]\n${TONE_GUIDES[input.tone]}`);
  }

  if (input.style && STYLE_GUIDES[input.style]) {
    sections.push(`[답변 스타일]\n${STYLE_GUIDES[input.style]}`);
  }

  if (input.type === "review" && input.review) {
    const lines: string[] = [];
    if (input.review.rating) {
      const r = Math.max(1, Math.min(5, Number(input.review.rating)));
      lines.push(`별점: ${r}/5 (${r <= 2 ? "부정 → 사과 우선" : r === 3 ? "중립 → 개선 의지" : "긍정 → 감사 강화"})`);
    }
    if (input.review.nickname) {
      lines.push(`고객 호칭: ${input.review.nickname.trim()}님 (답변 첫머리에 자연스럽게 사용)`);
    }
    if (lines.length) sections.push(`[리뷰 컨텍스트]\n${lines.join("\n")}`);
  }

  if (input.type === "inquiry" && input.inquiry) {
    const lines: string[] = [];
    if (input.inquiry.category && INQUIRY_CATEGORY_HINT[input.inquiry.category]) {
      lines.push(`문의 유형: ${input.inquiry.category} — ${INQUIRY_CATEGORY_HINT[input.inquiry.category]}`);
    }
    const slots = input.inquiry.slots || {};
    const slotLabels: Record<string, string> = {
      ship_date: "발송일",
      restock_date: "재입고 예정일",
      tracking_no: "운송장 번호",
      cs_phone: "CS 연락처",
      business_hours: "영업시간",
    };
    const filledSlots = Object.entries(slots)
      .filter(([_, v]) => typeof v === "string" && v.trim().length > 0)
      .map(([k, v]) => `- ${slotLabels[k] || k}: ${String(v).trim()}`);
    if (filledSlots.length) {
      lines.push("아래 정보를 답변에 자연스럽게 포함하세요:");
      lines.push(...filledSlots);
    }
    if (lines.length) sections.push(`[문의 컨텍스트]\n${lines.join("\n")}`);
  }

  if (input.type === "claim" && input.claim) {
    const lines: string[] = [];
    const sev = input.claim.severity;
    if (sev === "high") {
      lines.push("심각도: 높음 — 강한 사과와 책임자 직접 연결 안내를 포함하세요.");
    } else if (sev === "low") {
      lines.push("심각도: 낮음 — 가벼운 사과와 빠른 해결 안내 중심으로 작성하세요.");
    } else if (sev === "normal") {
      lines.push("심각도: 보통 — 정중한 사과와 명확한 해결 절차를 안내하세요.");
    }
    const comps = (input.claim.compensations || []).filter((c) => COMPENSATION_LABEL[c]);
    if (comps.length) {
      lines.push(`제안할 보상안: ${comps.map((c) => COMPENSATION_LABEL[c]).join(", ")}`);
      lines.push("위 보상안을 답변에 자연스럽게 제시하세요.");
    }
    if (lines.length) sections.push(`[클레임 컨텍스트]\n${lines.join("\n")}`);
  }

  sections.push("출력은 답변 본문만 반환하세요. 변수 자리표시자({...})는 절대 출력에 남기지 마세요.");
  return sections.join("\n\n");
}


async function grantMilestoneRewards(adminClient: ReturnType<typeof createClient>, userId: string) {
  try {
    const { count: generationCount } = await adminClient
      .from("generations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    const total = (generationCount ?? 0) + 1;
    if (total === 1) {
      await adminClient.rpc("claim_reward", {
        _reward_key: "first_generation",
        _amount: 5,
        _description: "첫 응답 생성 보상",
      });
    }
    if (total >= 10) {
      await adminClient.rpc("claim_reward", {
        _reward_key: "ten_generations",
        _amount: 10,
        _description: "응답 10회 생성 보상",
      });
    }

    const { data: usageDates } = await adminClient
      .from("usage")
      .select("date")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(3);

    if (usageDates && usageDates.length >= 3) {
      const days = usageDates.map((entry: any) => new Date(entry.date).getTime());
      if ((days[0] - days[1]) === 86400000 && (days[1] - days[2]) === 86400000) {
        await adminClient.rpc("claim_reward", {
          _reward_key: "streak_3day",
          _amount: 15,
          _description: "3일 연속 사용 보상",
        });
      }
    }
  } catch (_) {
    // Reward failures must not fail the main response path.
  }
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = buildCorsHeaders(origin, CORS_HEADERS);
  let reservationId: string | null = null;
  let reservationCompleted = false;

  const respond = (data: Record<string, unknown>, status = 200) => {
    if (!Object.prototype.hasOwnProperty.call(data, "reservation_id")) {
      data.reservation_id = reservationId;
    }
    return jsonResponse(data, corsHeaders, status);
  };

  if (req.method === "OPTIONS") {
    if (origin && !isOriginAllowed(origin)) {
      return new Response("forbidden", { status: 403, headers: corsHeaders });
    }
    return new Response(null, { headers: corsHeaders });
  }

  if (origin && !isOriginAllowed(origin)) {
    return respond({ error: "Origin not allowed.", reservation_id: null }, 403);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return respond({ error: "Authentication required.", reservation_id: null }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;
    if (claimsError || !userId) {
      return respond({ error: "Invalid authentication.", reservation_id: null }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await adminClient
      .from("profiles")
      .select("suspended")
      .eq("user_id", userId)
      .single();

    if (!profile) {
      return respond({ error: "Profile not found.", reservation_id: null }, 404);
    }
    if (profile.suspended) {
      return respond({ error: "Account is suspended.", reservation_id: null }, 403);
    }

    const requestBody = await req.json().catch(() => null);
    const { type, text, product, energy_cost, style, platform } = requestBody ?? {};

    if (!type || typeof text !== "string") {
      return respond({ error: "Missing required fields.", reservation_id: null }, 400);
    }
    if (!["review", "inquiry", "claim"].includes(type)) {
      return respond({ error: "Invalid response type.", reservation_id: null }, 400);
    }
    if (text.length === 0 || text.length > 5000) {
      return respond({ error: "Invalid text length.", reservation_id: null }, 400);
    }

    const { data: subscription } = await adminClient
      .from("subscriptions")
      .select("plan")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    const userPlan = subscription?.plan ?? "free";
    const perMinuteLimit = PLAN_PER_MINUTE[userPlan] ?? PLAN_PER_MINUTE.free;
    const perDayLimit = PLAN_LIMITS[userPlan]?.maxPerDay ?? PLAN_LIMITS.free.maxPerDay;
    const validStyles = ["thanks", "apology", "simple", "principle"];
    const appliedStyle = typeof style === "string" ? style : null;

    if (appliedStyle && !validStyles.includes(appliedStyle)) {
      return respond({ error: "Invalid style.", reservation_id: null }, 400);
    }
    if (appliedStyle && userPlan === "free") {
      return respond({ error: "Style selection requires a paid plan.", reservation_id: null }, 403);
    }

    const clientSource = req.headers.get("x-client-source");
    if (clientSource === "extension" && userPlan === "free") {
      await adminClient.from("audit_logs").insert({
        user_id: userId,
        action: "extension_access_denied",
        details: { plan: userPlan },
        severity: "warning",
      });
      return respond({ error: "Extension access requires a paid plan.", reservation_id: null }, 403);
    }

    if (product && typeof product === "object" && product.id) {
      const { data: ownProduct } = await adminClient
        .from("products")
        .select("id")
        .eq("id", product.id)
        .eq("user_id", userId)
        .maybeSingle();

      if (!ownProduct) {
        return respond({ error: "Product access denied.", reservation_id: null }, 403);
      }
    }

    const { data: planLimitData } = await userClient.rpc("check_plan_rate_limit", { _action: "generate" });
    const planLimit = planLimitData as any;
    if (planLimit?.allowed === false) {
      return respond({
        error: planLimit.reason === "day"
          ? `Daily limit exceeded (${planLimit.limit}).`
          : `Per-minute limit exceeded (${planLimit.limit}).`,
        plan: planLimit.plan,
        reservation_id: null,
      }, 429);
    }

    const cost = Number.isFinite(energy_cost) && energy_cost > 0 && energy_cost <= 5 ? energy_cost : 1;

    const cachePayload = JSON.stringify({
      type,
      text: text.trim(),
      style: appliedStyle,
      product_id: product?.id ?? null,
      platform_id: platform?.id ?? null,
    });
    const cacheDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(cachePayload));
    const cacheKey = Array.from(new Uint8Array(cacheDigest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    const { data: cachedResponse } = await adminClient
      .from("ai_response_cache")
      .select("id, response")
      .eq("user_id", userId)
      .eq("cache_key", cacheKey)
      .gt("expire_at", new Date().toISOString())
      .maybeSingle();

    if (cachedResponse?.response) {
      await adminClient
        .from("ai_response_cache")
        .update({ expire_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString() })
        .eq("id", cachedResponse.id);

      return respond({ response: cachedResponse.response, cached: true, reservation_id: null });
    }

    const { data: reservationData } = await userClient.rpc("reserve_generate_request", {
      _max_per_second: 2,
      _per_min: perMinuteLimit,
      _per_day: perDayLimit,
    });
    const reservation = reservationData as any;

    if (!reservation?.allowed || !reservation?.reservation_id) {
      return respond({
        error: reservation?.reason === "day"
          ? `Daily limit exceeded (${reservation?.limit ?? perDayLimit}).`
          : reservation?.reason === "minute"
            ? `Per-minute limit exceeded (${reservation?.limit ?? perMinuteLimit}).`
            : "Too many requests.",
        plan: userPlan,
        reservation_id: null,
      }, 429);
    }

    reservationId = reservation.reservation_id as string;

    const completeReservation = async (
      status: "success" | "failed" | "failed_timeout" | "failed_refund",
      errorCode?: string,
    ) => {
      await userClient.rpc("complete_generate_request", {
        _reservation_id: reservationId,
        _status: status,
        _error_code: errorCode ?? null,
      });
      reservationCompleted = true;
    };

    const refundEnergy = async () => {
      const { data: claimData } = await userClient.rpc("try_claim_generate_refund", {
        _reservation_id: reservationId,
      });

      const claimed = (claimData as any)?.claimed === true;
      if (!claimed) {
        await completeReservation("failed", "refund_already_handled");
        return { ok: true };
      }

      try {
        const { data: refundData, error: refundError } = await userClient.rpc("refund_energy", {
          _amount: cost,
          _reason: type,
          _description: "AI 응답 생성 실패 환불",
        });

        const refundOk = !refundError && (refundData as any)?.success === true;
        const refundReason = refundOk ? null : ((refundData as any)?.error ?? refundError?.message ?? "refund_failed");

        await userClient.rpc("complete_generate_refund", {
          _reservation_id: reservationId,
          _refunded: refundOk,
          _refund_error: refundReason,
        });

        if (!refundOk) {
          await adminClient.from("audit_logs").insert({
            user_id: userId,
            action: "generate_refund_failed",
            details: {
              reservation_id: reservationId,
              type,
              energy_cost: cost,
              refund_error: refundReason,
            },
            severity: "error",
          });
          await completeReservation("failed_refund", "refund_failed");
          return { ok: false };
        }
      } catch (error) {
        await adminClient.from("audit_logs").insert({
          user_id: userId,
          action: "generate_refund_failed",
          details: {
            reservation_id: reservationId,
            type,
            energy_cost: cost,
            refund_error: error instanceof Error ? error.message : "refund_exception",
          },
          severity: "error",
        });
        await completeReservation("failed_refund", "refund_exception");
        return { ok: false };
      }

      await completeReservation("failed", "ai_failed_refunded");
      return { ok: true };
    };

    const { data: spendData, error: spendError } = await userClient.rpc("spend_energy", {
      _amount: cost,
      _reason: type,
      _description: `${type} response generation`,
    });

    const spendResult = spendData as any;
    if (spendError) {
      await completeReservation("failed", "spend_error");
      return respond({ error: "Failed to spend energy." }, 500);
    }
    if (!spendResult?.success) {
      await completeReservation(
        "failed",
        spendResult?.error === "Insufficient energy" ? "insufficient_energy" : "spend_failed",
      );
      return respond({
        error: spendResult?.error === "Insufficient energy" ? "Insufficient energy." : "Unable to spend energy.",
      }, 403);
    }

    await userClient.rpc("increment_usage");

    await adminClient.from("audit_logs").insert({
      user_id: userId,
      action: "generate",
      details: {
        type,
        text_length: text.length,
        energy_cost: cost,
        reservation_id: reservationId,
      },
      severity: "info",
    });

    await grantMilestoneRewards(adminClient, userId);

    if (!lovableApiKey) {
      await completeReservation("failed", "missing_api_key");
      return respond({ error: "AI service is unavailable." }, 500);
    }

    const systemPrompt = buildPrompt({
      type,
      text,
      style: appliedStyle,
      product,
      platform,
    });

    let aiResponse: Response;
    try {
      aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
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
    } catch (error) {
      const refundResult = await refundEnergy();
      console.error("AI gateway network error:", error);
      if (!refundResult.ok) {
        return respond({ error: "AI failed and refund verification failed." }, 500);
      }
      return respond({ error: "AI request failed and energy was refunded." }, 502);
    }

    if (!aiResponse.ok) {
      const refundResult = await refundEnergy();
      console.error("AI gateway error:", aiResponse.status);
      if (!refundResult.ok) {
        return respond({ error: "AI failed and refund verification failed." }, 500);
      }
      return respond({
        error: aiResponse.status === 429 ? "AI rate limit exceeded and energy was refunded." : "AI generation failed and energy was refunded.",
      }, aiResponse.status === 429 ? 429 : 500);
    }

    const aiData = await aiResponse.json().catch(() => ({}));
    const responseText = aiData?.choices?.[0]?.message?.content;
    if (!responseText || typeof responseText !== "string") {
      const refundResult = await refundEnergy();
      if (!refundResult.ok) {
        return respond({ error: "AI failed and refund verification failed." }, 500);
      }
      return respond({ error: "AI returned an empty response and energy was refunded." }, 500);
    }

    try {
      await adminClient.from("ai_response_cache").upsert({
        user_id: userId,
        cache_key: cacheKey,
        response: responseText,
        expire_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      }, { onConflict: "user_id,cache_key" });
    } catch (_) {
      // Cache write failures must not fail the main response path.
    }

    await completeReservation("success");
    return respond({ response: responseText });
  } catch (error) {
    console.error("generate-response error:", error);

    if (reservationId && !reservationCompleted) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const authHeader = req.headers.get("Authorization");

        if (authHeader?.startsWith("Bearer ")) {
          const fallbackClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
          });
          await fallbackClient.rpc("complete_generate_request", {
            _reservation_id: reservationId,
            _status: "failed",
            _error_code: "unexpected_error",
          });
        }
      } catch (_) {
        // Ignore fallback completion errors.
      }
    }

    return respond({ error: "Unable to process the request." }, 500);
  }
});
