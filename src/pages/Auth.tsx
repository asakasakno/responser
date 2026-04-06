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

const PLATFORMS = [
  { id: 'naver', label: '네이버 스마트스토어' },
  { id: 'coupang', label: '쿠팡' },
  { id: '11st', label: '11번가' },
  { id: 'gmarket', label: 'G마켓/옥션' },
  { id: 'tmon', label: '티몬' },
  { id: 'interpark', label: '인터파크' },
  { id: 'ohouse', label: '오늘의집' },
  { id: 'musinsa', label: '무신사' },
  { id: 'coupangeats', label: '쿠팡이츠' },
  { id: 'baemin', label: '배달의민족' },
  { id: 'yogiyo', label: '요기요' },
  { id: 'other', label: '기타' },
];

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(searchParams.get('mode') === 'signup');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeAge, setAgreeAge] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

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
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;

        // 프로필에 플랫폼 정보 저장
        if (data.user) {
          await supabase
            .from('profiles')
            .update({ name: name.trim(), platforms: selectedPlatforms })
            .eq('user_id', data.user.id);
        }

        toast({ title: '가입 완료!', description: '이메일 인증 링크를 확인해주세요.' });
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
                <Label className="mb-3 block">판매 플랫폼 <span className="text-destructive">*</span></Label>
                <p className="text-xs text-muted-foreground mb-3">사용 중인 플랫폼을 모두 선택해주세요</p>
                <div className="grid grid-cols-2 gap-2">
                  {PLATFORMS.map(platform => (
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
