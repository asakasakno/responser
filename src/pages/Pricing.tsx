import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Check, X, MessageSquare, Zap, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PLAN_LIMITS, type EnergyPack } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const plans = [
  {
    key: 'free' as const,
    name: 'Free',
    description: '가볍게 시작하기',
    features: [
      '월 20 응답에너지',
      '최대 보유량 100',
      '이미지당 최대 5개 처리',
      '상품 등록 3개',
    ],
    excluded: ['웹 캡처 업로드', '크롬 확장프로그램', '에너지 추가 구매'],
  },
  {
    key: 'basic' as const,
    name: 'Basic',
    description: '일반 셀러를 위한 플랜',
    popular: true,
    features: [
      '월 200 응답에너지',
      '최대 보유량 500',
      '이미지당 최대 10개 처리',
      '웹 캡처 업로드 가능',
      '상품 등록 무제한',
      '에너지 추가 구매',
    ],
    excluded: ['크롬 확장프로그램'],
  },
  {
    key: 'pro' as const,
    name: 'Pro',
    description: '대량 처리가 필요한 파워 셀러',
    features: [
      '월 1,000 응답에너지',
      '최대 보유량 2,000',
      '이미지당 최대 30개 처리',
      '웹 캡처 업로드 가능',
      '크롬 확장프로그램 사용 가능',
      '상품 등록 무제한',
      '에너지 추가 구매',
    ],
    excluded: [],
  },
];

const formatKRW = (n: number) => `₩${n.toLocaleString('ko-KR')}`;

