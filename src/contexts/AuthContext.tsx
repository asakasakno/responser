import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type PlanType = 'free' | 'basic' | 'pro';
type SubStatus = 'active' | 'cancelled' | 'expired';

export interface SubscriptionInfo {
  plan: PlanType;
  status: SubStatus;
  billing_cycle: string;
  expires_at: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  plan: PlanType;
  isAdmin: boolean;
  energyBalance: number;
  maxEnergy: number;
  referralCode: string;
  companyName: string;
  subscription: SubscriptionInfo | null;
  refreshEnergy: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSubscription: () => Promise<SubscriptionInfo | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  plan: 'free',
  isAdmin: false,
  energyBalance: 0,
  maxEnergy: 100,
  referralCode: '',
  companyName: '',
  subscription: null,
  refreshEnergy: async () => {},
  refreshProfile: async () => {},
  refreshSubscription: async () => null,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<PlanType>('free');
  const [isAdmin, setIsAdmin] = useState(false);
  const [energyBalance, setEnergyBalance] = useState(0);
  const [maxEnergy, setMaxEnergy] = useState(100);
  const [referralCode, setReferralCode] = useState('');
  const [companyName, setCompanyName] = useState('');

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('energy_balance, max_energy, referral_code, company_name')
      .eq('user_id', userId)
      .maybeSingle();
    if (data) {
      setEnergyBalance(data.energy_balance);
      setMaxEnergy(data.max_energy);
      setReferralCode(data.referral_code || '');
      setCompanyName((data as any).company_name || '');
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await fetchProfile(user.id);
  }, [user, fetchProfile]);

  const refreshEnergy = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('energy_balance, max_energy')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      setEnergyBalance(data.energy_balance);
      setMaxEnergy(data.max_energy);
    }
  }, [user]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        setTimeout(() => {
          fetchPlan(session.user.id);
          fetchAdminRole(session.user.id);
          fetchProfile(session.user.id);
        }, 0);
      } else {
        setPlan('free');
        setIsAdmin(false);
        setEnergyBalance(0);
        setMaxEnergy(100);
        setReferralCode('');
        setCompanyName('');
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        fetchPlan(session.user.id);
        fetchAdminRole(session.user.id);
        fetchProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchAdminRole = async (userId: string) => {
    const { data } = await (supabase.rpc as any)('current_user_has_role', { _role: 'admin' });
    setIsAdmin(!!data);
  };

  const fetchPlan = async (userId: string) => {
    // 관리자 계정은 항상 Pro로 취급 (UI/제한 모두)
    const { data: adminCheck } = await (supabase.rpc as any)('current_user_has_role', { _role: 'admin' });
    if (adminCheck) {
      setPlan('pro');
      return;
    }
    const { data } = await supabase
      .from('subscriptions')
      .select('plan')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();
    setPlan(data ? (data.plan as PlanType) : 'free');
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, plan, isAdmin, energyBalance, maxEnergy, referralCode, companyName, refreshEnergy, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
