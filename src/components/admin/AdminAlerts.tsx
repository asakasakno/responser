import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAdminAction } from '@/hooks/useAdminAction';
import { AlertTriangle, ShieldAlert, CreditCard, Zap } from 'lucide-react';

export default function AdminAlerts() {
  const { invoke } = useAdminAction();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);

  useEffect(() => {
    invoke('alerts').then(data => {
      if (data) setAlerts(data.alerts || []);
      setLoadingAlerts(false);
    });
  }, []);

  const iconMap: Record<string, any> = {
    high_usage: AlertTriangle,
    abnormal_energy: Zap,
    payment_failure: CreditCard,
    suspicious_login: ShieldAlert,
  };

  const typeLabels: Record<string, string> = {
    high_usage: '과다 사용',
    abnormal_energy: '비정상 에너지',
    payment_failure: '결제 실패',
    suspicious_login: '비정상 로그인',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">이상 감지</h1>
        {alerts.length > 0 && (
          <Badge variant="destructive" className="text-xs">{alerts.length}건</Badge>
        )}
      </div>

      {loadingAlerts ? (
        <p className="text-center py-12 text-muted-foreground">로딩 중...</p>
      ) : alerts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShieldAlert className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-lg font-medium">이상 감지된 항목이 없습니다</p>
            <p className="text-sm text-muted-foreground mt-1">시스템이 정상적으로 운영되고 있습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert, idx) => {
            const Icon = iconMap[alert.type] || AlertTriangle;
            const isCritical = alert.severity === 'critical';
            return (
              <Card key={idx} className={isCritical ? 'border-destructive/50 bg-destructive/5' : 'border-yellow-500/30 bg-yellow-50/5'}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isCritical ? 'bg-destructive/10' : 'bg-yellow-500/10'
                  }`}>
                    <Icon className={`w-4.5 h-4.5 ${isCritical ? 'text-destructive' : 'text-yellow-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge variant={isCritical ? 'destructive' : 'secondary'} className="text-[10px]">
                        {isCritical ? '심각' : '경고'}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {typeLabels[alert.type] || alert.type}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">{alert.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{alert.email} · {alert.date}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
