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

// Energy rewards
export const ENERGY_REWARDS = {
  signup: { amount: 20, description: '회원가입 보상' },
  store_connect: { amount: 30, description: '스토어 연결 보상' },
  first_generation: { amount: 10, description: '첫 응답 생성 보상' },
  streak_3day: { amount: 20, description: '3일 연속 사용 보상' },
  streak_7day: { amount: 50, description: '7일 연속 사용 보상' },
  first_payment: { amount: 100, description: '첫 결제 보상' },
  referral_referrer: { amount: 100, description: '친구 추천 보상 (추천인)' },
  referral_friend: { amount: 50, description: '친구 추천 보상 (친구)' },
} as const;

export const PLAN_LIMITS: Record<PlanType, {
  monthlyEnergy: number;
  maxEnergy: number;
  imageUpload: boolean;
  maxPerImage: number;
  price: number;
  name: string;
}> = {
  free: { monthlyEnergy: 20, maxEnergy: 100, imageUpload: true, maxPerImage: 5, price: 0, name: 'Free' },
  basic: { monthlyEnergy: 200, maxEnergy: 500, imageUpload: true, maxPerImage: 10, price: 9900, name: 'Basic' },
  pro: { monthlyEnergy: 1000, maxEnergy: 2000, imageUpload: true, maxPerImage: 30, price: 29900, name: 'Pro' },
};
