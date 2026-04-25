import { useEffect, useState } from 'react';
import { Link, useSearchParams, Navigate } from 'react-router-dom';
import { loadTossPayments, ANONYMOUS } from '@tosspayments/tosspayments-sdk';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Lock, MessageSquare, Zap, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { PLAN_LIMITS, type PlanType } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import CouponInput, { type AppliedCoupon } from '@/components/CouponInput';
import SiteFooter from '@/components/SiteFooter';

const formatKRW = (n: number) => `₩${n.toLocaleString('ko-KR')}`;

export default function Checkout() {
  const [params] = useSearchParams();
  const { user, companyName } = useAuth();
  const { toast } = useToast();

  const plan = params.get('plan') as PlanType | null;
  const cycle = (params.get('cycle') as 'monthly' | 'yearly') || 'monthly';

  const [clientKey, setClientKey] = useState<string>('');
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.functions.invoke('toss-config').then(({ data }) => {
      if (data?.clientKey) setClientKey(data.clientKey);
    });
  }, []);

  if (!user) return <Navigate to={`/auth?redirect=/checkout?plan=${plan}%26cycle=${cycle}`} replace />;
  if (!plan || (plan !== 'basic' && plan !== 'pro')) {
    return <Navigate to="/pricing" replace />;
  }
  // 연간 결제는 토스 심사 완료 전까지 비활성화 → 월간으로 리다이렉트
  if (cycle === 'yearly') {
    return <Navigate to={`/checkout?plan=${plan}&cycle=monthly`} replace />;
  }

  const limits = PLAN_LIMITS[plan];
  const basePrice = cycle === 'yearly' ? limits.yearlyPrice : limits.price;
  const finalAmount = coupon?.final_amount ?? basePrice;
  const planLabel = `${plan === 'pro' ? 'Pro' : 'Basic'} ${cycle === 'yearly' ? '연간' : '월간'}`;

  const handlePay = async () => {
    if (!clientKey) {
      toast({ title: '결제 시스템 준비 중입니다. 잠시 후 다시 시도해주세요.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const tossPayments = await loadTossPayments(clientKey);
      const payment = tossPayments.payment({ customerKey: user.id || ANONYMOUS });

      const orderId = `sub_${plan}_${cycle}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // 주문 정보를 sessionStorage에 임시 저장 → success 페이지에서 검증에 사용
      sessionStorage.setItem(
        `toss_order_${orderId}`,
        JSON.stringify({ plan, cycle, amount: finalAmount, coupon_code: coupon?.coupon_code ?? null }),
      );

      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: finalAmount },
        orderId,
        orderName: `응대도우미 ${planLabel} 구독`,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerEmail: user.email || undefined,
        customerName: companyName || undefined,
        card: {
          useEscrow: false,
          flowMode: 'DEFAULT',
          useCardPoint: false,
          useAppCardOnly: false,
        },
      });
    } catch (e: any) {
      setLoading(false);
      if (e?.code === 'USER_CANCEL') return;
      toast({ title: '결제 요청 실패', description: e?.message ?? String(e), variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">응대도우미</span>
          </Link>
          <Link to="/pricing">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="w-4 h-4" /> 요금제
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-10 max-w-xl">
        <h1 className="text-2xl font-bold text-foreground mb-2">결제하기</h1>
        <p className="text-sm text-muted-foreground mb-6">
          토스페이먼츠를 통한 안전한 결제로 진행됩니다.
        </p>

        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-bold text-foreground">{planLabel} 구독</p>
                <p className="text-xs text-muted-foreground">
                  월 {limits.monthlyEnergy} 에너지 · 최대 {limits.maxEnergy} 보유
                </p>
              </div>
            </div>
            <p className="text-lg font-bold text-foreground">{formatKRW(basePrice)}</p>
          </div>

          <CouponInput
            amount={basePrice}
            targetType="subscription"
            targetPlan={plan}
            applied={coupon}
            onApply={setCoupon}
          />

          <div className="border-t border-border pt-4 flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">최종 결제금액</span>
            <span className="text-2xl font-extrabold text-foreground">{formatKRW(finalAmount)}</span>
          </div>

          <Button
            className="w-full h-12 text-base gradient-primary text-primary-foreground"
            onClick={handlePay}
            disabled={loading || !clientKey}
          >
            {loading ? '결제창을 여는 중...' : `${formatKRW(finalAmount)} 결제하기`}
          </Button>

          <ul className="text-[11px] text-muted-foreground space-y-1.5 leading-relaxed">
            <li className="inline-flex items-center gap-1.5"><Lock className="w-3 h-3 text-primary" /> 256bit SSL 보안 결제 / 토스페이먼츠 공식 연동</li>
            <li className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3 h-3 text-primary" /> 결제 후 언제든 해지 가능 · <Link to="/refund" className="underline">환불정책</Link></li>
          </ul>
        </Card>
      </main>

      <SiteFooter />
    </div>
  );
}
