import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Gift } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  onRedeemed?: () => void;
}

export default function CouponRedeemCard({ onRedeemed }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleRedeem = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)('redeem_energy_coupon', { _code: trimmed });
      if (error) throw error;
      if (!data?.success) {
        toast({ title: '코드 등록 실패', description: data?.error || '사용할 수 없는 코드입니다.', variant: 'destructive' });
        return;
      }
      toast({ title: '에너지 지급 완료!', description: `+${data.energy} 응답에너지가 지급되었습니다.` });
      setCode('');
      onRedeemed?.();
    } catch (e: any) {
      toast({ title: '오류', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-5 mb-8 shadow-card">
      <div className="flex items-center gap-2 mb-3">
        <Gift className="w-5 h-5 text-primary" />
        <h2 className="font-semibold text-foreground">에너지 코드 등록</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        이벤트나 프로모션으로 받은 에너지 코드가 있다면 입력하고 즉시 지급받으세요.
      </p>
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="코드를 입력하세요"
          maxLength={50}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleRedeem())}
        />
        <Button type="button" onClick={handleRedeem} disabled={loading || !code.trim()}>
          {loading ? '등록 중...' : '등록'}
        </Button>
      </div>
    </div>
  );
}
