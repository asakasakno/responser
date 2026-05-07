export type PlanType = 'free' | 'basic' | 'pro';

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  company_name: string | null;
  created_at: string;
  energy_balance: number;
  max_energy: number;
  referral_code: string;
}

// 통합된 답변 톤 (기존 RESPONSE_STYLES와 TONE을 하나로 병합)
export type Tone =
  | 'thanks' | 'apology' | 'simple' | 'principle' | 'friendly' | 'firm'
  // 시그니처 5종 (업종 운영 톤 차별화)
  | 'sig_kind' | 'sig_premium' | 'sig_mz' | 'sig_pro' | 'sig_loyalty';

export const TONES: { id: Tone; label: string; description: string }[] = [
  { id: 'sig_kind',    label: '친절형 ✨',     description: '따뜻하고 정중한 사장님 말투' },
  { id: 'sig_premium', label: '고급형 ✨',     description: '품격 있고 격조 높은 응대' },
  { id: 'sig_mz',      label: 'MZ형 ✨',       description: '캐주얼하고 친구 같은 말투' },
  { id: 'sig_pro',     label: '전문형 ✨',     description: '신뢰감 있는 전문가 톤' },
  { id: 'sig_loyalty', label: '단골유도형 ✨', description: '재방문/단골을 자연스럽게 유도' },
  { id: 'thanks',    label: '감사형',  description: '진심 어린 감사와 따뜻한 톤' },
  { id: 'apology',   label: '사과형',  description: '정중한 사과와 책임 있는 톤' },
  { id: 'simple',    label: '간단형',  description: '짧고 명료한 핵심 답변' },
  { id: 'principle', label: '원칙형',  description: '정책/원칙을 분명히 안내' },
  { id: 'friendly',  label: '친근형',  description: '친근하고 다정한 말투' },
  { id: 'firm',      label: '단호형',  description: '단호하지만 무례하지 않게' },
];

// 응대 모드: 일반 vs 악성리뷰 전용
export type ResponseMode = 'normal' | 'aggressive_review';
export const RESPONSE_MODES: { id: ResponseMode; label: string; description: string }[] = [
  { id: 'normal', label: '일반 응대', description: '리뷰/문의/클레임 표준 응대' },
  { id: 'aggressive_review', label: '악성 리뷰 대응', description: '감정 분리, 사실 중심, 단호하지만 차분' },
];

// CTA 종류 (사장님이 등록한 예약/문의/쿠폰 등 링크)
export type CtaKind = 'reserve' | 'chat' | 'coupon' | 'call' | 'custom';
export const CTA_KINDS: { id: CtaKind; label: string }[] = [
  { id: 'reserve', label: '예약하기' },
  { id: 'chat',    label: '문의하기' },
  { id: 'coupon',  label: '쿠폰/이벤트' },
  { id: 'call',    label: '전화 연결' },
  { id: 'custom',  label: '기타' },
];

export interface CtaLink {
  id: string;
  user_id: string;
  kind: CtaKind;
  label: string;
  url: string;
  is_default: boolean;
}

export interface VoiceSample {
  id: string;
  user_id: string;
  content: string;
  category: string | null;
}

// 클레임 가드레일: 답변에 절대 들어가면 안 되는 표현 (정규식 소스)
export const CLAIM_GUARDRAIL_PATTERNS: { id: string; label: string; pattern: string }[] = [
  { id: 'full_blame',   label: '전적 책임 인정',   pattern: '100\\s*%\\s*(?:저희|저희가|당사|저)\\s*잘못' },
  { id: 'refund_promise', label: '확정적 환불 약속', pattern: '(?:전액|즉시)\\s*환불\\s*(?:해\\s*드리겠|약속|보장|확정)' },
  { id: 'cure_claim',   label: '의료/완치 표현',   pattern: '(?:완치|치료\\s*효과|의학적\\s*효능)\\s*(?:보장|약속|확실)' },
  { id: 'legal_admit',  label: '법적 책임 인정',   pattern: '(?:법적\\s*책임|불법|형사\\s*책임)\\s*(?:인정|있습니다)' },
  { id: 'absolute',     label: '절대 표현',       pattern: '절대\\s*(?:없습니다|없을\\s*것|불가능)' },
];

