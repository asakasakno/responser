import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdminAction } from '@/hooks/useAdminAction';
import { Users, CreditCard, Zap, BarChart3, TrendingUp, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function AdminDashboard() {
  const { invoke } = useAdminAction();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    invoke('dashboard_stats').then(data => data && setStats(data));
  }, []);

  if (!stats) return <div className="text-center py-12 text-muted-foreground">로딩 중...</div>;

  const kpis = [
    { label: '총 사용자 수', value: stats.totalUsers, icon: Users, color: 'text-blue-500' },
    { label: '유료 사용자 수', value: stats.paidUsers, icon: TrendingUp, color: 'text-green-500' },
    { label: '오늘 매출', value: `₩${stats.todayRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-yellow-500' },
    { label: '이번달 매출', value: `₩${stats.monthRevenue.toLocaleString()}`, icon: CreditCard, color: 'text-purple-500' },
    { label: '총 응답 생성 수', value: stats.totalGenerations, icon: Zap, color: 'text-orange-500' },
    { label: '평균 사용량', value: `${stats.avgUsage}회`, icon: BarChart3, color: 'text-cyan-500' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">대시보드</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">일별 사용량 (30일)</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.dailyUsage.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">데이터 없음</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.dailyUsage}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                    formatter={(v: number) => [`${v}회`, '사용량']}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">일별 매출 (30일)</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.dailyRevenue.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">데이터 없음</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={stats.dailyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                    formatter={(v: number) => [`₩${v.toLocaleString()}`, '매출']}
                  />
                  <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
