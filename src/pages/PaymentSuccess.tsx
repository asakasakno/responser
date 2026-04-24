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
  const { refreshProfile, refreshSubscription, user } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState<string>('결제를 승인하는 중입니다...');
  const [details, setDetails] = useState<{ plan?: string; cycle?: string; expires_at?: string } | null>(null);
  const [redirectIn, setRedirectIn] = useState<number>(3);
  const redirectTargetRef = useRef<string | null>(null);
  const lastPlanRef = useRef<string>('');

  const paymentKey = params.get('paymentKey');
  const orderId = params.get('orderId');
  const amount = Number(params.get('amount') ?? 0);

  useEffect(() => {
    if (!paymentKey || !orderId || !amount) {
      setStatus('error');
      setMessage('결제 정보가 누락되었습니다.');
      console.warn('[PaymentSuccess] missing params', { paymentKey, orderId, amount });
      return;
    }

    const stored = sessionStorage.getItem(`toss_order_${orderId}`);
    const meta = stored ? JSON.parse(stored) : null;

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

        const errMsg = (data?.error || error?.message || '') as string;
        const isDuplicate =
          (error as any)?.context?.status === 409 ||
          /이미 처리된 결제/.test(errMsg);

        if (isDuplicate) {
          // 서버 응답과 별개로 현재 구독 상태를 다시 확인
          const sub = await refreshSubscription?.();
          lastPlanRef.current = (sub?.plan || meta?.plan || '').toLowerCase();
          setStatus('duplicate');
          setMessage('이미 처리된 결제입니다. 구독 상태를 확인해주세요.');
          redirectTargetRef.current = '/dashboard';
          console.info('[PaymentSuccess] status=duplicate', { orderId, plan: lastPlanRef.current, redirectTarget: redirectTargetRef.current });
          return;
        }

        if (error || data?.error) {
          setStatus('error');
          setMessage(errMsg || '결제 승인 중 오류가 발생했습니다.');
          console.error('[PaymentSuccess] status=error', { orderId, error: errMsg });
          return;
        }

        // 캐시/구독 갱신
        try { await refreshProfile?.(); } catch { /* noop */ }
        const sub = await refreshSubscription?.();

        // 서버 응답과 DB(subscriptions) 교차 검증
        const serverPlan = (data?.plan || '').toLowerCase();
        const dbPlan = (sub?.plan || '').toLowerCase();
        const dbStatus = sub?.status;
        const dbExpiresAt = sub?.expires_at;
        const expiresMs = dbExpiresAt ? new Date(dbExpiresAt).getTime() : (data?.expires_at ? new Date(data.expires_at).getTime() : null);

        lastPlanRef.current = dbPlan || serverPlan;

        // 만료 검증: 에너지팩이 아닌 구독 결제인데 만료일이 이미 지나거나 status가 active가 아니면 expired 처리
        if (!isEnergy) {
          const inactive = dbStatus && dbStatus !== 'active';
          const alreadyExpired = expiresMs !== null && expiresMs <= Date.now();
          if (inactive || alreadyExpired) {
            setStatus('expired');
            setMessage('구독이 활성화되지 않았습니다. 잠시 후 다시 시도하거나 고객센터로 문의해주세요.');
            console.warn('[PaymentSuccess] status=expired', { orderId, dbStatus, dbExpiresAt, serverPlan, dbPlan });
            return;
          }
          // 서버/DB 불일치 경고 (라우팅은 진행)
          if (serverPlan && dbPlan && serverPlan !== dbPlan) {
            console.warn('[PaymentSuccess] plan mismatch server vs db', { serverPlan, dbPlan });
          }
        }

        setStatus('success');
        setMessage(isEnergy ? '에너지가 충전되었습니다.' : '구독이 활성화되었습니다.');
        setDetails({
          plan: dbPlan || serverPlan,
          cycle: sub?.billing_cycle || data?.cycle,
          expires_at: dbExpiresAt || data?.expires_at,
        });

        const effectivePlan = dbPlan || serverPlan;
        if (isEnergy || effectivePlan === 'basic' || effectivePlan === 'pro') {
          redirectTargetRef.current = '/generate';
        } else {
          redirectTargetRef.current = '/dashboard';
        }
        console.info('[PaymentSuccess] status=success', { orderId, plan: effectivePlan, redirectTarget: redirectTargetRef.current });
      });
  }, [paymentKey, orderId, amount, refreshProfile, refreshSubscription]);

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

  // '다시 결제하기' 대상 플랜 결정
  const retryPlan = (lastPlanRef.current && lastPlanRef.current !== 'free') ? lastPlanRef.current : 'basic';
  const retryHref = `/checkout?plan=${retryPlan}&cycle=monthly`;

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
              {redirectTargetRef.current && (
                <p className="text-xs text-muted-foreground">
                  {redirectIn}초 후 {redirectTargetRef.current === '/generate' ? '답변 생성' : '대시보드'} 페이지로 이동합니다…
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <Link to="/dashboard" className="flex-1">
                  <Button variant="outline" className="w-full">대시보드</Button>
                </Link>
                <Link to="/generate" className="flex-1">
                  <Button className="w-full gradient-primary text-primary-foreground">바로 생성하기</Button>
                </Link>
              </div>
            </>
          )}
          {status === 'duplicate' && (
            <>
              <AlertTriangle className="w-14 h-14 text-yellow-500 mx-auto" />
              <h1 className="text-xl font-bold text-foreground">이미 처리된 결제입니다</h1>
              <p className="text-sm text-muted-foreground break-keep">{message}</p>
              <p className="text-xs text-muted-foreground">중복 청구는 발생하지 않으며, 현재 구독 상태는 대시보드에서 확인할 수 있습니다.</p>
              {redirectTargetRef.current && (
                <p className="text-xs text-muted-foreground">{redirectIn}초 후 대시보드로 이동합니다…</p>
              )}
              <div className="flex flex-col gap-2 pt-2">
                <Link to={retryHref}>
                  <Button className="w-full gradient-primary text-primary-foreground">{retryPlan.toUpperCase()} 다시 결제하기</Button>
                </Link>
                <div className="flex gap-2">
                  <Link to="/dashboard" className="flex-1">
                    <Button variant="outline" className="w-full">대시보드</Button>
                  </Link>
                  <Link to="/pricing" className="flex-1">
                    <Button variant="outline" className="w-full">요금제 보기</Button>
                  </Link>
                </div>
              </div>
            </>
          )}
          {status === 'expired' && (
            <>
              <AlertTriangle className="w-14 h-14 text-yellow-500 mx-auto" />
              <h1 className="text-xl font-bold text-foreground">구독 활성화 확인이 필요합니다</h1>
              <p className="text-sm text-muted-foreground break-keep">{message}</p>
              <div className="flex gap-2 pt-2">
                <Link to="/dashboard" className="flex-1">
                  <Button variant="outline" className="w-full">대시보드</Button>
                </Link>
                <a href="mailto:support@응대도우미.com" className="flex-1">
                  <Button className="w-full">문의하기</Button>
                </a>
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
