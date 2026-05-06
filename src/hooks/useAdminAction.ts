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
    try {
      const { data, error } = await supabase.functions.invoke('admin', {
        body: { action, ...params },
      });

      if (error) {
        // Step-up 필요시 다이얼로그 띄우고 재시도
        const ctx: any = (error as any).context;
        let body: any = data;
        try {
          if (!body && ctx?.body) body = typeof ctx.body === 'string' ? JSON.parse(ctx.body) : ctx.body;
        } catch { /* ignore */ }
        if (body?.code === 'STEP_UP_REQUIRED' && stepUpHandler) {
          const ok = await stepUpHandler();
          if (ok) {
            const retry = await supabase.functions.invoke('admin', { body: { action, ...params } });
            if (retry.error) throw retry.error;
            return retry.data;
          }
          return null;
        }
        throw error;
      }

      if (data?.code === 'STEP_UP_REQUIRED' && stepUpHandler) {
        const ok = await stepUpHandler();
        if (ok) {
          const retry = await supabase.functions.invoke('admin', { body: { action, ...params } });
          if (retry.error) throw retry.error;
          return retry.data;
        }
        return null;
      }

      return data;
    } catch (err: any) {
      toast({ title: '오류', description: err.message || '작업에 실패했습니다.', variant: 'destructive' });
      return null;
    } finally {
      setLoading(null);
    }
  }, []);

  return { invoke, loading };
}
