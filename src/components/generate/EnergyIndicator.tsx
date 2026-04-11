import { Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface EnergyIndicatorProps {
  balance: number;
  maxEnergy: number;
  loading?: boolean;
}

export default function EnergyIndicator({ balance, maxEnergy, loading }: EnergyIndicatorProps) {
  if (loading) {
    return <div className="w-24 h-6 bg-secondary animate-pulse rounded-full" />;
  }

  const percentage = (balance / maxEnergy) * 100;
  const isLow = balance <= Math.ceil(maxEnergy * 0.15);
  const isDepleted = balance <= 0;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <Zap className={`w-4 h-4 ${isDepleted ? 'text-destructive' : isLow ? 'text-yellow-500' : 'text-primary'}`} />
        <span className={`text-sm font-bold tabular-nums ${isDepleted ? 'text-destructive' : isLow ? 'text-yellow-500' : 'text-foreground'}`}>
          {balance}
        </span>
        <span className="text-xs text-muted-foreground">/ {maxEnergy}</span>
      </div>
      <div className="w-20 bg-secondary rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${isDepleted ? 'bg-destructive' : isLow ? 'bg-yellow-500' : 'bg-primary'}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {isLow && (
        <Link to="/rewards">
          <Button size="sm" variant="outline" className="text-xs h-7 px-2">
            <Zap className="w-3 h-3 mr-1" />
            충전
          </Button>
        </Link>
      )}
    </div>
  );
}
