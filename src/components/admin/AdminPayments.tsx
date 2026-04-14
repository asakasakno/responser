import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdminAction } from '@/hooks/useAdminAction';
import { toast } from '@/hooks/use-toast';
import { DollarSign, TrendingUp, CreditCard, CheckCircle } from 'lucide-react';

export default function AdminPayments() {
  const { invoke } = useAdminAction();
  const [stats, setStats] = useState<any>(null);

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
                  </TableRow>
                ))}
                {(stats.payments || []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      결제 내역이 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
