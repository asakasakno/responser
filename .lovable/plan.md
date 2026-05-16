# 보안 보완 2차 작업 계획

요청하신 5개 영역을 점검한 결과와 구현 범위입니다. **코드 수정 전에 범위/의사결정을 먼저 확정**하기 위한 계획안입니다.

---

## 1. 현재 보안 스캐너가 잡은 3건 (이번에 같이 처리)

| 파일 | 문제 | 처리 |
|---|---|---|
| `supabase/functions/complete-kakao-email/index.ts` L114 | catch에서 `e.message` 그대로 응답 | 일반 메시지로 교체 + `console.error` |
| `supabase/functions/identity-links/index.ts` L94/155/212/221 | Supabase 에러 메시지 4곳 그대로 응답 | 일반 메시지 + `console.error` |
| `supabase/functions/import-beta-application/index.ts` L219-221 | `?secret=` 쿼리스트링으로 시크릿 수신 가능 (로그 노출 위험) | 헤더 전용으로 변경, 쿼리 fallback 제거 |

→ 같이 처리하고, `BETA_IMPORT_SECRET`은 **사용자가 직접 로테이션**해야 함 (안내)

---

## 2. Sentry 도입 — 프론트엔드

### 패키지 / 구조
- `@sentry/react` 설치
- `src/lib/sentry.ts` 신규 — `initSentry()` 함수 export
- `src/main.tsx`에서 init 호출
- `src/App.tsx`에 ErrorBoundary 1단계만 감싸기 (기존 UI 영향 없게)

### 활성화 조건
```ts
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) initSentry()
```
- 개발환경: 비활성 (console.error 유지)
- DSN 없음: 비활성 (조용히 skip)

### `beforeSend` 필터 (필수 14종)
요청하신 항목 전부 + 추가 안전장치:
1. `event.request.headers` 에서 `authorization`, `cookie`, `x-supabase-*`, `apikey` 제거
2. `event.request.cookies` 통째로 삭제
3. `event.user` 에서 `email`, `ip_address` 제거 (id만 유지, 그것도 hash)
4. URL/breadcrumb에서 `access_token`, `refresh_token`, `paymentKey`, `orderId`, `code=`, `state=` query 마스킹
5. `event.extra` / `event.contexts` / `breadcrumbs.data` 재귀 순회하며 키 이름이 다음에 매칭되면 `[REDACTED]`:
   - `password`, `token`, `secret`, `apikey`, `api_key`, `service_role`, `authorization`
   - `payment_key`, `paymentkey`, `card_number`, `cvc`
   - `email`, `phone`, `address`, `birth`
   - `review_text`, `inquiry_text`, `original_text`, `content`, `message`, `body`
6. 값이 32자 이상 base64/hex 패턴이면 마스킹
7. `event.message` / `exception.value`에서 이메일/JWT 정규식으로 마스킹

### 에러 캡처 헬퍼
`src/lib/errorReporter.ts` — 앱 코드에서 직접 호출:
```ts
reportError(err, { feature: 'generate_response', input_length: 384, user_plan: 'free', error_code: 'GENERATION_FAILED' })
```
- 원문(리뷰/문의) 절대 전달 금지 — 길이/카테고리만
- DSN 없으면 dev에서 console.error로 fallback

### 적용 지점 (최소)
- `Generate.tsx` catch (기존 일반 메시지 유지, Sentry 호출만 추가)
- `Checkout.tsx` 결제 실패 catch
- `Auth.tsx` 로그인 실패 (단, "비밀번호가 틀렸습니다" 같은 정상 실패는 skip)
- ErrorBoundary가 잡는 React 런타임 에러

---

## 3. Sentry — Edge Function 측

**현재 Supabase Edge Function용 Sentry SDK는 Deno에서 안정 동작 보장이 약함.**
대신:
- 모든 Edge Function의 fatal catch에서 **`console.error` + `audit_logs` insert** 패턴 유지 (이미 대부분 적용됨)
- 누락된 곳만 보강:
  - `complete-kakao-email`: console.error 이미 있음 → 응답만 일반화
  - `identity-links`: console.error 보강
  - `generate-response`, `purchase-energy`, `toss-confirm`, `validate-coupon`, `claim-reward`, `admin`, `import-beta-application`, `download-extension` — 이미 audit_logs/console.error 패턴 있음. 응답 메시지만 점검

> **Edge Function에 Sentry SDK를 정식 도입하지 않는 이유**: Deno 환경에서의 안정성 + cold start 비용 + 이미 audit_logs로 추적 가능. 추후 필요 시 별도 작업으로.

---

## 4. IP 기반 rate limit — 현황 및 최소 추가 구현

