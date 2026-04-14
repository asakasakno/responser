import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export function useAdminAction() {
  const [loading, setLoading] = useState<string | null>(null);

  const invoke = useCallback(async (action: string, params: Record<string, any> = {}, loadingKey?: string) => {
    const key = loadingKey || action;
    setLoading(key);
    try {
      const { data, error } = await supabase.functions.invoke('admin', {
        body: { action, ...params },
      });
      if (error) throw error;
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
