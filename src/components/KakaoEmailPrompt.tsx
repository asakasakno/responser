import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const PLACEHOLDER_DOMAIN = '@kakao.responser.local';

export default function KakaoEmailPrompt() {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.email?.endsWith(PLACEHOLDER_DOMAIN)) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [user]);

  const submit = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('complete-kakao-email', {
        body: { email: email.trim() },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: '이메일이 등록되었습니다.', description: '결제·알림 등에 사용됩니다.' });
      // Refresh session so user.email reflects the change
      await supabase.auth.refreshSession();
      await refreshProfile();
      setOpen(false);
    } catch (e: any) {
      toast({ title: '실패', description: e?.message ?? '알 수 없는 오류', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { /* required: cannot close without entering email */ if (!v && !user?.email?.endsWith(PLACEHOLDER_DOMAIN)) setOpen(false); }}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>이메일 등록이 필요해요</DialogTitle>
          <DialogDescription>
            카카오 계정에서 이메일이 제공되지 않았습니다. 결제 영수증·중요 알림을 받으실 이메일을 입력해주세요.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="kakao-email">이메일</Label>
          <Input
            id="kakao-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={loading || !email} className="w-full">
            {loading ? '등록 중...' : '등록하기'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
