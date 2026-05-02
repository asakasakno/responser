import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ENERGY_REWARDS, PLAN_LIMITS } from '@/types';
import { Button } from '@/components/ui/button';
import { Zap, Check, Gift, Users, CreditCard, Flame, Copy, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import EnergyIndicator from '@/components/generate/EnergyIndicator';
import CouponRedeemCard from '@/components/CouponRedeemCard';

interface MissionItem {
  id: string;
  title: string;
  description: string;
  reward: number;
  icon: typeof Zap;
  completed: boolean;
  category: 'onboarding' | 'usage' | 'conversion';
}

export default function Rewards() {
  const { user, plan, energyBalance, maxEnergy, referralCode, refreshEnergy } = useAuth();
  const { toast } = useToast();
  const [missions, setMissions] = useState<MissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const limits = PLAN_LIMITS[plan];

  useEffect(() => {
    if (user) {
      loadMissions();
      loadTransactions();
    }
  }, [user]);

  const loadMissions = async () => {
    if (!user) return;
    setLoading(true);

    // Check which rewards have been earned
    const { data: txs } = await supabase
      .from('energy_transactions')
      .select('reason')
      .eq('user_id', user.id)
      .eq('type', 'earn');

    const earnedReasons = new Set(txs?.map(t => t.reason) || []);

    // Check streak
    const { data: usageData } = await supabase
      .from('usage')
      .select('date')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(7);

    const dates = usageData?.map(u => u.date) || [];
    const streak = calculateStreak(dates);

    const earned = (key: string) => Array.from(earnedReasons).some(r => r === `reward_${key}` || r === key);

    const missionList: MissionItem[] = [
      {
        id: 'signup',
        title: '회원가입 완료',
        description: '서비스에 가입하고 에너지를 받으세요',
        reward: ENERGY_REWARDS.signup.amount,
        icon: Gift,
        completed: earnedReasons.has('signup'),
        category: 'onboarding',
      },
      {
        id: 'first_generation',
        title: '첫 응답 생성',
        description: '첫 응답을 생성하면 보너스 에너지를 받습니다',
        reward: ENERGY_REWARDS.first_generation.amount,
        icon: Zap,
        completed: earned('first_generation'),
        category: 'usage',
      },
      {
        id: 'ten_generations',
        title: '응답 10건 생성',
        description: '서비스를 꾸준히 활용하면 보너스가 자동 지급됩니다',
        reward: ENERGY_REWARDS.ten_generations.amount,
        icon: Zap,
        completed: earned('ten_generations'),
        category: 'usage',
      },
      {
        id: 'streak_3day',
        title: '3일 연속 사용',
        description: '3일 연속으로 서비스를 사용하세요',
        reward: ENERGY_REWARDS.streak_3day.amount,
        icon: Flame,
        completed: earned('streak_3day') || streak >= 3,
        category: 'usage',
      },
      {
        id: 'referral',
        title: '주변 사장님 추천',
        description: '주변 사장님 추천 시 추천인 +100, 가입자 +50 에너지가 지급됩니다',
        reward: ENERGY_REWARDS.referral_referrer.amount,
        icon: Users,
        completed: false,
        category: 'conversion',
      },
    ];

    setMissions(missionList);
    setLoading(false);
  };

  const loadTransactions = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('energy_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setTransactions(data || []);
  };

  const calculateStreak = (dates: string[]) => {
    if (dates.length === 0) return 0;
    let streak = 1;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < dates.length - 1; i++) {
      const current = new Date(dates[i]);
      const next = new Date(dates[i + 1]);
      const diff = (current.getTime() - next.getTime()) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  };

  const copyReferralLink = () => {
    const link = `${window.location.origin}/auth?mode=signup&ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    toast({ title: '추천 링크가 복사되었습니다!' });
  };

  const categoryLabels = {
    onboarding: { label: '시작 보너스', icon: Gift },
    usage: { label: '사용 보너스', icon: Flame },
    conversion: { label: '주변 사장님 추천', icon: Users },
  };

  const groupedMissions = Object.entries(categoryLabels).map(([key, val]) => ({
    ...val,
    key,
    items: missions.filter(m => m.category === key),
  }));

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Zap className="w-6 h-6 text-primary" />
              응답에너지
            </h1>
            <p className="text-sm text-muted-foreground mt-1">미션을 완료하고 에너지를 획득하세요</p>
          </div>
          <EnergyIndicator balance={energyBalance} maxEnergy={maxEnergy} />
        </div>

        {/* Energy summary card */}
        <div className="bg-card rounded-xl border border-border p-6 mb-8 shadow-card">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">{energyBalance}</p>
              <p className="text-xs text-muted-foreground mt-1">보유 에너지</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{maxEnergy}</p>
              <p className="text-xs text-muted-foreground mt-1">최대 보유량</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-accent">{limits.monthlyEnergy}</p>
              <p className="text-xs text-muted-foreground mt-1">월 기본 지급</p>
            </div>
          </div>
          {plan === 'free' && (
            <div className="mt-4 pt-4 border-t border-border text-center">
              <p className="text-sm text-muted-foreground mb-2">유료 플랜으로 더 많은 에너지를 받으세요</p>
              <Link to="/pricing">
                <Button size="sm" className="gradient-primary text-primary-foreground">
                  플랜 업그레이드 <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </div>
          )}
        </div>

        <CouponRedeemCard onRedeemed={() => { refreshEnergy(); loadTransactions(); }} />

        {/* Missions */}
        {groupedMissions.map(group => (
          <div key={group.key} className="mb-8">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
              <group.icon className="w-5 h-5 text-primary" />
              {group.label}
            </h2>
            <div className="space-y-3">
              {group.items.map(mission => (
                <div
                  key={mission.id}
                  className={`bg-card rounded-xl border p-4 flex items-center gap-4 transition-all ${
                    mission.completed
                      ? 'border-accent/30 bg-accent/5'
                      : 'border-border hover:border-primary/30'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    mission.completed
                      ? 'bg-accent/20 text-accent'
                      : 'bg-primary/10 text-primary'
                  }`}>
                    {mission.completed ? <Check className="w-5 h-5" /> : <mission.icon className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium ${mission.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                      {mission.title}
                    </p>
                    <p className="text-sm text-muted-foreground">{mission.description}</p>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-bold">
                    <Zap className="w-4 h-4 text-primary" />
                    <span className="text-primary">+{mission.reward}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Referral section */}
        <div className="bg-card rounded-xl border border-border p-6 mb-8 shadow-card">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-primary" />
            주변 사장님 추천
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            주변 사장님 추천 시 가입 즉시 추천인 +{ENERGY_REWARDS.referral_referrer.amount}, 가입자 +{ENERGY_REWARDS.referral_friend.amount} 에너지가 지급됩니다.
            가입자가 유료 결제를 완료하면 양쪽에 +{ENERGY_REWARDS.referral_payment.amount} 추가 보상이 지급됩니다.
          </p>
          <div className="flex gap-2">
            <div className="flex-1 bg-secondary rounded-lg px-4 py-2 text-sm font-mono text-foreground truncate">
              {`${window.location.origin}/auth?mode=signup&ref=${referralCode}`}
            </div>
            <Button variant="outline" size="sm" onClick={copyReferralLink}>
              <Copy className="w-4 h-4 mr-1" />
              복사
            </Button>
          </div>
        </div>

        {/* Transaction history */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">에너지 내역</h2>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">아직 내역이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{tx.description || tx.reason}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${tx.type === 'earn' ? 'text-accent' : 'text-destructive'}`}>
                    {tx.type === 'earn' ? '+' : '-'}{tx.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
