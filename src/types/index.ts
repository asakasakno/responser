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

export const PLAN_LIMITS: Record<PlanType, { dailyLimit: number; imageUpload: boolean; maxPerImage: number; price: number; name: string }> = {
  free: { dailyLimit: 10, imageUpload: false, maxPerImage: 0, price: 0, name: 'Free' },
  basic: { dailyLimit: 100, imageUpload: true, maxPerImage: 10, price: 9900, name: 'Basic' },
  pro: { dailyLimit: 500, imageUpload: true, maxPerImage: 30, price: 29900, name: 'Pro' },
};
