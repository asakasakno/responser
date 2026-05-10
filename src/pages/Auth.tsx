import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { MessageSquare, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import ForgotPassword from '@/components/auth/ForgotPassword';
import { lovable } from '@/integrations/lovable';
import { PLATFORM_GROUPS } from '@/lib/platforms';

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(searchParams.get('mode') === 'signup');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [password, setPassword] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeAge, setAgreeAge] = useState(false);
  const [phone, setPhone] = useState('');
  const [referralCode, setReferralCode] = useState(searchParams.get('ref') || '');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  useEffect(() => {
    const err = searchParams.get('kakao_error');
    if (err) {
      toast({ title: '카카오 로그인 실패', description: err, variant: 'destructive' });
    }
  }, [searchParams, toast]);

  const togglePlatform = (id: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        if (!agreePrivacy || !agreeTerms || !agreeAge) {
          toast({ title: '필수 동의 항목을 확인해주세요', description: '모든 필수 항목에 동의해야 가입할 수 있습니다.', variant: 'destructive' });
          setLoading(false);
          return;
        }
        if (selectedPlatforms.length === 0) {
          toast({ title: '판매 플랫폼을 선택해주세요', description: '최소 1개 이상 선택이 필요합니다.', variant: 'destructive' });
          setLoading(false);
          return;
        }
        if (!name.trim()) {
          toast({ title: '이름을 입력해주세요', variant: 'destructive' });
          setLoading(false);
          return;
        }
        if (!companyName.trim()) {
          toast({ title: '회사(상호)명을 입력해주세요', variant: 'destructive' });
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: referralCode.trim() ? { referral_code: referralCode.trim().toLowerCase() } : undefined,
          },
        });
        if (error) throw error;

        // 프로필에 플랫폼 정보 저장
        if (data.user) {
          await supabase
            .from('profiles')
            .update({
              name: name.trim(),
              company_name: companyName.trim(),
              platforms: selectedPlatforms,
              phone: phone.trim() || null,
            })
            .eq('user_id', data.user.id);
        }

        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        toast({
          title: '가입 완료!',
          description: isMobile
            ? '신청 후 PC에서 응대도우미.com에 접속하면 더 편하게 사용할 수 있습니다. 이메일 인증 링크를 확인해주세요.'
            : '이메일 인증 링크를 확인해주세요.',
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/dashboard');
      }
    } catch (err: any) {
      toast({ title: '오류', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left: gradient panel */}
      <div className="hidden lg:flex w-1/2 gradient-hero items-center justify-center p-12">
        <div className="max-w-md text-primary-foreground">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <span className="text-2xl font-bold">응대도우미</span>
          </div>
          <h2 className="text-3xl font-bold mb-4">스마트스토어 셀러의<br />필수 AI 자동 응대 도구</h2>
          <p className="text-primary-foreground/70">리뷰, 문의, 클레임 답변을 AI가 자동으로 생성합니다.</p>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8">
            <ArrowLeft className="w-4 h-4 mr-1" />
            홈으로
          </Link>

          <h1 className="text-2xl font-bold text-foreground mb-2">
            {isSignUp ? '회원가입' : '로그인'}
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            {isSignUp ? '무료로 시작하세요' : '계정에 로그인하세요'}
          </p>

          {!isSignUp && (
            <ForgotPassword />
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <Label htmlFor="name">이름 <span className="text-destructive">*</span></Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="홍길동"
                  required={isSignUp}
                  maxLength={50}
                />
              </div>
            )}
            {isSignUp && (
              <div>
                <Label htmlFor="company">회사(상호)명 <span className="text-destructive">*</span></Label>
                <Input
                  id="company"
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="(주)응대상사 / 행복마트 등"
                  required={isSignUp}
                  maxLength={100}
                />
              </div>
            )}
            <div>
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
              />
            </div>
            <div>
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                required
                minLength={6}
              />
            </div>

            {isSignUp && (
              <div>
                <Label htmlFor="phone">전화번호</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="010-1234-5678"
                  maxLength={13}
                />
              </div>
            )}

            {isSignUp && (
              <div>
                <Label htmlFor="referral">추천 코드 <span className="text-muted-foreground text-xs">(선택)</span></Label>
                <Input
                  id="referral"
                  type="text"
                  value={referralCode}
                  onChange={e => setReferralCode(e.target.value)}
                  placeholder="주변 사장님 추천 코드"
                  maxLength={20}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  입력 시 추천인 +100, 본인 +50 에너지가 즉시 지급됩니다.
                </p>
              </div>
            )}

            {isSignUp && (
              <div>
                <Label className="mb-3 block">판매 플랫폼 <span className="text-destructive">*</span></Label>
                <p className="text-xs text-muted-foreground mb-3">사용 중인 플랫폼을 모두 선택해주세요</p>
                <div className="space-y-4">
                  {PLATFORM_GROUPS.map(group => (
                    <div key={group.id}>
                      <div className="text-xs font-semibold text-muted-foreground mb-2">[{group.label}]</div>
                      <div className="grid grid-cols-2 gap-2">
                        {group.items.map(platform => (
                          <label
                            key={platform.id}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                              selectedPlatforms.includes(platform.id)
                                ? 'border-primary bg-primary/5 text-foreground'
                                : 'border-border text-muted-foreground hover:border-primary/50'
                            }`}
                          >
                            <Checkbox
                              checked={selectedPlatforms.includes(platform.id)}
                              onCheckedChange={() => togglePlatform(platform.id)}
                            />
                            {platform.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isSignUp && (
              <div className="space-y-3 pt-2">
                <Label className="block text-sm font-medium">필수 동의 <span className="text-destructive">*</span></Label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox checked={agreePrivacy} onCheckedChange={(v) => setAgreePrivacy(!!v)} className="mt-0.5" />
                  <span className="text-sm text-muted-foreground">
                    <Link to="/privacy" target="_blank" className="text-primary underline hover:text-primary/80">개인정보처리방침</Link>에 동의합니다
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox checked={agreeTerms} onCheckedChange={(v) => setAgreeTerms(!!v)} className="mt-0.5" />
                  <span className="text-sm text-muted-foreground">
                    <Link to="/terms" target="_blank" className="text-primary underline hover:text-primary/80">이용약관</Link>에 동의합니다
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox checked={agreeAge} onCheckedChange={(v) => setAgreeAge(!!v)} className="mt-0.5" />
                  <span className="text-sm text-muted-foreground">만 14세 이상입니다</span>
                </label>
              </div>
            )}

            <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={loading}>
              {loading ? '처리 중...' : isSignUp ? '가입하기' : '로그인'}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-background px-2 text-muted-foreground">또는</span></div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                const result = await lovable.auth.signInWithOAuth('google', {
                  redirect_uri: window.location.origin + '/dashboard',
                });
                if (result.error) {
                  toast({ title: 'Google 로그인 실패', description: result.error.message, variant: 'destructive' });
                  setLoading(false);
                  return;
                }
                if (result.redirected) return;
                navigate('/dashboard');
              } catch (e: any) {
                toast({ title: '오류', description: e.message, variant: 'destructive' });
                setLoading(false);
              }
            }}
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Google로 계속하기
          </Button>

          <Button
            type="button"
            className="w-full mt-2 bg-[#FEE500] text-[#191919] hover:bg-[#FDD800] border-0"
            disabled={loading}
            onClick={() => {
              const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;
              const params = new URLSearchParams({
                action: 'start',
                redirect: '/dashboard',
                origin: window.location.origin,
              });
              if (referralCode.trim()) params.set('ref', referralCode.trim().toLowerCase());
              window.location.href = `https://${projectRef}.supabase.co/functions/v1/kakao-auth?${params.toString()}`;
            }}
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.79 1.86 5.24 4.66 6.62-.2.7-.74 2.6-.85 3-.13.5.18.5.39.36.16-.11 2.55-1.73 3.59-2.43.72.1 1.46.16 2.21.16 5.52 0 10-3.48 10-7.71S17.52 3 12 3z"/></svg>
            카카오로 시작하기
          </Button>
          {isSignUp && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              이메일 입력 없이 카카오 계정으로 빠르게 시작할 수 있습니다.
            </p>
          )}

          <p className="text-sm text-center text-muted-foreground mt-6">
            {isSignUp ? '이미 계정이 있으신가요?' : '아직 계정이 없으신가요?'}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="ml-1 text-primary font-medium hover:underline"
            >
              {isSignUp ? '로그인' : '가입하기'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
