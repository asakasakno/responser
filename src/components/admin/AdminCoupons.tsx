import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Tag, Plus, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface Coupon {
  id: string;
  coupon_name: string;
  coupon_code: string;
  discount_type: 'fixed' | 'percent';
  discount_value: number;
  max_discount_amount: number | null;
  min_purchase_amount: number | null;
  target_type: 'subscription' | 'energy' | 'all' | 'reward';
  target_plan: string | null;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  max_total_uses: number | null;
  max_use_per_user: number;
  total_uses: number;
  reward_energy: number;
  reward_energy_expire_days: number | null;
  created_at: string;
}

const formatKRW = (n: number | null) => n == null ? '-' : `₩${n.toLocaleString('ko-KR')}`;

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // form
  const [form, setForm] = useState({
    coupon_name: '',
    coupon_code: '',
    discount_type: 'fixed' as 'fixed' | 'percent',
    discount_value: 0,
    max_discount_amount: '',
    min_purchase_amount: '',
    target_type: 'all' as 'subscription' | 'energy' | 'all' | 'reward',
    target_plan: '',
    starts_at: '',
    expires_at: '',
    max_total_uses: '',
    max_use_per_user: 1,
    reward_energy: 0,
    reward_energy_expire_days: '',
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    setCoupons((data as Coupon[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    const isReward = form.target_type === 'reward';
    if (!form.coupon_name.trim() || !form.coupon_code.trim()) {
      toast({ title: '쿠폰 이름과 코드를 입력해주세요', variant: 'destructive' });
      return;
    }
    if (isReward) {
      if (!form.reward_energy || form.reward_energy <= 0) {
        toast({ title: '지급 에너지 수량을 입력해주세요', variant: 'destructive' });
        return;
      }
    } else if (form.discount_value <= 0) {
      toast({ title: '할인값을 입력해주세요', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload: any = {
      coupon_name: form.coupon_name.trim(),
      coupon_code: form.coupon_code.trim().toLowerCase(),
      discount_type: isReward ? 'fixed' : form.discount_type,
      discount_value: isReward ? 0 : form.discount_value,
      max_discount_amount: !isReward && form.max_discount_amount ? Number(form.max_discount_amount) : null,
      min_purchase_amount: !isReward && form.min_purchase_amount ? Number(form.min_purchase_amount) : 0,
      target_type: form.target_type,
      target_plan: !isReward ? (form.target_plan || null) : null,
      starts_at: form.starts_at || null,
      expires_at: form.expires_at || null,
      max_total_uses: form.max_total_uses ? Number(form.max_total_uses) : null,
      max_use_per_user: form.max_use_per_user || 1,
      reward_energy: isReward ? Number(form.reward_energy) : 0,
      reward_energy_expire_days: isReward && form.reward_energy_expire_days ? Number(form.reward_energy_expire_days) : null,
      is_active: true,
    };
    const { error } = await supabase.from('coupons').insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: '생성 실패', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: '쿠폰을 생성했습니다.' });
    setOpen(false);
    setForm({ ...form, coupon_name: '', coupon_code: '', discount_value: 0, max_discount_amount: '', min_purchase_amount: '', target_plan: '', starts_at: '', expires_at: '', max_total_uses: '', reward_energy: 0, reward_energy_expire_days: '' });
    load();
  };

  const toggleActive = async (c: Coupon) => {
    const { error } = await supabase.from('coupons').update({ is_active: !c.is_active }).eq('id', c.id);
    if (error) toast({ title: '실패', description: error.message, variant: 'destructive' });
    else load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Tag className="w-5 h-5" /> 쿠폰 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">프로모션 코드를 발급하고 사용 내역을 관리합니다.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-1" /> 쿠폰 생성</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>새 쿠폰 만들기</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>쿠폰 이름 (관리용)</Label>
                <Input value={form.coupon_name} onChange={e => setForm({ ...form, coupon_name: e.target.value })} placeholder="런칭 기념 20% 할인" /></div>
              <div><Label>쿠폰 코드 (사용자 입력)</Label>
                <Input value={form.coupon_code} onChange={e => setForm({ ...form, coupon_code: e.target.value })} placeholder="LAUNCH20" /></div>

              <div><Label>쿠폰 종류</Label>
                <Select value={form.target_type} onValueChange={(v: any) => setForm({ ...form, target_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">결제 할인 — 전체</SelectItem>
                    <SelectItem value="subscription">결제 할인 — 구독만</SelectItem>
                    <SelectItem value="energy">결제 할인 — 에너지 구매만</SelectItem>
                    <SelectItem value="reward">에너지 지급 (결제 불필요)</SelectItem>
                  </SelectContent>
                </Select></div>

              {form.target_type === 'reward' ? (
                <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div><Label>지급 에너지 수량</Label>
                    <Input type="number" min={1} value={form.reward_energy}
                      onChange={e => setForm({ ...form, reward_energy: Number(e.target.value) })}
                      placeholder="100" /></div>
                  <div><Label>유효 기간 (일, 선택)</Label>
                    <Input type="number" min={1} value={form.reward_energy_expire_days}
                      onChange={e => setForm({ ...form, reward_energy_expire_days: e.target.value })}
                      placeholder="비우면 무기한" /></div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>할인 방식</Label>
                      <Select value={form.discount_type} onValueChange={(v: any) => setForm({ ...form, discount_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">정액 (원)</SelectItem>
                          <SelectItem value="percent">정률 (%)</SelectItem>
                        </SelectContent>
                      </Select></div>
                    <div><Label>할인값</Label>
                      <Input type="number" value={form.discount_value} onChange={e => setForm({ ...form, discount_value: Number(e.target.value) })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>최대 할인액 (선택)</Label>
                      <Input type="number" value={form.max_discount_amount} onChange={e => setForm({ ...form, max_discount_amount: e.target.value })} /></div>
                    <div><Label>최소 결제금액 (선택)</Label>
                      <Input type="number" value={form.min_purchase_amount} onChange={e => setForm({ ...form, min_purchase_amount: e.target.value })} /></div>
                  </div>
                  <div><Label>플랜 한정 (선택)</Label>
                    <Select value={form.target_plan || 'any'} onValueChange={(v) => setForm({ ...form, target_plan: v === 'any' ? '' : v })}>
                      <SelectTrigger><SelectValue placeholder="제한 없음" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">제한 없음</SelectItem>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                      </SelectContent>
                    </Select></div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div><Label>시작일 (선택)</Label>
                  <Input type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></div>
                <div><Label>만료일 (선택)</Label>
                  <Input type="datetime-local" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>전체 사용 횟수 (선택)</Label>
                  <Input type="number" value={form.max_total_uses} onChange={e => setForm({ ...form, max_total_uses: e.target.value })} /></div>
                <div><Label>계정당 사용 횟수</Label>
                  <Input type="number" min={1} value={form.max_use_per_user} onChange={e => setForm({ ...form, max_use_per_user: Number(e.target.value) })} /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
              <Button onClick={handleCreate} disabled={saving}>{saving ? '저장 중...' : '생성'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-secondary border-b border-border">
                <tr>
                  <th className="text-left p-3">코드</th>
                  <th className="text-left p-3">이름</th>
                  <th className="text-left p-3">할인</th>
                  <th className="text-left p-3">대상</th>
                  <th className="text-left p-3">사용</th>
                  <th className="text-left p-3">만료</th>
                  <th className="text-center p-3">활성</th>
                </tr>
              </thead>
              <tbody>
                {coupons.length === 0 ? (
                  <tr><td colSpan={7} className="text-center text-muted-foreground p-8">등록된 쿠폰이 없습니다.</td></tr>
                ) : coupons.map(c => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="p-3 font-mono font-semibold">{c.coupon_code}</td>
                    <td className="p-3">{c.coupon_name}</td>
                    <td className="p-3">
                      {c.discount_type === 'fixed' ? formatKRW(c.discount_value) : `${c.discount_value}%`}
                      {c.max_discount_amount && <span className="text-xs text-muted-foreground"> (최대 {formatKRW(c.max_discount_amount)})</span>}
                    </td>
                    <td className="p-3 text-xs">{c.target_type}{c.target_plan ? ` / ${c.target_plan}` : ''}</td>
                    <td className="p-3 text-xs">{c.total_uses}{c.max_total_uses ? ` / ${c.max_total_uses}` : ''} <span className="text-muted-foreground">(계정당 {c.max_use_per_user})</span></td>
                    <td className="p-3 text-xs">{c.expires_at ? new Date(c.expires_at).toLocaleDateString('ko-KR') : '무제한'}</td>
                    <td className="p-3 text-center"><Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
