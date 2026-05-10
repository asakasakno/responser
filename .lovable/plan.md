# 로그인 연결 관리 기능 추가 계획

## 개요
설정 페이지에 사용자가 이메일/Google/Kakao 로그인 방식을 연결·해제할 수 있는 "로그인 연결 관리" 섹션을 추가합니다. 별도 `user_identity_links` 테이블로 연결 정보를 관리하고, 모든 연결/해제 작업은 Edge Function을 통해 안전하게 처리하며 `audit_logs`에 기록합니다.

---

## 1. DB 변경 (migration)

### `user_identity_links` 테이블 신설
```text
- id uuid PK
- user_id uuid NOT NULL  (auth.users 참조 없이, 기존 패턴 준수)
- provider text  -- 'email' | 'google' | 'kakao'
- provider_user_id text  -- 이메일은 NULL 허용 (id가 곧 user_id)
- provider_email text
- email_verified boolean default false
- linked_at timestamptz default now()
- unlinked_at timestamptz
- is_active boolean default true
- UNIQUE (provider, provider_user_id) WHERE is_active
- UNIQUE (user_id, provider) WHERE is_active
- INDEX (user_id)
```

### RLS
- `SELECT`: 본인 row만 조회 (`auth.uid() = user_id`) + 관리자(`has_role`)
- `INSERT/UPDATE/DELETE`: 모두 차단 (Edge Function의 service_role만 가능)

### 백필
- 기존 `profiles` 데이터를 기반으로 초기 row 생성:
  - 모든 사용자에 `email` provider row (이메일이 placeholder가 아닐 때)
  - `provider='kakao'`이고 `provider_user_id` 있는 사용자에 `kakao` row

---

## 2. Edge Function: `identity-links`

신규 함수. 액션:

- `list` — 현재 user의 활성 연결 목록 반환
- `start_link` — `provider`(google|kakao) 받아 OAuth 시작 URL 반환. state에 현재 `user_id` + `mode='link'` 포함
- `unlink` — `provider` 받아 마지막 로그인 수단인지 검증 후 비활성화. audit_logs 기록

검증 규칙:
- 마지막 활성 수단 해제 차단
- 관리자 계정의 연결/해제도 audit_logs 기록 (severity=warning)

---

## 3. 기존 Edge Function 수정

### `kakao-auth/index.ts`
- callback의 state에 `mode` 필드 추가 처리
- `mode === 'link'`일 때:
  - Kakao 이메일 verified/valid 강제 요구
  - state의 `link_user_id`로 현재 로그인 사용자 user_id 식별
  - 관리자 계정인 경우 → 본인이 본인 계정에 연결하는 것은 허용 (단 audit_logs 기록)
  - 기존 다른 user_id에 이미 kakao_id가 연결되어 있으면 거부
  - 신규 계정 생성하지 않고 `user_identity_links` 에 row 추가
  - 완료 후 `/settings?link=success` 로 리다이렉트
- 기존 일반 로그인 흐름은 유지하되, 자동 이메일 연결 시에도 `user_identity_links` 동기화

### Google 연결
- 현재 프로젝트는 Lovable Cloud 관리형 Google OAuth 사용 (`lovable.auth.signInWithOAuth`)
- 이미 로그인된 상태에서 Google 연결은 Supabase의 `linkIdentity` API 활용 또는 별도 콜백 흐름 필요
- 단순화를 위해: Google은 Supabase의 `auth.linkIdentity({ provider: 'google' })`를 클라이언트에서 호출하고, 이후 `identity-links` 함수의 `sync` 액션이 `auth.users.identities`를 읽어 `user_identity_links` 테이블에 반영

---

## 4. 프론트엔드: `src/components/settings/IdentityLinksSection.tsx`

`SettingsPage`에 신규 섹션 추가:

- 이메일 / Google / Kakao 3개 row 표시
- 상태 뱃지: "연결됨" (회색) / "연결하기" 버튼
- 연결됨인 경우 "연결 해제" 버튼 (마지막 수단이면 disabled + 안내)
- Google 연결: `supabase.auth.linkIdentity({ provider: 'google', options: { redirectTo: '/settings?link=google' } })` 호출 → 콜백에서 `identity-links/sync` 호출
- Kakao 연결: `identity-links/start_link` 호출 → 반환된 URL로 리다이렉트
- 연결 해제: 확인 다이얼로그 후 `identity-links/unlink` 호출
- `?link=success` 쿼리 파라미터 감지하여 toast 표시

UI 문구는 요구사항대로:
- 섹션명: "로그인 연결 관리"
- 보조: "자주 사용하는 로그인 방식을 연결해두면 더 편하게 로그인할 수 있습니다."

---

## 5. 보안 체크리스트

- `user_identity_links` 테이블 INSERT/UPDATE/DELETE 정책 없음 → 클라이언트 직접 변경 불가
- `profiles.role`, `profiles.plan`, `profiles.provider*`는 기존 RLS로 보호 (변경 없음)
- 모든 연결/해제는 Edge Function에서 service_role로 처리
- audit_logs 액션명: `identity_link_added`, `identity_link_removed`, `identity_link_blocked`
- 관리자 계정 관련 작업은 severity=warning으로 기록

---

## 6. 작업 순서

1. Migration: `user_identity_links` 테이블 + RLS + 백필
2. Edge Function `identity-links` 신설
3. `kakao-auth` 함수 수정 (link mode 지원)
4. `IdentityLinksSection` 컴포넌트 + `SettingsPage` 통합
5. 배포 후 동작 확인 (이메일/Kakao/Google 각각)
