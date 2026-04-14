import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdminAction } from '@/hooks/useAdminAction';
import { BarChart3, Activity, Zap } from 'lucide-react';

export default function AdminAIUsage() {
  const { invoke } = useAdminAction();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    invoke('ai_usage_stats').then(data => data && setStats(data));
  }, []);

  if (!stats) return <div className="text-center py-12 text-muted-foreground">로딩 중...</div>;

  const kpis = [
    { label: '오늘 총 요청 수', value: stats.todayTotal, icon: BarChart3, color: 'text-blue-500' },
    { label: '전체 응답 생성 수', value: stats.totalGenerations, icon: Zap, color: 'text-green-500' },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">AI 사용량</h1>

      <div className="grid grid-cols-2 gap-3">
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
        <CardHeader><CardTitle className="text-base">사용자별 사용량</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이메일</TableHead>
                  <TableHead className="text-right">오늘 요청 수</TableHead>
                  <TableHead className="text-right">총 요청 수</TableHead>
                  <TableHead>마지막 사용</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(stats.userStats || [])
                  .sort((a: any, b: any) => b.totalCount - a.totalCount)
                  .map((u: any) => (
                    <TableRow key={u.user_id}>
                      <TableCell className="text-xs font-medium">{u.email}</TableCell>
                      <TableCell className="text-right">{u.todayCount}</TableCell>
                      <TableCell className="text-right font-medium">{u.totalCount}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{u.lastUsed || '-'}</TableCell>
                    </TableRow>
                  ))}
                {(stats.userStats || []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">데이터가 없습니다.</TableCell>
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
