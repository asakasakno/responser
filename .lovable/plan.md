# 작업 설계안

두 개의 큰 요청을 함께 정리했습니다. 승인 후 **A → B 순서**로 구현합니다. B는 명시적으로 "먼저 설계안만"이라고 하셨고, A도 영향 범위가 커서 함께 합의한 뒤 진행하는 것이 안전합니다.

---

## A. 이미지 배치 처리: "이미지 단위" → "리뷰 단위" 전환

### 핵심 변경 요지
- 한 이미지에서 OCR이 리뷰 N개를 분리 추출
- 추출된 모든 리뷰를 모아 **5개 묶음 batch generate**
- UI/진행률/로그/에너지 차감 모두 **리뷰 수 기준**으로 통일

### 변경 파일
1. **`supabase/functions/extract-from-image/index.ts`**
   - 응답을 `{ items: [{ review_index, text }] }` 배열로 변경
   - 프롬프트를 "이미지 안 모든 리뷰 카드(닉네임/별점/날짜/본문 단위)를 각각 분리" 지시로 교체
   - 빈 배열 허용, 부분 추출 허용
   - 기존 단일 텍스트 응답을 사용하는 호출자가 있는지 확인 후 호환 유지(필요 시 `legacyText` 동시 반환)

2. **`supabase/functions/generate-response/index.ts`**
   - `mode: 'batch'` 분기 추가: `items: [{index, text}]` 입력 → `[{index, reply}]` 배열 반환
   - 모델에 JSON 배열 강제, 파싱 실패 시 호출자가 single-fallback 하도록 명확한 오류
   - 톤/플랫폼/제품 컨텍스트는 기존 single 모드와 동일하게 적용

3. **`src/components/generate/ImageBatchPanel.tsx`** (대규모 리팩터)
   - 자료구조 도입:
     ```
     QueueImage { id, file, previewUrl, status, extractedReviews: ExtractedReview[] }
     ExtractedReview { id, sourceImageId, sourceImageIndex, reviewIndex,
                       text, reply?, logId?, status, errorMessage? }
     ```
   - 처리 파이프라인 3단계 분리:
     1. OCR (이미지 동시 3개) → `extractedReviews` 채우기
     2. Batch generate (리뷰 5개 묶음, 동시 2 batch)
     3. 결과 렌더링/로그 저장
   - JSON 파싱 실패 batch는 single 모드 fallback 재호출
   - 실패 리뷰 단위 "재시도" 버튼
   - 에너지 차감: **성공한 reply 수만큼** RPC 호출 (이미지 수 아님)
   - generation_logs insert: 리뷰 1개당 1 row, `image_batch_id`/`image_index`/`review_index` 채움, `original_review`는 `maskPII()` 적용
   - 썸네일 카드 하단 "추출 리뷰 N개" 라벨
   - 결과 영역: `[이미지 #i - 리뷰 #j]` 헤더 + 원문/답변/복사/수정/👍/👎
   - 전체 복사: 모든 reply를 `[답변 #N]` 포맷으로 결합

4. **`src/components/generate/SmoothProgress.tsx`** (소폭 확장)
   - 단계 메시지에 `(2/5장)`, `(3/7개 완료)` 같은 동적 카운터 주입 가능하도록 props 추가
   - 퍼센트 계산: OCR 30% + 생성 70% 가중, 생성 단계는 리뷰 수 기준

5. **`src/pages/Generate.tsx`**
   - 상단 요약 줄 추가: "이미지 N장 / 추출 리뷰 M개 / 답변 K/M개"
   - 에너지 안내: OCR 전 "예상 N⚡", OCR 후 "확정 M⚡"

### 데이터베이스
- `generation_logs.review_index` 컬럼 추가 (integer, nullable)
- 기존 `image_batch_id`, `image_index`, `source` 컬럼은 그대로 사용

### 실패 처리 매트릭스
| 상황 | 처리 |
|---|---|
| 이미지 OCR 실패 | 해당 이미지만 `failed`, 다른 이미지 계속 |
| 일부 리뷰만 추출 | 추출된 것만 다음 단계로 |
| Batch JSON 파싱 실패 | 해당 batch만 single fallback |
| 개별 리뷰 생성 실패 | 그 리뷰만 `failed` + 재시도 버튼 |

---

## B. 관리자 알림 / 자동 방어 시스템 — MVP 설계 (코드 미수정)

밤·외근 중에도 critical 이슈가 새지 않게 하는 것이 목표.
**MVP는 Critical + High만**, 자동방어는 "탐지 + 보류"까지, 자동 환불·자동 지급은 하지 않음.