### 이미 보호되는 항목 (추가 작업 불필요)
| 엔드포인트 | 현재 보호 |
|---|---|
| 로그인 시도 | Supabase Auth가 IP+이메일 기준 자체 rate limit + 6회 실패 시 잠금 |
| AI 생성 | `reserve_generate_request` (user_id 기준 second/min/day) + reservation idempotency |
| 결제 승인 | `finalize_energy_purchase` idempotency (order_id 기준), Toss 자체 중복 방지 |
| 쿠폰 검증 | `validate_coupon` RPC, 사용 시 `coupon_usages` unique 제약 |
| 관리자 API | `has_role` 검증 + step-up + audit_logs 광범위 기록 |
| 확장 다운로드 | 짧은 시간 다운로드 자체는 부담 없음, storage 자체 제한 |

### 추가 구현 (최소)
신규 RPC `public.check_ip_rate_limit(_action text, _ip_hash text, _max_per_window int, _window_seconds int)` 만들어서:
- `audit_logs`에 `details->>'ip_hash'` 기반으로 카운트
- 결과 jsonb 반환

적용 대상 2곳만:
1. **`import-beta-application`** — IP+UA 해시 기준 10분당 5회
2. **`contact-inquiry`가 따로 없으면** Contact 페이지가 직접 `contact_inquiries` insert → user_id 기준 RLS는 있지만 IP 기록 없음. 트리거 또는 RPC로 IP hash 기록 후 10분당 5회 제한 추가

> **익명 호출 가능한 함수만 IP rate limit이 의미 있음.** 인증된 사용자는 user_id로 이미 충분.

**IP 처리 규칙:**
- `x-forwarded-for` 첫 값 + UA를 SHA-256 hash → `ip_hash` 컬럼으로만 저장 (원본 IP 저장 금지)
- 모바일 NAT 고려해서 window 넉넉히 (10분/5회 = 일반 사용자 영향 거의 없음)
- 초과 시 HTTP 429 + `{ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }`

---

## 5. Abuse 로그 점검 결과

| 항목 | 현재 기록 | 보완 |
|---|---|---|
| 짧은 시간 생성 반복 | `reserve_generate_request` 자동 차단 + audit_logs | 충분 |
| 권한 없는 admin 접근 | `AdminGuard` + admin Edge Function 모두 audit_logs | 충분 |
| 쿠폰 반복 시도 | `validate_coupon` audit 있음 | 충분 |
| 결제 승인 반복 | order_id idempotency + audit | 충분 |
| 베타 신청 반복 | 미기록 | **이번 추가** |
| 실패 로그인 | Supabase Auth 측 자동 | 충분 |
| 정지 사용자 호출 | RLS로 차단되지만 audit 미흡 | 보강 (admin 함수만) |
| 비정상 긴 입력 | RLS CHECK + RPC 검증 일부 | 보강 (contact, generate) |

저장 시 마스킹 규칙 (`src/lib/masking.ts` 기존 활용):
- IP → SHA-256 hash 8자
- 입력 원문 → 길이만 (`{ input_length: 384 }`)
- 결제 키 → 앞 4 + 뒤 4

---

## 6. 의사결정 필요 — 답변 부탁드립니다

| # | 항목 | 옵션 |
|---|---|---|
| Q1 | **Sentry DSN** | (a) 지금 코드만 추가하고 DSN은 나중에 본인이 `VITE_SENTRY_DSN` 입력 / (b) 지금 같이 DSN 받아서 setup |
| Q2 | **Sentry 패키지** | `@sentry/react` (권장, ~50KB gzip) — 추가해도 되는지 |
| Q3 | **Edge Function Sentry** | (a) 도입 안 함 (audit_logs 유지, 권장) / (b) 그래도 도입 시도 |
| Q4 | **BETA_IMPORT_SECRET 로테이션** | 쿼리 파라미터 fallback 제거 후, 시크릿도 같이 새로 발급할지 (별도 화면에서 사용자가 직접) |
| Q5 | **Contact form IP rate limit** | Contact.tsx 현재 어떻게 동작하는지 먼저 확인 후 진행 — 진행 OK? |

---

## 7. 작업 순서 (승인 후)

1. 스캐너 3건 즉시 수정 (kakao-email, identity-links, beta-import 쿼리 fallback 제거)
2. `@sentry/react` 설치 + `src/lib/sentry.ts` + `src/lib/errorReporter.ts`
3. `main.tsx`/`App.tsx`에 ErrorBoundary
4. `Generate.tsx`/`Checkout.tsx`/`Auth.tsx`에 `reportError` 호출
5. 마이그레이션 — `check_ip_rate_limit` RPC + `audit_logs.details` 인덱스 (ip_hash JSONB GIN)
6. `import-beta-application`에 IP rate limit 적용
7. (Q5 OK 시) Contact 흐름에 IP rate limit
8. `.env.example`에 `VITE_SENTRY_DSN` 추가
9. `npm run build` 검증
10. 결과 보고
