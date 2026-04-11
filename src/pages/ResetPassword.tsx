import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageSquare, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check for recovery event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });

    // Also check hash for type=recovery
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsRecovery(true);
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: '비밀번호가 일치하지 않습니다', variant: 'destructive' });
      return;
    }
    if (password.length < 6) {
      toast({ title: '비밀번호는 6자 이상이어야 합니다', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: '비밀번호가 변경되었습니다', description: '새 비밀번호로 로그인해주세요.' });
      await supabase.auth.signOut();
      navigate('/auth');
    } catch (err: any) {
      toast({ title: '오류', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!isRecovery) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="w-full max-w-sm text-center">
          <p className="text-muted-foreground mb-4">유효하지 않은 비밀번호 재설정 링크입니다.</p>
          <Link to="/auth" className="text-primary hover:underline">로그인으로 돌아가기</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex w-1/2 gradient-hero items-center justify-center p-12">
        <div className="max-w-md text-primary-foreground">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <span className="text-2xl font-bold">응대도우미</span>
          </div>
          <h2 className="text-3xl font-bold mb-4">새 비밀번호 설정</h2>
          <p className="text-primary-foreground/70">안전한 비밀번호로 변경해주세요.</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <Link to="/auth" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8">
            <ArrowLeft className="w-4 h-4 mr-1" />
            로그인으로
          </Link>

          <h1 className="text-2xl font-bold text-foreground mb-2">비밀번호 재설정</h1>
          <p className="text-sm text-muted-foreground mb-8">새 비밀번호를 입력해주세요</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">새 비밀번호</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="새 비밀번호 입력"
                required
                minLength={6}
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">비밀번호 확인</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="비밀번호 다시 입력"
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={loading}>
              {loading ? '처리 중...' : '비밀번호 변경'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
