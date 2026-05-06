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
export type Tone = 'thanks' | 'apology' | 'simple' | 'principle' | 'friendly' | 'firm';

export const TONES: { id: Tone; label: string; description: string }[] = [
  { id: 'thanks', label: '감사형', description: '진심 어린 감사와 따뜻한 톤' },
  { id: 'apology', label: '사과형', description: '정중한 사과와 책임 있는 톤' },
  { id: 'simple', label: '간단형', description: '짧고 명료한 핵심 답변' },
  { id: 'principle', label: '원칙형', description: '정책/원칙을 분명히 안내' },
  { id: 'friendly', label: '친근형', description: '친근하고 다정한 말투' },
  { id: 'firm', label: '단호형', description: '단호하지만 무례하지 않게' },
];

// 하위 호환을 위해 ResponseStyle/RESPONSE_STYLES alias 유지 (사용처 제거됨)
export type ResponseStyle = Tone;
export const RESPONSE_STYLES = TONES;

export type BusinessCategory =
  | 'fashion' | 'food' | 'beauty' | 'electronics'
  | 'living' | 'pet' | 'baby' | 'digital'
  | 'hotel' | 'motel' | 'pension' | 'poolvilla'
  | 'guesthouse' | 'glamping' | 'camping' | 'lodging_other'
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
  { id: 'other', label: '기타' },
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
