import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdminAction } from '@/hooks/useAdminAction';

const SEV: Record<string, string> = {
  info: 'bg-blue-100 text-blue-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  critical: 'bg-red-200 text-red-900',
};

export default function AdminAuditLog() {
  const { invoke } = useAdminAction();
  const [logs, setLogs] = useState<any[]>([]);
  const [actionFilter, setActionFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');

  const fetch = async () => {
    const params: any = { limit: 300 };
    if (actionFilter) params.action = actionFilter;
    if (severityFilter !== 'all') params.severity = severityFilter;
    const data = await invoke('audit_log_list', params);
    if (data) setLogs(data.logs || []);
  };

  useEffect(() => { fetch(); /* eslint-disable-next-line */ }, [severityFilter]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">감사 로그</h1>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="action 검색 (예: admin_change_plan)" value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetch()}
              className="max-w-sm" />
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="info">info</SelectItem>
                <SelectItem value="warning">warning</SelectItem>
                <SelectItem value="error">error</SelectItem>
                <SelectItem value="critical">critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>시각</TableHead>
                  <TableHead>심각도</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>상세</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleString('ko-KR')}</TableCell>
                    <TableCell><Badge className={`${SEV[l.severity] || ''} text-xs border-0`}>{l.severity}</Badge></TableCell>
                    <TableCell className="text-xs font-medium">{l.action}</TableCell>
                    <TableCell className="text-xs">{l.actor_email || l.user_id?.slice(0, 8) || '-'}</TableCell>
                    <TableCell className="text-[10px] max-w-md">
                      <pre className="whitespace-pre-wrap break-all text-muted-foreground">{JSON.stringify(l.details)}</pre>
                    </TableCell>
                    <TableCell className="text-[10px] text-muted-foreground">{l.ip_address || '-'}</TableCell>
                  </TableRow>
                ))}
                {logs.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">로그가 없습니다.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
