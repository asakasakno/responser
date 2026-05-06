import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ShieldAlert } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
}

export default function StepUpDialog({ open, onClose, onVerified }: Props) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!password || password.length < 6) {
      toast({ title: '비밀번호를 입력하세요.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin', {
        body: { action: 'step_up_verify', password },
      });
      if (error || !data?.success) throw new Error(data?.error || '재인증 실패');
      toast({ title: '관리자 인증 완료', description: '5분간 민감 작업이 가능합니다.' });
      setPassword('');
      onVerified();
      onClose();
    } catch (e: any) {
      toast({ title: '인증 실패', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-yellow-500" />
            관리자 추가 인증
          </DialogTitle>
          <DialogDescription>
            민감한 작업을 위해 비밀번호를 다시 입력해주세요. 인증은 5~10분간 유효합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="stepup-password">비밀번호</Label>
          <Input
            id="stepup-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>취소</Button>
          <Button onClick={submit} disabled={loading || !password}>
            {loading ? '확인 중...' : '인증'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
