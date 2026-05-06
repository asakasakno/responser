import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type StepUpHandler = () => Promise<boolean>;

let stepUpHandler: StepUpHandler | null = null;
export function registerStepUpHandler(h: StepUpHandler | null) {
  stepUpHandler = h;
}

export function useAdminAction() {
  const [loading, setLoading] = useState<string | null>(null);
  const lastParamsRef = useRef<any>(null);

  const invoke = useCallback(async (action: string, params: Record<string, any> = {}, loadingKey?: string) => {
    const key = loadingKey || action;
    setLoading(key);


    const callOnce = async () => {
      const { data, error } = await supabase.functions.invoke('admin', {
        body: { action, ...params },
      });

      let body: any = data;
      if (error) {
        const ctx: any = (error as any).context;
        try {
          if (ctx && typeof ctx.json === 'function') {
            body = await ctx.clone().json();
          } else if (ctx?.body) {
            body = typeof ctx.body === 'string' ? JSON.parse(ctx.body) : ctx.body;
          }
        } catch { /* ignore */ }
      }
      return { data, body, error };
    };

    try {
      const first = await callOnce();
      if (first.body?.code === 'STEP_UP_REQUIRED' && stepUpHandler) {
        const ok = await stepUpHandler();
        if (!ok) return null;
        const retry = await callOnce();
        if (retry.error && retry.body?.code !== 'STEP_UP_REQUIRED') {
          throw new Error(retry.body?.error || retry.error.message);
        }
        return retry.data ?? retry.body;
      }
      if (first.error) {
        throw new Error(first.body?.error || first.error.message);
      }
      return first.data;
    } catch (err: any) {
      toast({ title: '오류', description: err.message || '작업에 실패했습니다.', variant: 'destructive' });
      return null;
    } finally {
      setLoading(null);
    }
  }, []);

  return { invoke, loading };
}
