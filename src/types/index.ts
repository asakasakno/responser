export type PlanType = 'free' | 'basic' | 'pro';

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
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

export const PLAN_LIMITS: Record<PlanType, { dailyLimit: number; imageUpload: boolean; maxPerImage: number; price: number; name: string; unlimited: boolean }> = {
  free: { dailyLimit: 5, imageUpload: true, maxPerImage: 5, price: 0, name: 'Free', unlimited: false },
  basic: { dailyLimit: 50, imageUpload: true, maxPerImage: 10, price: 9900, name: 'Basic', unlimited: false },
  pro: { dailyLimit: -1, imageUpload: true, maxPerImage: 30, price: 29900, name: 'Pro', unlimited: true },
};