// 하위 호환을 위해 ResponseStyle/RESPONSE_STYLES alias 유지 (사용처 제거됨)
export type ResponseStyle = Tone;
export const RESPONSE_STYLES = TONES;

export type BusinessCategory =
  | 'fashion' | 'food' | 'beauty' | 'electronics'
  | 'living' | 'pet' | 'baby' | 'digital'
  | 'hotel' | 'motel' | 'pension' | 'poolvilla'
  | 'guesthouse' | 'glamping' | 'camping' | 'lodging_other'
  | 'hair' | 'nail' | 'skin' | 'waxing' | 'massage'
  | 'pilates' | 'pt_gym' | 'academy' | 'carwash' | 'service_other'
  | 'other';
export const BUSINESS_CATEGORIES: { id: BusinessCategory; label: string }[] = [
  { id: 'fashion', label: '패션' },
  { id: 'food', label: '식품' },
  { id: 'beauty', label: '뷰티' },
  { id: 'electronics', label: '전자제품' },
  { id: 'living', label: '리빙' },
  { id: 'pet', label: '펫' },
  { id: 'baby', label: '유아동' },
  { id: 'digital', label: '디지털콘텐츠' },
  { id: 'hotel', label: '호텔' },
  { id: 'motel', label: '모텔' },
  { id: 'pension', label: '펜션' },
  { id: 'poolvilla', label: '풀빌라' },
  { id: 'guesthouse', label: '게스트하우스' },
  { id: 'glamping', label: '글램핑' },
  { id: 'camping', label: '캠핑장' },
  { id: 'lodging_other', label: '숙박 기타' },
  { id: 'hair', label: '미용실' },
  { id: 'nail', label: '네일샵' },
  { id: 'skin', label: '피부관리실' },
  { id: 'waxing', label: '왁싱샵' },
  { id: 'massage', label: '마사지샵' },
  { id: 'pilates', label: '필라테스' },
  { id: 'pt_gym', label: 'PT/헬스' },
  { id: 'academy', label: '학원/레슨' },
  { id: 'carwash', label: '세차/디테일링' },
  { id: 'service_other', label: '기타 서비스업' },
  { id: 'other', label: '기타' },
];

// 업종군 (UI 그룹화)
export type BusinessGroup = 'shopping' | 'delivery' | 'lodging' | 'service';
export const BUSINESS_GROUPS: { id: BusinessGroup; label: string; categories: BusinessCategory[] }[] = [
  { id: 'shopping', label: '쇼핑몰', categories: ['fashion', 'food', 'beauty', 'electronics', 'living', 'pet', 'baby', 'digital', 'other'] },
  { id: 'delivery', label: '배달/음식점', categories: ['food'] },
  { id: 'lodging', label: '숙박/예약', categories: ['hotel', 'motel', 'pension', 'poolvilla', 'guesthouse', 'glamping', 'camping', 'lodging_other'] },
  { id: 'service', label: '서비스업', categories: ['hair', 'nail', 'skin', 'waxing', 'massage', 'pilates', 'pt_gym', 'academy', 'carwash', 'service_other'] },
];

// 서비스업 문제 유형
export type ServiceIssue =
  | 'reservation_delay' | 'wait_time' | 'staff' | 'result_unsatisfied'
  | 'style_mismatch' | 'price_info' | 'extra_charge' | 'hygiene'
  | 'noise_atmosphere' | 'parking' | 'refund_request' | 'redo_request' | 'other';