export default function Pricing() {
  const { user, plan: currentPlan } = useAuth();
  const { toast } = useToast();
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [packs, setPacks] = useState<EnergyPack[]>([]);

  useEffect(() => {
    supabase.from('energy_packs').select('id, energy, price').eq('active', true).order('sort_order').then(({ data }) => {
      if (data) setPacks(data as EnergyPack[]);
    });
  }, []);

  const handleBuyPack = (pack: EnergyPack) => {
    if (!user) {
      window.location.href = '/auth?mode=signup';
      return;
    }
    toast({
      title: '결제 시스템 준비 중',
      description: `${pack.energy} 에너지 (${formatKRW(pack.price)}) 구매는 곧 오픈됩니다.`,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">응대도우미</span>
          </Link>
          {user ? (
            <Link to="/dashboard"><Button variant="ghost" size="sm">대시보드</Button></Link>
          ) : (
            <Link to="/auth"><Button variant="ghost" size="sm">로그인</Button></Link>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">합리적인 요금제</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            응답에너지로 더 효율적으로. 셀러 규모에 맞게 선택하세요.
          </p>
        </div>

        {/* 월/연 토글 */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center bg-secondary rounded-full p-1 border border-border">
            <button
              onClick={() => setCycle('monthly')}
              className={`px-5 py-2 text-sm font-semibold rounded-full transition-all ${
                cycle === 'monthly' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              월간
            </button>
            <button
              onClick={() => setCycle('yearly')}
              className={`px-5 py-2 text-sm font-semibold rounded-full transition-all flex items-center gap-1.5 ${
                cycle === 'yearly' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              연간
              <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-full font-bold">약 2개월 무료</span>
            </button>
          </div>
        </div>

        {/* 플랜 카드 */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map(plan => {
            const limits = PLAN_LIMITS[plan.key];
            const isCurrent = user && currentPlan === plan.key;
            const price = plan.key === 'free' ? 0 : (cycle === 'yearly' ? limits.yearlyPrice : limits.price);
            const period = plan.key === 'free' ? '영구 무료' : (cycle === 'yearly' ? '/ 년' : '/ 월');
            const monthlyEquivalent = cycle === 'yearly' && plan.key !== 'free' ? Math.round(limits.yearlyPrice / 12) : null;

            return (
              <div
                key={plan.key}
                className={`relative bg-card rounded-2xl border p-6 flex flex-col ${
                  plan.popular ? 'border-primary shadow-primary-glow' : 'border-border shadow-card'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full gradient-primary text-primary-foreground text-xs font-semibold">
                    인기
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-foreground">{formatKRW(price)}</span>
                    <span className="text-sm text-muted-foreground">{period}</span>
                  </div>
                  {monthlyEquivalent && (
                    <p className="text-xs text-muted-foreground mt-1">월 {formatKRW(monthlyEquivalent)} 수준</p>
                  )}
                  <div className="mt-2 flex items-center gap-1.5 text-sm">
                    <Zap className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-primary">월 {limits.monthlyEnergy} 에너지</span>
                  </div>
                </div>

                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-accent flex-shrink-0" />
                      <span className="text-foreground">{f}</span>
                    </li>
                  ))}
                  {plan.excluded.map((f, i) => (
                    <li key={`x-${i}`} className="flex items-center gap-2 text-sm">
                      <X className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                      <span className="text-muted-foreground/60">{f}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>현재 플랜</Button>
                ) : plan.key === 'free' ? (
                  <Link to="/auth?mode=signup" className="w-full">
                    <Button variant="outline" className="w-full">무료로 시작</Button>
                  </Link>
                ) : (
                  <Link to={user ? `/checkout?plan=${plan.key}&cycle=${cycle}` : '/auth?mode=signup'} className="w-full">
                    <Button className={`w-full ${plan.popular ? 'gradient-primary text-primary-foreground' : ''}`}>
                      {user ? '업그레이드' : '시작하기'}
                    </Button>
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        {/* 에너지 추가 구매 */}
        <div className="mt-20 max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" /> 추가 구매
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">응답에너지 추가 구매</h2>
            <p className="text-sm text-muted-foreground">
              구독과 별개로 필요할 때 충전하세요. 결제 즉시 보유 에너지에 합산됩니다.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {packs.map(pack => (
              <div key={pack.id} className="bg-card rounded-xl border border-border p-5 flex flex-col items-center text-center shadow-card hover:border-primary/40 transition-all">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <p className="text-2xl font-extrabold text-foreground">{pack.energy}<span className="text-sm font-medium text-muted-foreground ml-1">개</span></p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">{formatKRW(pack.price)}</p>
                <Button size="sm" variant="outline" className="w-full" onClick={() => handleBuyPack(pack)}>
                  구매하기
                </Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-4">
            * Basic / Pro 플랜에서만 추가 구매가 가능합니다. 구매한 에너지는 만료되지 않습니다.
          </p>
        </div>

        {/* 비교표 */}
        <div className="mt-20 max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8 text-foreground">기능 비교표</h2>
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-card overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-border bg-secondary">
                  <th className="text-left p-4 text-sm font-semibold text-foreground">기능</th>
                  <th className="text-center p-4 text-sm font-semibold text-muted-foreground">Free</th>
                  <th className="text-center p-4 text-sm font-semibold text-primary">Basic</th>
                  <th className="text-center p-4 text-sm font-semibold text-accent">Pro</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['월 응답에너지', '20', '200', '1,000'],
                  ['최대 보유량', '100', '500', '2,000'],
                  ['리뷰/문의/클레임 응답', true, true, true],
                  ['이미지당 최대 처리', '5개', '10개', '30개'],
                  ['웹 캡처 업로드', false, true, true],
                  ['크롬 확장프로그램 사용', false, false, true],
                  ['상품 등록', '3개', '무제한', '무제한'],
                  ['연간 결제 (약 2개월 무료)', false, true, true],
                  ['에너지 추가 구매', false, true, true],
                  ['미션 보너스 에너지', true, true, true],
                  ['주변 사장님 추천 보상', true, true, true],
                ].map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="p-4 text-sm text-foreground">{row[0] as string}</td>
                    {[1, 2, 3].map(j => (
                      <td key={j} className="p-4 text-center text-sm">
                        {typeof row[j] === 'boolean' ? (
                          row[j] ? <Check className="w-4 h-4 text-accent mx-auto" /> : <X className="w-4 h-4 text-muted-foreground/30 mx-auto" />
                        ) : (
                          <span className="text-foreground font-medium">{row[j] as string}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-4">
            * 크롬 확장프로그램은 리뷰/문의 페이지에서 빠르게 답변을 생성하는 도구이며, 자동 입력 기능은 포함되지 않습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
