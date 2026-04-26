import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAdminAction } from '@/hooks/useAdminAction';
import { toast } from '@/hooks/use-toast';

interface ConsistencyIssue {
  user_id: string;
  email: string;
  plan: string;
  max_energy: number;
  energy_balance: number;
  expected_max: number;
  problems: string[];
}

export default function AdminSettings() {
  const { invoke, loading } = useAdminAction();
  const [result, setResult] = useState<{ total_checked: number; issue_count: number; issues: ConsistencyIssue[] } | null>(null);

  const runCheck = async () => {
    const data = await invoke('verify_plan_consistency');
    if (data) {
      setResult(data);
      if (data.issue_count === 0) {
        toast({ title: '정합성 OK', description: `${data.total_checked}명 모두 정상입니다.` });
      } else {
        toast({
          title: '정합성 오류 감지',
          description: `${data.issue_count}건의 불일치가 발견되었습니다.`,
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">설정</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            플랜 ↔ 에너지 정합성 검증
          </CardTitle>
          <CardDescription>
            모든 사용자의 subscriptions.plan, profiles.max_energy, energy_balance가 일치하는지 확인합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={runCheck} disabled={loading !== null}>
            {loading === 'verify_plan_consistency' ? '검증 중...' : '전체 사용자 검증 실행'}
          </Button>

          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Badge variant="outline">검사: {result.total_checked}명</Badge>
                {result.issue_count === 0 ? (
                  <Badge variant="secondary">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> 정상
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <AlertTriangle className="w-3 h-3 mr-1" /> 불일치 {result.issue_count}건
                  </Badge>
                )}
              </div>

              {result.issues.length > 0 && (
                <div className="rounded-md border divide-y max-h-96 overflow-y-auto">
                  {result.issues.map(issue => (
                    <div key={issue.user_id} className="p-3 text-sm space-y-1">
                      <div className="font-medium">{issue.email}</div>
                      <div className="text-xs text-muted-foreground">
                        plan={issue.plan} · max={issue.max_energy}/{issue.expected_max} · balance={issue.energy_balance}
                      </div>
                      <ul className="text-xs text-destructive list-disc list-inside">
                        {issue.problems.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="w-4 h-4" />
            시스템 설정
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            추가 설정 기능은 추후 업데이트될 예정입니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
