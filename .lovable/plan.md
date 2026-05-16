# 보안 점검 결과 및 보완 계획

요청하신 12개 영역을 현재 코드 기준으로 점검한 결과입니다. 대부분 이미 적용되어 있고, 일부만 보완이 필요합니다. **코드 수정 전에 범위를 확정**하기 위한 계획안입니다.

---

## 1. 이미 적용되어 있는 보안 (수정 불필요)

| 영역 | 현재 상태 |
|---|---|
| **하드코딩 시크릿** | src/extension 전체 스캔 결과 service_role/Toss secret/OpenAI key 노출 **없음**. anon key만 클라이언트에 존재 (정상) |
| **관리자 라우트** | `AdminGuard` → `current_user_has_role('admin')` RPC로 서버 검증. URL만으로 접근 불가 |
| **관리자 Edge Function** | `supabase/functions/admin/index.ts` 내부에서 `user_roles` 재검증 + `step-up` 인증 + `audit_logs` 기록 |
| **RLS** | 모든 핵심 테이블(profiles, generation_logs, payments, energy_grants, subscriptions, user_roles 등) RLS 활성, user_id 기반 정책 |
| **에너지/플랜/역할 직접 조작 차단** | `energy_grants`, `subscriptions`, `user_roles`, `payments`, `coupon_usages`, `reward_claims` 모두 사용자 INSERT/UPDATE/DELETE 차단. RPC만 가능 |
| **결제 보안** | `purchase-energy`에서 금액/orderId/paymentKey 서버 재검증, `finalize_energy_purchase` RPC로 원자적 처리, idempotency 적용 |
| **중복 클릭/Rate limit** | `reserve_generate_request` RPC가 per-second/minute/day 제한 + reservation으로 idempotency. `check_plan_rate_limit`도 존재 |
| **RPC 권한** | 직전 마이그레이션에서 `generate_request` 계열 4개 함수의 anon EXECUTE 회수 완료. `SECURITY DEFINER` + `search_path = public` 고정 |
| **audit_logs** | 로그인 실패/관리자 접근/결제/이상감지 등 광범위하게 기록 중 |
| **입력 검증 (서버)** | `contact_inquiries` RLS에 길이 제한 CHECK, RPC들에 amount/length 검증 존재 |
| **확인 모달** | StepUpDialog로 관리자 위험 액션 재인증 적용 |

## 2. 보완이 필요한 항목 (이번에 수정 제안)

### A. `.env.example` 파일 추가 (현재 없음)
- 신규 개발자/배포자가 어떤 변수가 필요한지 알 수 있도록 placeholder 파일 생성
- 실제 값 없이 키 이름만, secret/anon 구분 주석 포함

### B. 프론트 에러 메시지 점검 (가벼운 보강)
- `error.message` 그대로 toast에 노출하는 케이스가 일부 페이지(Checkout, Generate)에 남아있을 가능성 → 일반화된 한국어 메시지로 교체
- 단, 사용자 입력 검증성 메시지(예: "쿠폰 코드를 확인해주세요")는 유지

### C. Sentry/에러 모니터링
- 현재 **미적용**
- 도입 시 `VITE_SENTRY_DSN` 환경변수 + `beforeSend`에서 Authorization 헤더/이메일/카드정보 필터링 필요
- → **이건 별도 의사결정 필요** (Sentry 계정/DSN 발급, 유료 플랜). 아래 질문 참고

### D. SECURITY DEFINER 함수 search_path 점검
- 현재 함수들 대부분 `SET search_path = public` 적용됨. linter의 0029 경고는 모두 "인증 사용자가 호출 가능"인데, 이는 `spend_energy`, `claim_reward` 같이 **설계상 사용자가 호출해야 하는 함수**라 무시 가능 (보안 메모에 사유 기록)

## 3. 수정하지 않는 것 (의도된 설계)

- **0029 linter 경고 16건**: 모두 `spend_energy`, `claim_reward`, `redeem_energy_coupon`, `validate_coupon` 등 인증 사용자가 호출해야 정상 동작하는 RPC. SECURITY DEFINER는 RLS 우회를 위해 필요. → `security_memory`에 사유 기록 후 ignore
- 클라이언트에 노출된 `VITE_SUPABASE_PUBLISHABLE_KEY`: 의도된 공개 키 (RLS로 보호)

## 4. 이번 작업에서 수행할 변경

1. `.env.example` 생성 (placeholder만, 실제 값 없음)
2. `Generate.tsx`, `Checkout.tsx`에서 `error.message` 직접 노출 케이스 일반화 (있다면)
3. `security_memory` 업데이트 — 0029 warning 16건에 대해 "사용자 호출 RPC, 설계상 의도됨" 사유 기록 후 ignore 처리
4. `npm run build` 검증

## 5. 의사결정이 필요한 항목 (답변 부탁드립니다)

| 항목 | 옵션 |
|---|---|
| **Sentry 도입** | (a) 지금 코드만 넣고 DSN은 나중에 입력 / (b) 도입 보류 / (c) Sentry 대신 Supabase 자체 로그만 사용 |
| **IP 기반 rate limit** | 현재 user_id 기준만. IP 기준은 Edge Function에서 `x-forwarded-for` 헤더로 추가 가능하나 모바일 통신사 IP 공유 이슈 있음. 도입할지 |
| **에러 메시지 일반화 적용 범위** | (a) 결제 페이지만 / (b) 전체 사용자 페이지 일괄 |

---

**진행 방식 제안**: 위 "4. 이번 작업에서 수행할 변경"만 먼저 진행하고, 5번 질문 답변 후 추가 작업하는 게 안전합니다. 동의하시면 바로 진행하겠습니다.