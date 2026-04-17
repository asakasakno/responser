export type PlanType = 'free' | 'basic' | 'pro';

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  energy_balance: number;
  max_energy: number;
  referral_code: string;
}

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