export const SERVICE_ISSUES: { id: ServiceIssue; label: string }[] = [
  { id: 'reservation_delay', label: '예약 지연' },
  { id: 'wait_time', label: '대기 시간' },
  { id: 'staff', label: '직원 응대' },
  { id: 'result_unsatisfied', label: '결과 불만족' },
  { id: 'style_mismatch', label: '원하는 스타일과 다름' },
  { id: 'price_info', label: '가격 안내 부족' },
  { id: 'extra_charge', label: '추가금 불만' },
  { id: 'hygiene', label: '위생/청결' },
  { id: 'noise_atmosphere', label: '소음/분위기' },
  { id: 'parking', label: '주차' },
  { id: 'refund_request', label: '환불 요청' },
  { id: 'redo_request', label: '재시술 요청' },
  { id: 'other', label: '기타' },
];

// 서비스업 후속조치/보상안
export type ServiceCompensation = 'redo_guide' | 'staff_check' | 'refund_consult' | 'next_visit_benefit' | 'none';
export const SERVICE_COMPENSATIONS: { id: ServiceCompensation; label: string }[] = [
  { id: 'redo_guide', label: '재시술 안내' },
  { id: 'staff_check', label: '담당자 확인' },
  { id: 'refund_consult', label: '환불 상담 안내' },
  { id: 'next_visit_benefit', label: '다음 방문 혜택' },
  { id: 'none', label: '별도 보상 없음' },
];

export type InquiryCategory = 'shipping' | 'exchange' | 'refund' | 'size' | 'stock' | 'usage' | 'other';
export const INQUIRY_CATEGORIES: { id: InquiryCategory; label: string }[] = [
  { id: 'shipping', label: '배송' },
  { id: 'exchange', label: '교환' },
  { id: 'refund', label: '환불' },
  { id: 'size', label: '사이즈' },
  { id: 'stock', label: '재고' },
  { id: 'usage', label: '사용법' },
  { id: 'other', label: '기타' },
];

export type Compensation = 'reship' | 'partial_refund' | 'full_refund' | 'coupon' | 'none';
export const COMPENSATIONS: { id: Compensation; label: string }[] = [
  { id: 'reship', label: '재발송' },
  { id: 'partial_refund', label: '부분환불' },
  { id: 'full_refund', label: '전액환불' },
  { id: 'coupon', label: '쿠폰' },
  { id: 'none', label: '보상 없음' },
];

// 숙박 리뷰 전용 문제 유형
export type LodgingIssue =
  | 'cleanliness' | 'noise' | 'smell' | 'bedding' | 'parking'
  | 'staff' | 'reservation' | 'refund' | 'facility_old'
  | 'hvac' | 'pest_mold' | 'photo_mismatch' | 'other';
export const LODGING_ISSUES: { id: LodgingIssue; label: string }[] = [
  { id: 'cleanliness', label: '청결' },
  { id: 'noise', label: '소음' },
  { id: 'smell', label: '냄새' },
  { id: 'bedding', label: '침구' },
  { id: 'parking', label: '주차' },
  { id: 'staff', label: '직원 응대' },
  { id: 'reservation', label: '예약 착오' },
  { id: 'refund', label: '환불' },
  { id: 'facility_old', label: '시설 노후' },
  { id: 'hvac', label: '온수/난방/에어컨' },
  { id: 'pest_mold', label: '벌레/곰팡이' },
  { id: 'photo_mismatch', label: '사진과 다름' },
  { id: 'other', label: '기타' },
];

// 숙박 보상/안내 옵션
export type LodgingCompensation = 'revisit_discount' | 'room_inspection' | 'staff_training' | 'refund_guide' | 'none';
export const LODGING_COMPENSATIONS: { id: LodgingCompensation; label: string }[] = [
  { id: 'revisit_discount', label: '재방문 할인' },
  { id: 'room_inspection', label: '객실 점검' },
  { id: 'staff_training', label: '직원 교육' },
  { id: 'refund_guide', label: '환불 안내' },
  { id: 'none', label: '별도 보상 없음' },
];

