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

export type ResponseStyle = 'thanks' | 'apology' | 'simple' | 'principle';

export const RESPONSE_STYLES: { id: ResponseStyle; label: string; description: string }[] = [
  { id: 'thanks', label: '감사형', description: '진심 어린 감사와 긍정적인 톤' },
  { id: 'apology', label: '사과형', description: '정중한 사과와 책임감 있는 톤' },
  { id: 'simple', label: '간단형', description: '짧고 명료한 핵심 답변' },
  { id: 'principle', label: '원칙형', description: '정책/원칙을 명확히 안내' },
];

export type Tone = 'friendly' | 'polite' | 'professional' | 'apology' | 'firm' | 'humor';
export const TONES: { id: Tone; label: string }[] = [
  { id: 'friendly', label: '친근' },
  { id: 'polite', label: '공손' },
  { id: 'professional', label: '프로페셔널' },
  { id: 'apology', label: '사과' },
  { id: 'firm', label: '단호' },
  { id: 'humor', label: '유머' },
];

export type BusinessCategory =
  | 'fashion' | 'food' | 'beauty' | 'electronics'
  | 'living' | 'pet' | 'baby' | 'digital' | 'other';
export const BUSINESS_CATEGORIES: { id: BusinessCategory; label: string }[] = [
  { id: 'fashion', label: '패션' },
  { id: 'food', label: '식품' },
  { id: 'beauty', label: '뷰티' },
  { id: 'electronics', label: '전자제품' },
  { id: 'living', label: '리빙' },
  { id: 'pet', label: '펫' },
  { id: 'baby', label: '유아동' },
  { id: 'digital', label: '디지털콘텐츠' },
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

export const CLAIM_RISK_KEYWORDS = ['신고', '고소', '공정위', '소비자원', '별점테러', '환불 안 하면', '환불안하면'];
export const PLATFORM_CHAR_LIMITS: Record<string, number> = {
  smartstore: 1000, coupang: 500, '11st': 500, gmarket: 500, auction: 500, wemakeprice: 500, tmon: 500,
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
