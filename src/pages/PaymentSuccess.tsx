import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2, MessageSquare, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import SiteFooter from '@/components/SiteFooter';

type Status = 'loading' | 'success' | 'error' | 'duplicate' | 'expired';

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth() as any;
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState<string>('결제를 승인하는 중입니다...');
  const [details, setDetails] = useState<{ plan?: string; cycle?: string; expires_at?: string } | null>(null);
  const [redirectIn, setRedirectIn] = useState<number>(3);
  const redirectTargetRef = useRef<string | null>(null);

  const paymentKey = params.get('paymentKey');
  const orderId = params.get('orderId');
  const amount = Number(params.get('amount') ?? 0);

  useEffect(() => {
    if (!paymentKey || !orderId || !amount) {
      setStatus('error');
      setMessage('결제 정보가 누락되었습니다.');
      return;
    }

    const stored = sessionStorage.getItem(`toss_order_${orderId}`);
    const meta = stored ? JSON.parse(stored) : null;

    // 에너지팩 구매 vs 구독 분기 (orderId prefix 기준)
    const isEnergy = orderId.startsWith('energy_');
    const fnName = isEnergy ? 'purchase-energy' : 'toss-confirm';
    const payload = isEnergy
      ? {
          pack_id: meta?.pack_id,
          payment_key: paymentKey,
          order_id: orderId,
          amount,
          coupon_code: meta?.coupon_code ?? undefined,
        }
      : {
          paymentKey,
          orderId,
          amount,
          plan: meta?.plan,
          cycle: meta?.cycle,
          coupon_code: meta?.coupon_code ?? undefined,
        };

    supabase.functions
      .invoke(fnName, { body: payload })
      .then(async ({ data, error }) => {
        sessionStorage.removeItem(`toss_order_${orderId}`);

        // 중복 결제 (409) 또는 명시적 duplicate 응답
        const errMsg = (data?.error || error?.message || '') as string;
        const isDuplicate =
          (error as any)?.context?.status === 409 ||
          /이미 처리된 결제/.test(errMsg);

        if (isDuplicate) {
          setStatus('duplicate');
          setMessage('이미 처리된 결제입니다. 구독 상태를 확인해주세요.');
          redirectTargetRef.current = '/dashboard';
          return;
        }

        if (error || data?.error) {
          setStatus('error');
          setMessage(errMsg || '결제 승인 중 오류가 발생했습니다.');
          return;
        }

        // 만료일이 이미 지난 비정상 케이스 방어
        if (data?.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
          setStatus('expired');
          setMessage('구독이 활성화되지 않았습니다. 고객센터로 문의해주세요.');
          return;
        }

        setStatus('success');
        setMessage(isEnergy ? '에너지가 충전되었습니다.' : '구독이 활성화되었습니다.');
        setDetails({ plan: data?.plan, cycle: data?.cycle, expires_at: data?.expires_at });

        // 프로필/플랜 캐시 갱신 후 라우팅 결정
        try { await refreshProfile?.(); } catch { /* noop */ }

        // 에너지팩은 generate, 구독은 plan에 따라 분기 (basic/pro → generate, free 잔존 시 dashboard)
        const plan = (data?.plan || '').toLowerCase();
        if (isEnergy) {
          redirectTargetRef.current = '/generate';
        } else if (plan === 'basic' || plan === 'pro') {
          redirectTargetRef.current = '/generate';
        } else {
          redirectTargetRef.current = '/dashboard';
        }
      });
  }, [paymentKey, orderId, amount, refreshProfile]);

  // 성공/중복 시 카운트다운 후 자동 라우팅
  useEffect(() => {
    if (status !== 'success' && status !== 'duplicate') return;
    if (!redirectTargetRef.current) return;
    setRedirectIn(3);
    const tick = setInterval(() => {
      setRedirectIn((n) => {
        if (n <= 1) {
          clearInterval(tick);
          navigate(redirectTargetRef.current!, { replace: true });
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [status, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto flex items-center h-16 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">응대도우미</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-16 max-w-md">
        <Card className="p-8 text-center space-y-5">
          {status === 'loading' && (
            <>
              <Loader2 className="w-14 h-14 text-primary mx-auto animate-spin" />
              <h1 className="text-xl font-bold text-foreground">결제 승인 중</h1>
              <p className="text-sm text-muted-foreground">{message}</p>
            </>
          )}
          {status === 'success' && (
            <>
              <CheckCircle2 className="w-14 h-14 text-accent mx-auto" />
              <h1 className="text-xl font-bold text-foreground">결제가 완료되었습니다</h1>
              <p className="text-sm text-muted-foreground">{message}</p>
              {details?.plan && (
                <div className="bg-secondary/50 rounded-lg p-4 text-sm text-left space-y-1">
                  <p><span className="text-muted-foreground">플랜:</span> <strong className="text-foreground">{details.plan?.toUpperCase()} {details.cycle === 'yearly' ? '연간' : '월간'}</strong></p>
                  {details.expires_at && (
                    <p><span className="text-muted-foreground">만료일:</span> <strong className="text-foreground">{new Date(details.expires_at).toLocaleDateString('ko-KR')}</strong></p>
                  )}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Link to="/dashboard" className="flex-1">
                  <Button className="w-full gradient-primary text-primary-foreground">대시보드</Button>
                </Link>
                <Link to="/generate" className="flex-1">
                  <Button variant="outline" className="w-full">바로 생성하기</Button>
                </Link>
              </div>
            </>
          )}
          {status === 'error' && (
            <>
              <XCircle className="w-14 h-14 text-destructive mx-auto" />
              <h1 className="text-xl font-bold text-foreground">결제를 완료하지 못했습니다</h1>
              <p className="text-sm text-muted-foreground break-keep">{message}</p>
              <p className="text-xs text-muted-foreground">결제가 진행됐다면 자동 환불 처리되며, 문제가 지속되면 고객센터로 문의해주세요.</p>
              <div className="flex gap-2 pt-2">
                <Link to="/pricing" className="flex-1">
                  <Button variant="outline" className="w-full">요금제로 돌아가기</Button>
                </Link>
                <a href="mailto:support@응대도우미.com" className="flex-1">
                  <Button className="w-full">문의하기</Button>
                </a>
              </div>
            </>
          )}
        </Card>
      </main>

      <SiteFooter />
    </div>
  );
}