export const CLAIM_RISK_KEYWORDS = ['신고', '고소', '공정위', '소비자원', '별점테러', '환불 안 하면', '환불안하면'];
export const LODGING_RISK_KEYWORDS = [
  '환불', '신고', '소비자원', '공정위', '고소', '사진 올리겠다', '위생', '벌레', '곰팡이',
  '악취', '도난', '몰카', '성추행', '경찰', '보건소', '최악', '사기',
];
export const SERVICE_RISK_KEYWORDS = [
  '환불', '신고', '소비자원', '공정위', '고소', '사기', '최악',
  '사진 올리겠다', '리뷰 테러', '경찰', '위생', '불친절',
  '머리 망침', '피부 뒤집어짐', '부작용', '화상', '상처',
];
export const PLATFORM_CHAR_LIMITS: Record<string, number> = {
  smartstore: 1000, coupang: 500, '11st': 500, gmarket: 500, auction: 500, interpark: 500,
};

export interface Subscription {
  id: string;
  user_id: string;
  plan: PlanType;
  status: 'active' | 'cancelled' | 'expired';
  started_at: string;
  expires_at: string | null;
}

export interface Product {
  id: string;
  user_id: string;
  name: string;
  category: string;
  note: string | null;
  created_at: string;
}

export interface Generation {
  id: string;
  user_id: string;
  type: 'review' | 'inquiry' | 'claim';
  input_text: string;
  output_text: string;
  product_id: string | null;
  created_at: string;
}

export interface UsageRecord {
  id: string;
  user_id: string;
  date: string;
  count: number;
}

export interface EnergyTransaction {
  id: string;
  user_id: string;
  type: 'earn' | 'spend';
  amount: number;
  reason: string;
  description: string | null;
  created_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  status: 'pending' | 'completed';
  reward_given: boolean;
  created_at: string;
  completed_at: string | null;
}

// Energy costs for different actions
export const ENERGY_COSTS = {
  review: 1,
  inquiry: 1,
  claim: 1,
  premium_template: 2,
  auto_response: 3,
} as const;

// Energy rewards (자연스러운 사용 보너스)
export const ENERGY_REWARDS = {
  signup: { amount: 20, description: '회원가입 보상' },
  first_generation: { amount: 5, description: '첫 응답 생성 보너스' },
  ten_generations: { amount: 10, description: '응답 10건 생성 보너스' },
  streak_3day: { amount: 15, description: '3일 연속 사용 보너스' },
  referral_referrer: { amount: 100, description: '주변 사장님 추천 보상 (추천인)' },
  referral_friend: { amount: 50, description: '추천 가입 보상 (가입자)' },
  referral_payment: { amount: 50, description: '추천 결제 추가 보상' },
} as const;

export interface EnergyPack {
  id: string;
  energy: number;
  price: number;
}

export const PLAN_LIMITS: Record<PlanType, {
  monthlyEnergy: number;
  yearlyPrice: number;
  maxEnergy: number;
  imageUpload: boolean;
  maxPerImage: number;
  price: number;
  name: string;
  extension: boolean;
  webCapture: boolean;
}> = {
  free: { monthlyEnergy: 20, yearlyPrice: 0, maxEnergy: 100, imageUpload: true, maxPerImage: 5, price: 0, name: 'Free', extension: false, webCapture: false },
  basic: { monthlyEnergy: 200, yearlyPrice: 99000, maxEnergy: 500, imageUpload: true, maxPerImage: 10, price: 9900, name: 'Basic', extension: false, webCapture: true },
  pro: { monthlyEnergy: 1000, yearlyPrice: 299000, maxEnergy: 2000, imageUpload: true, maxPerImage: 30, price: 29900, name: 'Pro', extension: true, webCapture: true },
};
