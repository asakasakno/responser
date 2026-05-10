import { useEffect, useState } from 'react';
import { useAdminAction } from '@/hooks/useAdminAction';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { RefreshCw, Loader2 } from 'lucide-react';

interface BetaApp {
  id: string;
  email: string;
  business_name: string | null;
  industry: string | null;
  platforms: string[];
  needed_features: string[];
  pain_point: string | null;
  status: string;
  source: string;
  matched_user_id: string | null;
  applied_at: string | null;
  error_message: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, { label: string; variant: any }> = {
  pending: { label: '대기', variant: 'secondary' },
  applied: { label: '적용됨', variant: 'default' },
  not_found: { label: '미가입', variant: 'outline' },
  duplicate: { label: '중복', variant: 'outline' },
  skipped: { label: '제외', variant: 'secondary' },
  failed: { label: '실패', variant: 'destructive' },
  reprocessed: { label: '재처리됨', variant: 'outline' },
};

export default function AdminBetaApplications() {
  const { invoke, loading } = useAdminAction();
  const [apps, setApps] = useState<BetaApp[]>([]);
  const [status, setStatus] = useState<string>('all');
  const [reprocessing, setReprocessing] = useState<string | null>(null);

  const load = async () => {
    const res = await invoke('beta_applications_list', { status, limit: 500 });
    if (res?.applications) setApps(res.applications);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  const reprocess = async (id: string) => {
    setReprocessing(id);
    const res = await invoke('beta_application_reprocess', { application_id: id });
    setReprocessing(null);
    if (res) {
      const r = res.result?.results?.[0];
      toast({ title: '재처리 완료', description: `결과: ${r?.status ?? '알 수 없음'}` });
      load();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">무료 베타 신청</h1>
          <p className="text-sm text-muted-foreground">구글폼 신청 데이터를 자동 처리한 결과입니다.</p>
        </div>
        <div className="flex gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="applied">적용됨</SelectItem>
              <SelectItem value="not_found">미가입</SelectItem>
              <SelectItem value="duplicate">중복</SelectItem>
              <SelectItem value="skipped">제외</SelectItem>
              <SelectItem value="failed">실패</SelectItem>
              <SelectItem value="reprocessed">재처리됨</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading === 'beta_applications_list'}>
            <RefreshCw className="h-4 w-4 mr-1" />새로고침
          </Button>
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-left">
              <th className="p-3">신청일</th>
              <th className="p-3">이메일</th>
              <th className="p-3">상호명</th>
              <th className="p-3">업종</th>
              <th className="p-3">플랫폼</th>
              <th className="p-3">필요 기능</th>
              <th className="p-3">상태</th>
              <th className="p-3">적용일</th>
              <th className="p-3">에러</th>
              <th className="p-3">작업</th>
            </tr>
          </thead>
          <tbody>
            {apps.length === 0 && (
              <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">데이터 없음</td></tr>
            )}
            {apps.map(a => {
              const meta = STATUS_LABEL[a.status] ?? { label: a.status, variant: 'outline' };
              return (
                <tr key={a.id} className="border-t border-border align-top">
                  <td className="p-3 whitespace-nowrap">{new Date(a.created_at).toLocaleString('ko-KR')}</td>
                  <td className="p-3">{a.email}</td>
                  <td className="p-3">{a.business_name ?? '-'}</td>
                  <td className="p-3">{a.industry ?? '-'}</td>
                  <td className="p-3 max-w-[200px]">{a.platforms?.join(', ') || '-'}</td>
                  <td className="p-3 max-w-[200px]">{a.needed_features?.join(', ') || '-'}</td>
                  <td className="p-3"><Badge variant={meta.variant}>{meta.label}</Badge></td>
                  <td className="p-3 whitespace-nowrap">{a.applied_at ? new Date(a.applied_at).toLocaleString('ko-KR') : '-'}</td>
                  <td className="p-3 text-xs text-destructive max-w-[200px] break-words">{a.error_message ?? ''}</td>
                  <td className="p-3">
                    {(['not_found','failed','reprocessed','duplicate','skipped'].includes(a.status)) && (
                      <Button size="sm" variant="outline" disabled={reprocessing === a.id}
                        onClick={() => reprocess(a.id)}>
                        {reprocessing === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : '재처리'}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
