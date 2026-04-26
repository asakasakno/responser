import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { PLAN_LIMITS } from '@/types';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { CreditCard, User, Trash2, Store } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PLATFORM_GROUPS } from '@/lib/platforms';
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

export default function SettingsPage() {
  const { user, plan, refreshProfile } = useAuth();
  const limits = PLAN_LIMITS[plan];
  const navigate = useNavigate();
  const { toast } = useToast();
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

  useEffect(() => {
    if (!user) return;
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
  }, [user]);

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

        {/* Platforms */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-card mb-4">
          <div className="flex items-center gap-3 mb-4">
            <Store className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">판매 플랫폼</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">사용 중인 플랫폼을 모두 선택해주세요</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {PLATFORMS.map(p => (
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
          {plan !== 'pro' && (
            <Link to="/pricing">
              <Button size="sm" className="gradient-primary text-primary-foreground">업그레이드</Button>
            </Link>
          )}
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
