import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdminAction } from '@/hooks/useAdminAction';
import { Zap, TrendingDown, TrendingUp, Activity } from 'lucide-react';

export default function AdminEnergy() {
  const { invoke } = useAdminAction();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    invoke('energy_stats').then(data => data && setStats(data));
  }, []);

  if (!stats) return <div className="text-center py-12 text-muted-foreground">로딩 중...</div>;

  const kpis = [
    { label: '총 지급 에너지', value: stats.totalEarned.toLocaleString(), icon: TrendingUp, color: 'text-green-500' },
    { label: '총 사용 에너지', value: stats.totalSpent.toLocaleString(), icon: TrendingDown, color: 'text-red-500' },
    { label: '평균 잔액', value: stats.avgBalance.toLocaleString(), icon: Activity, color: 'text-blue-500' },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">응답에너지 관리</h1>

      <div className="grid grid-cols-3 gap-3">
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
        <CardHeader><CardTitle className="text-base">최근 트랜잭션</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>사용자</TableHead>
                  <TableHead>유형</TableHead>
                  <TableHead className="text-right">수량</TableHead>
                  <TableHead>사유</TableHead>
                  <TableHead>설명</TableHead>
                  <TableHead>날짜</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(stats.transactions || []).slice(0, 100).map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs">{t.user_id.substring(0, 8)}...</TableCell>
                    <TableCell>
                      <Badge variant={t.type === 'earn' ? 'default' : 'destructive'} className="text-xs">
                        {t.type === 'earn' ? '지급' : '사용'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <span className={t.type === 'earn' ? 'text-green-600' : 'text-red-600'}>
                        {t.type === 'earn' ? '+' : '-'}{t.amount}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{t.reason}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{t.description || '-'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleDateString('ko-KR')}
                    </TableCell>
                  </TableRow>
                ))}
                {(stats.transactions || []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">트랜잭션이 없습니다.</TableCell>
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
