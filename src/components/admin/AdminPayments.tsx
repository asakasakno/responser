import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useAdminAction } from '@/hooks/useAdminAction';
import { toast } from '@/hooks/use-toast';
import { DollarSign, TrendingUp, CreditCard, CheckCircle } from 'lucide-react';

export default function AdminPayments() {
  const { invoke } = useAdminAction();
  const [stats, setStats] = useState<any>(null);

  // refund issue dialog
  const [refundDlg, setRefundDlg] = useState<any>(null);
  const [refundStatus, setRefundStatus] = useState<'pending' | 'success' | 'failed'>('success');
  const [refundReason, setRefundReason] = useState('');
  const [recoverEnergy, setRecoverEnergy] = useState('');

  const fetchData = async () => {
    const data = await invoke('payment_stats');
    if (data) setStats(data);
  };

  useEffect(() => { fetchData(); }, []);

  const handleStatusChange = async (paymentId: string, status: string) => {
    const result = await invoke('update_payment_status', { payment_id: paymentId, status });
    if (result?.success) {
      toast({ title: '완료', description: '결제 상태가 변경되었습니다.' });
      fetchData();
    }
  };

  const submitRefundIssue = async () => {
    if (!refundDlg || refundReason.trim().length < 5) {
      toast({ title: '사유는 5자 이상 입력해주세요.', variant: 'destructive' });
      return;
    }
    const result = await invoke('mark_refund_issue', {
      payment_id: refundDlg.id,
      refund_status: refundStatus,
      refund_amount: refundDlg.amount,
      reason: refundReason,
      recover_energy: recoverEnergy ? parseInt(recoverEnergy) : 0,
    });
    if (result?.success) {
      toast({
        title: '처리 완료',
        description: result.recovery?.shortfall > 0
          ? `회수 ${result.recovery.recovered}, 부족분 ${result.recovery.shortfall}은 이상 항목으로 기록됨`
          : '환불 처리 상태가 기록되었습니다.',
      });
      setRefundDlg(null);
      setRefundReason('');
      setRecoverEnergy('');
      fetchData();
    }
  };

  if (!stats) return <div className="text-center py-12 text-muted-foreground">로딩 중...</div>;

  const kpis = [
    { label: '오늘 매출', value: `₩${stats.todayRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-green-500' },
    { label: '이번달 매출', value: `₩${stats.monthRevenue.toLocaleString()}`, icon: TrendingUp, color: 'text-blue-500' },
    { label: '총 매출', value: `₩${stats.totalRevenue.toLocaleString()}`, icon: CreditCard, color: 'text-purple-500' },
    { label: '결제 성공률', value: `${stats.successRate}%`, icon: CheckCircle, color: 'text-yellow-500' },
  ];

  const statusColors: Record<string, string> = {
    success: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800',
    refunded: 'bg-orange-100 text-orange-800',
  };
  const statusLabels: Record<string, string> = {
    success: '성공', failed: '실패', cancelled: '취소', refunded: '환불',
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">결제 관리</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
              </div>
              <p className="text-xl font-bold">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">결제 내역</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이메일</TableHead>
                  <TableHead className="text-right">금액</TableHead>
                  <TableHead>상품</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>결제일</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(stats.payments || []).map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs font-medium">{p.email}</TableCell>
                    <TableCell className="text-right font-medium">₩{p.amount.toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{p.product_name}</TableCell>
                    <TableCell>
                      <Select value={p.status} onValueChange={s => handleStatusChange(p.id, s)}>
                        <SelectTrigger className="w-[90px] h-7 text-xs">
                          <Badge className={`${statusColors[p.status] || ''} text-xs border-0`}>
                            {statusLabels[p.status] || p.status}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="success">성공</SelectItem>
                          <SelectItem value="failed">실패</SelectItem>
                          <SelectItem value="cancelled">취소</SelectItem>
                          <SelectItem value="refunded">환불</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString('ko-KR')}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => { setRefundDlg(p); setRefundStatus('success'); }}>
                        환불 처리
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(stats.payments || []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      결제 내역이 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 환불 처리 다이얼로그 (실제 Toss 환불 API 호출 안 함 — 수동 기록) */}
      <Dialog open={!!refundDlg} onOpenChange={() => { setRefundDlg(null); setRefundReason(''); setRecoverEnergy(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>환불/취소 수동 처리</DialogTitle>
            <DialogDescription>
              실제 Toss 환불 API는 아직 연동되지 않았습니다. 운영 기록·에너지 회수만 수행합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-xs text-muted-foreground">
              {refundDlg?.email} · ₩{refundDlg?.amount?.toLocaleString()} · {refundDlg?.product_name}
            </div>
            <div>
              <Label className="text-xs">환불 상태</Label>
              <Select value={refundStatus} onValueChange={(v: any) => setRefundStatus(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">진행 중</SelectItem>
                  <SelectItem value="success">완료</SelectItem>
                  <SelectItem value="failed">실패</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">사유 (5자 이상, 필수)</Label>
              <Input value={refundReason} onChange={e => setRefundReason(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">에너지 회수 수량 (선택, 마이너스 불가 — 가능한 만큼만 차감)</Label>
              <Input type="number" min={0} value={recoverEnergy}
                onChange={e => setRecoverEnergy(e.target.value)}
                placeholder="0 = 회수 안 함" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRefundDlg(null); setRefundReason(''); setRecoverEnergy(''); }}>취소</Button>
            <Button onClick={submitRefundIssue} disabled={refundReason.trim().length < 5}>처리</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
