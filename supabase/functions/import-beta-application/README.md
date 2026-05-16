# import-beta-application

베타 신청을 일괄/단건으로 받아 `subscriptions`를 `beta_pro`로 승급시키는 Edge Function입니다.

## 인증 방식 (헤더 전용)

- **헤더 `x-beta-import-secret`** 만 허용합니다.
- 쿼리 파라미터(`?secret=...`) fallback은 **제거**되었습니다.
  (CDN/프록시/액세스 로그 노출 위험 때문)
- secret 불일치 시 응답은 항상 `401 { "error": "unauthorized" }` 로 일반화되어 내부 정보를 노출하지 않습니다.
- 실패한 시도는 `audit_logs.action = 'beta_import_unauthorized'` 로 기록되며,
  **secret 원문은 저장하지 않고** `ip_hash`, `had_header`, `provided_length` 만 남깁니다.
- 추가로 IP 해시 기준 **10분 / 5회** rate limit이 적용됩니다.

## Secret 로테이션 절차

1. Lovable Cloud → Secrets → `BETA_IMPORT_SECRET` 값 변경
   (Edge Function은 다음 요청부터 새 값으로 검증합니다 — 재배포 불필요)
2. 외부 호출 측(Google Apps Script, n8n, curl 등)의 헤더 값을 **동일한 새 값**으로 교체
3. 완료. 이전 값으로 호출되면 401 + audit 로그가 남습니다.

> ⚠️ 두 값이 일시적으로 다를 동안에는 모든 외부 호출이 401이 되니, **거의 동시에** 교체하세요.

---

## 호출 예시

### 1) Google Apps Script

```javascript
function sendBetaApplication(payload) {
  const SUPABASE_URL = 'https://qbvlgzmivdycuocvcoxy.supabase.co';
  const SECRET = PropertiesService
    .getScriptProperties()
    .getProperty('BETA_IMPORT_SECRET'); // 스크립트 속성에 저장

  const response = UrlFetchApp.fetch(
    `${SUPABASE_URL}/functions/v1/import-beta-application`,
    {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-beta-import-secret': SECRET, // ← 헤더 전용
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    }
  );

  Logger.log(response.getResponseCode());
  Logger.log(response.getContentText());
}

// 단건
sendBetaApplication({
  email: 'seller@example.com',
  business_name: '○○상회',
  industry: '패션',
  platforms: ['smartstore', 'coupang'],
  needed_features: ['review_response'],
  pain_point: '리뷰 응대에 시간이 너무 많이 듭니다',
  consent: true,
});

// 배치
sendBetaApplication({
  rows: [
    { email: 'a@example.com', consent: true },
    { email: 'b@example.com', consent: true },
  ],
});
```

### 2) curl

```bash
curl -X POST \
  "https://qbvlgzmivdycuocvcoxy.supabase.co/functions/v1/import-beta-application" \
  -H "Content-Type: application/json" \
  -H "x-beta-import-secret: $BETA_IMPORT_SECRET" \
  -d '{"email":"seller@example.com","consent":true}'
```

### 3) Node (fetch)

```ts
await fetch(
  'https://qbvlgzmivdycuocvcoxy.supabase.co/functions/v1/import-beta-application',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-beta-import-secret': process.env.BETA_IMPORT_SECRET!,
    },
    body: JSON.stringify({ email: 'seller@example.com', consent: true }),
  }
);
```

---

## 응답 코드

| Status | 의미 |
|---|---|
| 200 | 처리 완료 (각 row별 결과는 `results[]`에 status로 표기) |
| 400 | invalid_json |
| 401 | unauthorized (헤더 누락/불일치) |
| 429 | 요청이 너무 많습니다 (IP rate limit) |
| 500 | server_misconfigured / internal_error |
