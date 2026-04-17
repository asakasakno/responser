---
name: reward-system
description: 응답에너지 보상/추천/추가 구매/만료 정책 (게임 미션 → 자연스러운 사용 보너스)
type: feature
---
- 보상 종류: signup(20, 무기한), first_generation(+5), ten_generations(+10), streak_3day(+15). 보상은 7일 만료, max_energy 초과 허용.
- 구독/추가 구매분: 무기한, max_energy 캡 적용.
- 사용 시 차감: spend_energy → energy_grants에서 만료 임박 우선 FIFO 차감.
- 중복 방지: reward_claims 테이블 UNIQUE(user_id, reward_key). claim_reward RPC만 사용.
- 보상 자동 지급: generate-response edge function이 첫 생성/10건/3일 연속 시 자동 호출.
- 추천("주변 사장님 추천"): 가입 시 referral_code 입력하면 추천인 +100/가입자 +50 즉시. 가입자 첫 결제 완료 시 양쪽 +50 추가 (grant_referral_payment_bonus, payment_reward_given 플래그로 1회만).
- 에너지 추가 구매: energy_packs 테이블(10/50/100/300개). purchase-energy edge function (현재 토스 미연동 → payment_key 없으면 거부).
- 플랜별 권한: Basic=웹 캡처, Pro=크롬 확장프로그램(자동입력 X). billing_cycle: monthly|yearly (연간 = 월가*10, "약 2개월 무료").
