import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';

interface EnergyAnimationProps {
  amount: number;
  type: 'earn' | 'spend';
  onComplete?: () => void;
}

export default function EnergyAnimation({ amount, type, onComplete }: EnergyAnimationProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, 2000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!visible) return null;

  const isEarn = type === 'earn';

  return (
    <div className="fixed top-20 right-8 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-elevated border ${
        isEarn
          ? 'bg-accent/10 border-accent/30 text-accent'
          : 'bg-destructive/10 border-destructive/30 text-destructive'
      }`}>
        <Zap className="w-5 h-5" />
        <span className="font-bold text-lg tabular-nums">
          {isEarn ? '+' : '-'}{amount}
        </span>
        <span className="text-sm font-medium">응답에너지</span>
      </div>
    </div>
  );
}
