import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  active: boolean;          // true while job is in flight
  done: boolean;            // true when finished (push to 100)
  failed?: boolean;
  steps: string[];          // status messages cycled while active
  title?: string;           // e.g. "답변 생성 중"
  subtitle?: string;        // e.g. "4/10 처리 중"
  onRetry?: () => void;
  externalProgress?: number; // 0-100, optional caller-driven target while active
}

/**
 * Perceived progress bar:
 *  - 0 → ramps to ~15% in 0.4s
 *  - while active, eases toward 92% (or externalProgress if provided)
 *  - on `done`, snaps smoothly to 100%
 *  - hides after a beat when complete
 */
export default function SmoothProgress({ active, done, failed, steps, title, subtitle, onRetry, externalProgress }: Props) {
  const [pct, setPct] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);
  const targetRef = useRef<number>(0);

  // Animation loop
  useEffect(() => {
    if (!active && !done && !failed) {
      setPct(0);
      setStepIdx(0);
      targetRef.current = 0;
      return;
    }
    const activeTarget = typeof externalProgress === 'number'
      ? Math.max(5, Math.min(95, externalProgress))
      : 92;
    targetRef.current = failed ? pct : done ? 100 : activeTarget;

    const tick = (ts: number) => {
      const dt = lastTsRef.current ? (ts - lastTsRef.current) / 1000 : 0.016;
      lastTsRef.current = ts;
      setPct((cur) => {
        const target = targetRef.current;
        if (Math.abs(target - cur) < 0.2) return target;
        // ease toward target; faster when finishing
        const speed = done ? 220 : failed ? 0 : Math.max(8, (target - cur) * 1.4);
        const next = cur + speed * dt;
        return next > target ? target : next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, done, failed]);

  // Cycle status text while active
  useEffect(() => {
    if (!active || done || failed) return;
    const id = setInterval(() => {
      setStepIdx((i) => Math.min(i + 1, steps.length - 2));
    }, 1600);
    return () => clearInterval(id);
  }, [active, done, failed, steps.length]);

  if (!active && !done && !failed) return null;

  const message = failed
    ? '처리에 실패했습니다.'
    : done
      ? steps[steps.length - 1] || '완료되었습니다.'
      : steps[stepIdx] || steps[0];

  return (
    <div className={`bg-card rounded-xl border p-4 mb-4 shadow-card animate-fade-in ${failed ? 'border-destructive/40' : 'border-border'}`}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {failed ? (
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          ) : (
            <Loader2 className={`w-4 h-4 text-primary shrink-0 ${done ? '' : 'animate-spin'}`} />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {title || (failed ? '실패' : done ? '완료' : '처리 중')}
              {subtitle ? <span className="ml-2 text-xs text-muted-foreground">{subtitle}</span> : null}
            </p>
            <p className={`text-xs truncate ${failed ? 'text-destructive' : 'text-muted-foreground'}`}>{message}</p>
          </div>
        </div>
        <span className={`text-xs font-mono tabular-nums ${failed ? 'text-destructive' : 'text-muted-foreground'}`}>{Math.round(pct)}%</span>
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden bg-secondary">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${failed ? 'bg-destructive' : 'gradient-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {failed && onRetry && (
        <div className="mt-3">
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> 다시 시도
          </Button>
        </div>
      )}
    </div>
  );
}
