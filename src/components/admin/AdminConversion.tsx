import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useAdminAction } from '@/hooks/useAdminAction';
import { TrendingUp, Users, CreditCard, Calendar } from 'lucide-react';

export default function AdminConversion() {
  const { invoke } = useAdminAction();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    invoke('conversion_stats').then(data => data && setStats(data));
  }, []);

  if (!stats) return <div className="text-center py-12 text-muted-foreground">로딩 중...</div>;

  const funnels = [
    {
      label: '가입 → 첫 사용 전환율',
      value: stats.firstUseConversion,
      detail: `${stats.usersWithFirstUse} / ${stats.totalUsers}명`,
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-500',
    },
    {
      label: '첫 사용 → 결제 전환율',
      value: stats.firstUseToPaid,
      detail: `${stats.paidUsers} / ${stats.usersWithFirstUse}명`,
      icon: TrendingUp,
      color: 'text-green-500',
      bg: 'bg-green-500',
    },
    {
      label: '무료 → 유료 전환율',
      value: stats.freeToPaid,
      detail: `${stats.paidUsers} / ${stats.totalUsers}명`,
      icon: CreditCard,
      color: 'text-purple-500',
      bg: 'bg-purple-500',
    },
    {
      label: '7일 유지율',
      value: stats.retention7d,
      detail: '7일 이상 가입 사용자 기준',
      icon: Calendar,
      color: 'text-orange-500',
      bg: 'bg-orange-500',
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">전환 분석</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {funnels.map(f => (
          <Card key={f.label}>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-lg ${f.bg}/10 flex items-center justify-center`}>
                  <f.icon className={`w-5 h-5 ${f.color}`} />
                </div>
                <span className="text-sm font-medium text-muted-foreground">{f.label}</span>
              </div>
              <div className="flex items-end gap-2 mb-3">
                <span className="text-4xl font-bold">{f.value}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 mb-2">
                <div className={`${f.bg} h-2 rounded-full transition-all`} style={{ width: `${Math.min(f.value, 100)}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{f.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
