import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { PLAN_LIMITS } from '@/types';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { CreditCard, User, Trash2, Store, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PLATFORM_GROUPS } from '@/lib/platforms';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function SettingsPage() {
  const { user, plan, subscription, refreshProfile, refreshSubscription } = useAuth();
  const limits = PLAN_LIMITS[plan];
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelDetail, setCancelDetail] = useState<string>('');
  const [deleting, setDeleting] = useState(false);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [savingPlatforms, setSavingPlatforms] = useState(false);
  const [originalPlatforms, setOriginalPlatforms] = useState<string[]>([]);
  const [profileName, setProfileName] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [originalCompany, setOriginalCompany] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);

  const CANCEL_REASONS = [
    { value: 'price', label: '가격 부담' },
    { value: 'missing_features', label: '기능 부족' },
    { value: 'tech_issue', label: '기술 문제 / 오류 발생' },
    { value: 'not_using', label: '사용 빈도가 낮음' },
    { value: 'switching', label: '다른 서비스 이용' },
    { value: 'other', label: '기타' },
  ];

  useEffect(() => {
    if (!user) return;
    refreshSubscription();
    supabase
      .from('profiles')
      .select('platforms, name, company_name')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const p = (data?.platforms as string[]) || [];
        setPlatforms(p);
        setOriginalPlatforms(p);
        setProfileName(data?.name || '');
        setOriginalName(data?.name || '');
        const c = (data as any)?.company_name || '';
        setCompanyName(c);
        setOriginalCompany(c);
      });
  }, [user, refreshSubscription]);

  const togglePlatform = (id: string) => {
    setPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const platformsChanged = JSON.stringify([...platforms].sort()) !== JSON.stringify([...originalPlatforms].sort());
  const nameChanged = profileName.trim() !== originalName;
  const companyChanged = companyName.trim() !== originalCompany;

  const handleSaveName = async () => {
    if (!user || !profileName.trim()) {
      toast({ title: '이름을 입력해주세요', variant: 'destructive' });
      return;
    }
    setSavingName(true);
    const { error } = await supabase
      .from('profiles')
      .update({ name: profileName.trim() })
      .eq('user_id', user.id);
    setSavingName(false);
    if (error) {
      toast({ title: '저장 실패', description: error.message, variant: 'destructive' });
    } else {
      setOriginalName(profileName.trim());
      toast({ title: '이름이 저장되었습니다' });
    }
  };

  const handleSaveCompany = async () => {
    if (!user || !companyName.trim()) {
      toast({ title: '회사(상호)명을 입력해주세요', variant: 'destructive' });
      return;
    }
    setSavingCompany(true);
    const { error } = await supabase
      .from('profiles')
      .update({ company_name: companyName.trim() })
      .eq('user_id', user.id);
    setSavingCompany(false);
    if (error) {
      toast({ title: '저장 실패', description: error.message, variant: 'destructive' });
    } else {
      setOriginalCompany(companyName.trim());
      await refreshProfile();
      toast({ title: '회사명이 저장되었습니다' });
    }
  };

  const handleSavePlatforms = async () => {
    if (!user || platforms.length === 0) {
      toast({ title: '최소 1개 플랫폼을 선택해주세요', variant: 'destructive' });
      return;
    }
    setSavingPlatforms(true);
    const { error } = await supabase
      .from('profiles')
      .update({ platforms })
      .eq('user_id', user.id);
    setSavingPlatforms(false);
    if (error) {
      toast({ title: '저장 실패', description: error.message, variant: 'destructive' });
    } else {
      setOriginalPlatforms([...platforms]);
      toast({ title: '판매 플랫폼이 저장되었습니다' });
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요합니다.');

      const { data, error } = await supabase.functions.invoke('delete-account', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await supabase.auth.signOut();
      navigate('/');
      toast({ title: '회원 탈퇴 완료', description: '이용해주셔서 감사합니다.' });
    } catch (err: any) {
      toast({ title: '탈퇴 실패', description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!cancelReason) {
      toast({ title: '해지 사유를 선택해주세요', variant: 'destructive' });
      return;
    }
    setCancelling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요합니다.');
      const { data, error } = await supabase.functions.invoke('cancel-subscription', {
        body: { reason: cancelReason, reason_detail: cancelDetail.trim() },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await refreshSubscription();
      setCancelOpen(false);
      setCancelReason('');
      setCancelDetail('');
      toast({
        title: '구독이 해지되었습니다',
        description: data?.expires_at
          ? `${new Date(data.expires_at).toLocaleDateString('ko-KR')}까지 이용 가능합니다.`
          : '다음 결제부터 자동결제가 중단됩니다.',
      });
    } catch (err: any) {
      toast({ title: '해지 실패', description: err.message, variant: 'destructive' });
    } finally {
      setCancelling(false);
    }
  };

  const isCancelled = subscription?.status === 'cancelled';
  const canCancel = plan !== 'free' && subscription?.status === 'active';
  const resubscribePlan = subscription?.plan && subscription.plan !== 'free' ? subscription.plan : plan !== 'free' ? plan : 'basic';
  const resubscribeCycle = subscription?.billing_cycle === 'yearly' ? 'yearly' : 'monthly';

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-6">설정</h1>

        {/* Account */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-card mb-4">
          <div className="flex items-center gap-3 mb-4">
            <User className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">계정 정보</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">이름</span>
              <div className="flex items-center gap-2">
                <Input
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  className="w-40 h-8 text-sm"
                  placeholder="이름 입력"
                  maxLength={50}
                />
                {nameChanged && (
                  <Button size="sm" variant="outline" className="h-8" onClick={handleSaveName} disabled={savingName}>
                    {savingName ? '...' : '저장'}
                  </Button>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">회사(상호)명</span>
              <div className="flex items-center gap-2">
                <Input
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  className="w-40 h-8 text-sm"
                  placeholder="상호 입력"
                  maxLength={100}
                />
                {companyChanged && (
                  <Button size="sm" variant="outline" className="h-8" onClick={handleSaveCompany} disabled={savingCompany}>
                    {savingCompany ? '...' : '저장'}
                  </Button>
                )}
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">이메일</span>
              <span className="text-foreground">{user?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">가입일</span>
              <span className="text-foreground">{user?.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : '-'}</span>
            </div>
          </div>
        </div>

        {/* Identity Links */}
        <IdentityLinksSection />


        <div className="bg-card rounded-xl border border-border p-5 shadow-card mb-4">
          <div className="flex items-center gap-3 mb-4">
            <Store className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">판매 플랫폼</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">사용 중인 플랫폼을 모두 선택해주세요</p>
          <div className="space-y-4 mb-4">
            {PLATFORM_GROUPS.map(group => (
              <div key={group.id}>
                <div className="text-xs font-semibold text-muted-foreground mb-2">[{group.label}]</div>
                <div className="grid grid-cols-2 gap-2">
                  {group.items.map(p => (
                    <label
                      key={p.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                        platforms.includes(p.id)
                          ? 'border-primary bg-primary/5 text-foreground'
                          : 'border-border text-muted-foreground hover:border-primary/50'
                      }`}
                    >
                      <Checkbox
                        checked={platforms.includes(p.id)}
                        onCheckedChange={() => togglePlatform(p.id)}
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {platformsChanged && (
            <Button size="sm" onClick={handleSavePlatforms} disabled={savingPlatforms}>
              {savingPlatforms ? '저장 중...' : '변경사항 저장'}
            </Button>
          )}
        </div>

        {/* Subscription */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-card mb-4">
          <div className="flex items-center gap-3 mb-4">
            <CreditCard className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">구독 정보</h2>
          </div>
          <div className="space-y-2 text-sm mb-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">현재 플랜</span>
              <span className="text-foreground font-medium capitalize">{plan}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">월 응답에너지</span>
              <span className="text-foreground">{limits.monthlyEnergy}⚡</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">최대 보유량</span>
              <span className="text-foreground">{limits.maxEnergy}⚡</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">이미지 처리</span>
              <span className="text-foreground">{limits.imageUpload ? `이미지당 ${limits.maxPerImage}개` : '불가'}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {plan !== 'pro' && !isCancelled && (
              <Link to="/pricing">
                <Button size="sm" className="gradient-primary text-primary-foreground">업그레이드</Button>
              </Link>
            )}
            {canCancel && (
              <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">구독 해지</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                      정말 해지하시겠어요?
                    </DialogTitle>
                    <DialogDescription className="pt-2">
                      해지 시 다음과 같은 혜택을 잃게 됩니다.
                    </DialogDescription>
                  </DialogHeader>
                  <ul className="text-sm text-foreground space-y-2 list-disc pl-5 py-2">
                    <li>월 <b>{limits.monthlyEnergy}⚡</b> 응답에너지 자동 충전 중단</li>
                    <li>최대 보유량이 <b>100⚡</b>로 축소 (현재 {limits.maxEnergy}⚡)</li>
                    {plan === 'pro' && <li>다중 이미지 동시 업로드 기능 사용 불가</li>}
                    <li>크롬 확장프로그램 / 응답 스타일 선택 등 부가 기능 제한</li>
                    <li>에너지 추가 구매 가격 할인 혜택 종료</li>
                  </ul>

                  <div className="space-y-2 pt-2">
                    <Label className="text-sm font-medium">해지 사유를 알려주세요 <span className="text-destructive">*</span></Label>
                    <RadioGroup value={cancelReason} onValueChange={setCancelReason} className="grid grid-cols-2 gap-2">
                      {CANCEL_REASONS.map(r => (
                        <label
                          key={r.value}
                          htmlFor={`reason-${r.value}`}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                            cancelReason === r.value
                              ? 'border-primary bg-primary/5 text-foreground'
                              : 'border-border text-muted-foreground hover:border-primary/50'
                          }`}
                        >
                          <RadioGroupItem id={`reason-${r.value}`} value={r.value} />
                          {r.label}
                        </label>
                      ))}
                    </RadioGroup>
                    <Textarea
                      placeholder="더 자세한 의견이 있다면 알려주세요 (선택)"
                      value={cancelDetail}
                      onChange={e => setCancelDetail(e.target.value)}
                      maxLength={500}
                      rows={2}
                      className="text-sm"
                    />
                  </div>

                  <p className="text-xs text-muted-foreground">
                    ※ 이미 결제된 이용기간({subscription?.expires_at ? new Date(subscription.expires_at).toLocaleDateString('ko-KR') : '-'})까지는 그대로 사용하실 수 있으며, 다음 결제일부터 자동결제가 중단됩니다.
                  </p>
                  <DialogFooter className="gap-2 sm:gap-2">
                    <Button
                      variant="outline"
                      onClick={handleCancelSubscription}
                      disabled={cancelling || !cancelReason}
                      className="bg-muted text-muted-foreground hover:bg-muted/80 border-border"
                    >
                      {cancelling ? '처리 중...' : '해지하기'}
                    </Button>
                    <Button
                      onClick={() => setCancelOpen(false)}
                      disabled={cancelling}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      해지하지 않기
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            {isCancelled && (
              <>
                <span className="inline-flex items-center gap-1 text-xs text-destructive">
                  <XCircle className="w-3.5 h-3.5" /> 해지 예약됨
                  {subscription?.expires_at && (
                    <span className="text-muted-foreground ml-1">
                      ({new Date(subscription.expires_at).toLocaleDateString('ko-KR')}까지 이용 가능)
                    </span>
                  )}
                </span>
                <Link to={`/checkout?plan=${resubscribePlan}&cycle=${resubscribeCycle}`}>
                  <Button size="sm" className="gradient-primary text-primary-foreground gap-1">
                    <RefreshCw className="w-3.5 h-3.5" /> 다시 결제하고 구독 재개
                  </Button>
                </Link>
              </>
            )}
          </div>
          {plan !== 'free' && (
            <div className="mt-4 p-3 rounded-lg bg-secondary/60 border border-border text-xs text-muted-foreground leading-relaxed">
              구독을 해지해도 이미 결제된 이용기간 종료일까지 서비스 이용이 가능합니다. 다음 결제일부터 자동결제가 중단됩니다.
            </div>
          )}
        </div>

        {/* Delete Account */}
        <div className="bg-card rounded-xl border border-destructive/30 p-5 shadow-card">
          <div className="flex items-center gap-3 mb-4">
            <Trash2 className="w-5 h-5 text-destructive" />
            <h2 className="font-semibold text-foreground">회원 탈퇴</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            탈퇴 시 모든 데이터(상품, 생성 기록, 구독 정보)가 영구 삭제되며 복구할 수 없습니다.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">회원 탈퇴</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>정말 탈퇴하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                  이 작업은 되돌릴 수 없습니다. 모든 데이터가 영구적으로 삭제됩니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? '처리 중...' : '탈퇴하기'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </Layout>
  );
}
