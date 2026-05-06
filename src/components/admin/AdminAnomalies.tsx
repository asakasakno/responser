import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAdminAction } from '@/hooks/useAdminAction';
import { toast } from '@/hooks/use-toast';
import { RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

const KIND_LABEL: Record<string, string> = {
  duplicate_payment: '중복 결제',
  missing_credit: '크레딧 미지급',
  refund_failed: '환불 실패',
  abnormal_usage: '이상 사용량',
  partial_recovery_needed: '부분 회수 필요',
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  warning: 'bg-yellow-100 text-yellow-800',
  info: 'bg-blue-100 text-blue-800',
};

export default function AdminAnomalies() {
  const { invoke, loading } = useAdminAction();
  const [items, setItems] = useState<any[]>([]);
  const [kindFilter, setKindFilter] = useState('all');
  const [resolvedFilter, setResolvedFilter] = useState('open');
  const [resolveDlg, setResolveDlg] = useState<any>(null);
  const [reason, setReason] = useState('');

  const fetchItems = async () => {
    const params: any = { limit: 300 };
    if (kindFilter !== 'all') params.kind = kindFilter;
    if (resolvedFilter === 'open') params.resolved = false;
    else if (resolvedFilter === 'resolved') params.resolved = true;
    const data = await invoke('anomalies_list', params);
    if (data) setItems(data.anomalies || []);
  };

  useEffect(() => { fetchItems(); /* eslint-disable-next-line */ }, [kindFilter, resolvedFilter]);

  const rescan = async () => {
    const data = await invoke('anomalies_rescan');
    if (data?.success) {
      toast({ title: '스캔 완료', description: JSON.stringify(data.result) });
      fetchItems();
    }
  };

  const submitResolve = async () => {
    if (!resolveDlg || reason.trim().length < 5) {
      toast({ title: '사유는 5자 이상 입력해주세요.', variant: 'destructive' });
      return;
    }
    const data = await invoke('anomaly_resolve', { anomaly_id: resolveDlg.id, reason });
    if (data?.success) {
      toast({ title: '해결 처리 완료' });
      setResolveDlg(null);
      setReason('');
      fetchItems();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">이상 탐지</h1>
        <Button onClick={rescan} disabled={loading === 'anomalies_rescan'} size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading === 'anomalies_rescan' ? 'animate-spin' : ''}`} />
          수동 Rescan
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex gap-2 flex-wrap">
            <Select value={kindFilter} onValueChange={setKindFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 유형</SelectItem>
                {Object.entries(KIND_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={resolvedFilter} onValueChange={setResolvedFilter}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">미해결</SelectItem>
                <SelectItem value="resolved">해결됨</SelectItem>
                <SelectItem value="all">전체</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>유형</TableHead>
                  <TableHead>심각도</TableHead>
                  <TableHead>사용자</TableHead>
                  <TableHead>상세</TableHead>
                  <TableHead>발생</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((a) => (
                  <TableRow key={a.id} className={a.resolved_at ? 'opacity-60' : ''}>
                    <TableCell className="text-xs font-medium">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
                        {KIND_LABEL[a.kind] || a.kind}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${SEVERITY_COLOR[a.severity] || ''} text-xs border-0`}>{a.severity}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{a.email || '-'}</TableCell>
                    <TableCell className="text-xs max-w-md">
                      <pre className="whitespace-pre-wrap break-all text-[10px] text-muted-foreground">
                        {JSON.stringify(a.payload, null, 0)}
                      </pre>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleString('ko-KR')}
                    </TableCell>
                    <TableCell>
                      {a.resolved_at ? (
                        <div className="flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          해결
                        </div>
                      ) : (
                        <Badge variant="destructive" className="text-xs">미해결</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!a.resolved_at && (
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => setResolveDlg(a)}>
                          해결
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      이상 항목이 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!resolveDlg} onOpenChange={() => { setResolveDlg(null); setReason(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이상 항목 해결 — {resolveDlg && KIND_LABEL[resolveDlg.kind]}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="처리 내역/사유 (5자 이상)" value={reason}
              onChange={(e) => setReason(e.target.value)} />
            {resolveDlg && (
              <pre className="text-[10px] bg-muted p-2 rounded max-h-40 overflow-auto">
                {JSON.stringify(resolveDlg.payload, null, 2)}
              </pre>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResolveDlg(null); setReason(''); }}>취소</Button>
            <Button onClick={submitResolve} disabled={reason.trim().length < 5}>해결 처리</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