### MVP 범위 (1차)
| # | 항목 | 포함 |
|---|---|---|
| 1 | `admin_alerts` 테이블 신설 (또는 `admin_anomalies` 확장) | ✅ |
| 2 | Critical 탐지 룰 5종 | ✅ |
| 3 | `/admin/alerts` 모바일 친화 콘솔 | ✅ |
| 4 | 이메일 알림 (Critical만) | ✅ |
| 5 | 자동 방어: 의심 건 `manual_review` 플래그 + audit_logs | ✅ |
| 6 | step-up 인증 유지 (기존 정책) | ✅ |

**2차로 미루는 것:** 텔레그램/디스코드 웹훅, AI 요청 자동 rate limit 강제(현재 백엔드에 rate limit 인프라 없음 — 메모리에 따라 보류, 탐지·플래그까지만), High 이하 알림 채널.

### 스키마
```
admin_alerts (
  id uuid pk,
  kind text not null,            -- 'payment_no_credit', 'duplicate_payment', ...
  severity text not null,        -- critical|high|medium|low
  status text not null default 'open', -- open|acknowledged|resolved
  title text not null,
  message text,
  payload jsonb default '{}',
  user_id uuid,
  related_payment_id uuid,
  dedupe_key text unique,        -- 같은 사건 중복 등록 방지
  acknowledged_at, acknowledged_by,
  resolved_at, resolved_by,
  admin_note text,
  notified_at timestamptz,       -- 외부 알림 발송 시각
  created_at timestamptz default now()
)
```
RLS: admin만 SELECT/UPDATE. INSERT는 service_role(Edge Function)만.

### Critical 탐지 룰 (MVP)
1. **결제 성공 후 5분 내 크레딧 미지급**
   - `payments.status='success'` AND 동일 user/source_ref로 `energy_grants` 또는 `subscriptions.plan` 변경 없음
   - 탐지: 5분 주기 cron Edge Function (`scan-alerts`)
2. **중복 결제 의심**: 같은 user에서 60초 내 동일 amount 2건 이상
3. **크레딧 중복 지급 의심**: 같은 `source_ref`로 `energy_grants` 2건 이상
4. **generate refund 실패** (`generate_refund_attempts.refunded=false` AND 1회 이상 시도)
5. **관리자 권한 실패 반복**: `audit_logs` severity=warning AND action like `admin.%` 5분 내 동일 IP 5회+

### 자동 방어 동작 (MVP)
- 1·2·3번 탐지 시: `payments.refund_status='manual_review'` 또는 `metadata.flag='manual_review'` 표시 + `admin_alerts` 등록 + `audit_logs` 기록
- 자동 환불·자동 추가 지급은 **하지 않음** (관리자 수동 처리)
- AI 요청 폭증은 탐지 + 알림만 (rate limit 인프라 없음 — 메모리에 따름). 사용자에게 자동 제한이 필요해지면 별도 의논.

### 알림 채널
- **이메일**: 기존 Lovable Emails로 발송, 수신자는 `admin_settings.alert_recipients` (신규) 또는 환경변수 `ADMIN_ALERT_EMAIL`
- 발송 실패 시 `audit_logs` 기록, 30분 후 1회 재시도
- 텔레그램/디스코드는 2차 (필요 시 webhook URL 시크릿 추가)

### Edge Functions
- `scan-alerts` (cron, 5분 주기): 위 룰 평가 → `admin_alerts` insert(dedupe_key로 중복 방지) → critical이면 이메일 트리거
- 기존 `admin/index.ts`에 액션 추가:
  - `alerts_list(status?, severity?)`
  - `alerts_acknowledge(id, note?)`
  - `alerts_resolve(id, note?)`
  수동 크레딧 지급/차감은 기존 step-up 정책 유지

### 프런트
- `src/pages/AdminAlerts.tsx` 페이지 (이미 라우트 존재 — 내용만 신규)
- 필터: severity (Critical/High), status (Open)
- 카드형 모바일 레이아웃, 관련 payment/user 상세로 점프 버튼
- 확인/해결 버튼, 관리자 메모

### 보안
- 모든 변경은 admin Edge Function 경유, service_role 프런트 비노출
- `has_role(auth.uid(),'admin')` RLS
- 모든 알림/자동방어/수동조치 → `audit_logs`
- 임의 SQL 실행 금지 (기존 정책 유지)

---

## 진행 순서 제안
1. **A 먼저 구현** (사용자 영향이 즉시 큰 버그 — "리뷰 2개인데 답변 1개")
2. A 검증 후 **B 구현**: 스키마 → cron 함수 → 탐지 룰 → admin UI → 이메일

승인해 주시면 A부터 마이그레이션·코드 변경을 시작하겠습니다.
B는 위 MVP 범위로 좋은지(특히 외부 알림은 이메일만으로 시작, AI 폭증은 탐지만) 함께 확인 부탁드립니다.
