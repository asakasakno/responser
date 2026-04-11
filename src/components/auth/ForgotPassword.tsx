import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function ForgotPassword() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast({ title: '이메일을 확인해주세요', description: '비밀번호 재설정 링크를 보냈습니다.' });
    } catch (err: any) {
      toast({ title: '오류', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-primary hover:underline mb-2 block text-right w-full"
      >
        비밀번호를 잊으셨나요?
      </button>
    );
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-border bg-muted/50 p-4 mb-2">
        <p className="text-sm text-foreground font-medium mb-1">이메일을 확인해주세요</p>
        <p className="text-xs text-muted-foreground">비밀번호 재설정 링크가 발송되었습니다.</p>
        <button type="button" onClick={() => { setOpen(false); setSent(false); }} className="text-xs text-primary hover:underline mt-2">
          돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-muted/50 p-4 mb-2">
      <p className="text-sm text-foreground font-medium mb-3">비밀번호 재설정</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Label htmlFor="reset-email" className="text-xs">이메일</Label>
          <Input
            id="reset-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="가입한 이메일 입력"
            required
            className="h-9 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="sm" className="gradient-primary text-primary-foreground" disabled={loading}>
            {loading ? '전송 중...' : '링크 전송'}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
            취소
          </Button>
        </div>
      </form>
    </div>
  );
}
