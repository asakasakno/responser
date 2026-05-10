import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PLAN_LIMITS, ENERGY_COSTS } from '@/types';
import Layout from '@/components/Layout';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Image, Package, ArrowRight, TrendingUp, Zap, Gift, Crown, Calendar, RefreshCw } from 'lucide-react';
import EnergyIndicator from '@/components/generate/EnergyIndicator';
import MobilePcRecommendBanner from '@/components/MobilePcRecommendBanner';

export default function Dashboard() {
  const { user, plan, energyBalance, maxEnergy, subscription, refreshSubscription } = useAuth();
  const limits = PLAN_LIMITS[plan];

  const isLow = energyBalance <= Math.ceil(maxEnergy * 0.15);

  // 진입 시 구독 최신화 (만료/갱신 상태 정확하게 표시)
  useEffect(() => {
    refreshSubscription?.();
  }, [refreshSubscription]);

  const expiresAt = subscription?.expires_at ? new Date(subscription.expires_at) : null;
  const now = Date.now();
  const daysLeft = expiresAt ? Math.ceil((expiresAt.getTime() - now) / (1000 * 60 * 60 * 24)) : null;
  const isPaidPlan = plan === 'basic' || plan === 'pro';
  const isExpiringSoon = isPaidPlan && daysLeft !== null && daysLeft <= 7 && daysLeft >= 0;
  const isExpired = isPaidPlan && daysLeft !== null && daysLeft < 0;
  const cycleLabel = subscription?.billing_cycle === 'yearly' ? '연간' : '월간';
  const renewHref = `/checkout?plan=${plan === 'free' ? 'basic' : plan}&cycle=${subscription?.billing_cycle === 'yearly' ? 'yearly' : 'monthly'}`;

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        <MobilePcRecommendBanner />
        <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">안녕하세요! 👋</h1>
            <p className="text-muted-foreground">오늘도 고객 응대를 자동화하세요</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={isPaidPlan ? 'default' : 'secondary'} className="gap-1">
              {isPaidPlan && <Crown className="w-3 h-3" />}
              {limits.name} {isPaidPlan && cycleLabel}
            </Badge>
            {expiresAt && isPaidPlan && (
              <Badge variant={isExpired ? 'destructive' : isExpiringSoon ? 'outline' : 'secondary'} className="gap-1">
                <Calendar className="w-3 h-3" />
                {isExpired
                  ? `${Math.abs(daysLeft!)}일 전 만료`
                  : `${expiresAt.toLocaleDateString('ko-KR')} 만료 (D-${daysLeft})`}
              </Badge>
            )}
            {(isExpiringSoon || isExpired) && (
              <Link to={renewHref}>
                <Button size="sm" className="gradient-primary text-primary-foreground">
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> 결제 갱신
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Energy Card */}
        <div className="bg-card rounded-xl border border-border p-6 mb-8 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">응답에너지</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-2xl font-bold text-foreground">{energyBalance}</p>
                  <span className="text-sm text-muted-foreground">/ {maxEnergy}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Link to="/rewards">
                <Button variant="outline" size="sm">
                  <Gift className="w-4 h-4 mr-1" /> 에너지 얻기
                </Button>
              </Link>
              {plan === 'free' && (
                <Link to="/pricing">
                  <Button size="sm" className="gradient-primary text-primary-foreground">
                    업그레이드 <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Energy bar */}
          <div className="w-full bg-secondary rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                energyBalance <= 0 ? 'bg-destructive' : isLow ? 'bg-yellow-500' : 'gradient-primary'
              }`}
              style={{ width: `${Math.min((energyBalance / maxEnergy) * 100, 100)}%` }}
            />
          </div>

          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{limits.name} 플랜 · 월 {limits.monthlyEnergy} 에너지</span>
            <span>1회 생성 = {ENERGY_COSTS.review}⚡</span>
          </div>

          {isLow && energyBalance > 0 && (
            <div className="mt-3 bg-yellow-500/10 rounded-lg p-3 text-sm text-yellow-600 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              에너지가 부족합니다. 미션을 완료하거나 플랜을 업그레이드하세요.
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <h2 className="text-lg font-semibold text-foreground mb-4">빠른 시작</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[
            { to: '/generate?type=review', icon: MessageSquare, title: '리뷰 답변 생성', desc: `고객 리뷰에 대한 전문적인 답변 (-${ENERGY_COSTS.review}⚡)`, color: 'text-primary' },
            { to: '/generate?type=inquiry', icon: TrendingUp, title: '문의 답변 생성', desc: `상품 문의에 정확한 답변 (-${ENERGY_COSTS.inquiry}⚡)`, color: 'text-accent' },
            { to: '/generate?type=claim', icon: Image, title: '클레임 대응 생성', desc: `불만/교환/환불 전문 대응 (-${ENERGY_COSTS.claim}⚡)`, color: 'text-destructive' },
          ].map((action, i) => (
            <Link key={i} to={action.to} className="bg-card rounded-xl border border-border p-5 hover:shadow-elevated transition-shadow group">
              <action.icon className={`w-8 h-8 ${action.color} mb-3`} />
              <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">{action.title}</h3>
              <p className="text-sm text-muted-foreground">{action.desc}</p>
            </Link>
          ))}
        </div>

        {/* Tips */}
        <div className="bg-primary/5 rounded-xl p-6 border border-primary/10">
          <div className="flex items-start gap-3">
            <Package className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h3 className="font-semibold text-foreground mb-1">상품을 등록하면 더 정확한 답변이 생성됩니다</h3>
              <p className="text-sm text-muted-foreground mb-3">상품명, 카테고리, 특이사항을 등록하면 AI가 맥락을 이해합니다.</p>
              <Link to="/products">
                <Button variant="outline" size="sm">상품 등록하기</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
