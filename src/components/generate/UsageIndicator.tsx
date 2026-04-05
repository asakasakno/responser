import { Loader2 } from 'lucide-react';

interface UsageIndicatorProps {
  todayUsage: number;
  dailyLimit: number;
  unlimited: boolean;
  loading: boolean;
}

export default function UsageIndicator({ todayUsage, dailyLimit, unlimited, loading }: UsageIndicatorProps) {
  if (loading) {
    return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
  }

  if (unlimited) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">오늘 사용:</span>
        <span className="font-semibold text-foreground">{todayUsage}회</span>
        <span className="text-xs text-accent font-medium px-2 py-0.5 bg-accent/10 rounded-full">무제한</span>
      </div>
    );
  }

  const remaining = Math.max(0, dailyLimit - todayUsage);
  const percentage = (todayUsage / dailyLimit) * 100;
  const isLow = remaining <= Math.ceil(dailyLimit * 0.2);
  const isDepleted = remaining <= 0;

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">남은 횟수:</span>
        <span className={`font-semibold ${isDepleted ? 'text-destructive' : isLow ? 'text-yellow-500' : 'text-foreground'}`}>
          {remaining}/{dailyLimit}
        </span>
      </div>
      <div className="w-20 bg-secondary rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${isDepleted ? 'bg-destructive' : isLow ? 'bg-yellow-500' : 'bg-primary'}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
