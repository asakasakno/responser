import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tag, X, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AppliedCoupon {
  coupon_id: string;
  coupon_code: string;
  coupon_name: string;
  discount_type: 'fixed' | 'percent';
  discount_value: number;
  discount_amount: number;
  original_amount: number;
  final_amount: number;
}

interface Props {
  amount: number;
  targetType: 'subscription' | 'energy';
  targetPlan?: string;
  applied: AppliedCoupon | null;
  onApply: (c: AppliedCoupon | null) => void;
}

const formatKRW = (n: number) => `₩${n.toLocaleString('ko-KR')}`;

export default function CouponInput({ amount, targetType, targetPlan, applied, onApply }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleApply = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-coupon', {
        body: { code: code.trim(), amount, target_type: targetType, target_plan: targetPlan },
      });
      if (error) throw error;
      if (!data?.valid) {
        toast({ title: '쿠폰 적용 실패', description: data?.error || '사용할 수 없는 코드입니다.', variant: 'destructive' });
        return;
      }
      onApply(data as AppliedCoupon);
      toast({ title: '쿠폰 적용 완료', description: `${formatKRW(data.discount_amount)} 할인` });
      setCode('');
    } catch (e: any) {
      toast({ title: '오류', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (applied) {
    return (
      <div className="border border-primary/40 bg-primary/5 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Tag className="w-4 h-4 text-primary" />
            <span>{applied.coupon_name}</span>
            <span className="text-xs text-muted-foreground">({applied.coupon_code})</span>
          </div>
          <button onClick={() => onApply(null)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="text-xs space-y-0.5">
          <div className="flex justify-between text-muted-foreground"><span>원가</span><span>{formatKRW(applied.original_amount)}</span></div>
          <div className="flex justify-between text-primary font-medium"><span>할인</span><span>-{formatKRW(applied.discount_amount)}</span></div>
          <div className="flex justify-between text-foreground font-bold pt-1 border-t border-border"><span>최종 결제금액</span><span>{formatKRW(applied.final_amount)}</span></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <Tag className="w-3.5 h-3.5" /> 프로모션 코드
      </label>
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="코드를 입력하세요"
          maxLength={50}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleApply())}
        />
        <Button type="button" variant="outline" onClick={handleApply} disabled={loading || !code.trim()}>
          {loading ? '확인 중...' : '적용'}
        </Button>
      </div>
    </div>
  );
}
