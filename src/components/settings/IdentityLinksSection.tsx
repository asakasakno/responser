import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link as LinkIcon, Mail, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams } from 'react-router-dom';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type Provider = 'email' | 'google' | 'kakao';
type Link = { provider: Provider; provider_email: string | null; email_verified: boolean; linked_at: string };

const PROVIDER_LABEL: Record<Provider, string> = {
  email: '이메일 로그인',
  google: 'Google 로그인',
  kakao: 'Kakao 로그인',
};

export default function IdentityLinksSection() {
  const { toast } = useToast();
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Provider | null>(null);
  const [search, setSearch] = useSearchParams();

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('identity-links', { body: { action: 'list' } });
    setLoading(false);
    if (error) {
      toast({ title: '연결 정보를 불러오지 못했습니다', description: error.message, variant: 'destructive' });
      return;
    }
    setLinks((data?.links ?? []) as Link[]);
  }, [toast]);

  useEffect(() => { refresh(); }, [refresh]);

  // Handle return from OAuth flows
  useEffect(() => {
    const link = search.get('link');
    const linkErr = search.get('link_error');
    if (link === 'kakao_success') {
      toast({ title: 'Kakao 연결 완료' });
      search.delete('link'); setSearch(search, { replace: true });
      refresh();
    } else if (link === 'google_pending') {
      // Need to sync after client linkIdentity returned
      (async () => {
        const { data, error } = await supabase.functions.invoke('identity-links', { body: { action: 'sync_google' } });
        if (error || data?.error) {
          toast({ title: 'Google 연결 실패', description: data?.error || error?.message, variant: 'destructive' });
        } else {
          toast({ title: 'Google 연결 완료' });
        }
        search.delete('link'); setSearch(search, { replace: true });
        refresh();
      })();
    } else if (linkErr) {
      const map: Record<string, string> = {
        email_required: '카카오 이메일 동의가 필요합니다.',
        already_linked: '이미 다른 계정에 연결된 카카오 계정입니다.',
        admin_email_mismatch: '관리자 계정은 동일 이메일의 소셜 계정만 연결할 수 있습니다.',
        insert_failed: '연결 저장에 실패했습니다.',
      };
      toast({ title: '연결 실패', description: map[linkErr] || linkErr, variant: 'destructive' });
      search.delete('link_error'); setSearch(search, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLinked = (p: Provider) => links.some(l => l.provider === p);
  const activeCount = links.length;

  const linkKakao = async () => {
    setBusy('kakao');
    const { data, error } = await supabase.functions.invoke('identity-links', { body: { action: 'start_kakao_link' } });
    setBusy(null);
    if (error || !data?.url) {
      toast({ title: 'Kakao 연결을 시작할 수 없습니다', description: error?.message, variant: 'destructive' });
      return;
    }
    window.location.href = data.url;
  };

  const linkGoogle = async () => {
    setBusy('google');
    try {
      // Use Supabase linkIdentity to attach google to current user (managed Google in Lovable Cloud)
      const redirectTo = `${window.location.origin}/settings?link=google_pending`;
      const { data, error } = await supabase.auth.linkIdentity({ provider: 'google', options: { redirectTo } });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast({ title: 'Google 연결 실패', description: e?.message, variant: 'destructive' });
      setBusy(null);
    }
  };

  const unlink = async (provider: Provider) => {
    setBusy(provider);
    const { data, error } = await supabase.functions.invoke('identity-links', {
      body: { action: 'unlink', provider },
    });
    setBusy(null);
    if (error || data?.error) {
      toast({ title: '연결 해제 실패', description: data?.error || error?.message, variant: 'destructive' });
      return;
    }
    toast({ title: '연결을 해제했습니다' });
    refresh();
  };

  const renderRow = (provider: Provider) => {
    const linked = isLinked(provider);
    const link = links.find(l => l.provider === provider);
    const isLast = linked && activeCount <= 1;
    const disabledUnlink = isLast;

    return (
      <div key={provider} className="flex items-center justify-between py-3 border-b border-border last:border-0">
        <div className="flex items-center gap-3">
          {provider === 'email' ? <Mail className="w-4 h-4 text-muted-foreground" /> : <LinkIcon className="w-4 h-4 text-muted-foreground" />}
          <div>
            <div className="text-sm font-medium text-foreground">{PROVIDER_LABEL[provider]}</div>
            {linked && link?.provider_email && (
              <div className="text-xs text-muted-foreground mt-0.5">{link.provider_email}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {linked ? (
            <>
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="w-3 h-3" /> 연결됨
              </Badge>
              {provider !== 'email' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" disabled={disabledUnlink || busy === provider}>
                      연결 해제
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{PROVIDER_LABEL[provider]} 연결을 해제할까요?</AlertDialogTitle>
                      <AlertDialogDescription>
                        해제 후에는 해당 방식으로 로그인할 수 없습니다.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>취소</AlertDialogCancel>
                      <AlertDialogAction onClick={() => unlink(provider)}>해제하기</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          ) : provider === 'email' ? (
            <Badge variant="outline">미설정</Badge>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => (provider === 'kakao' ? linkKakao() : linkGoogle())}
              disabled={busy === provider}
            >
              {busy === provider ? '...' : `${PROVIDER_LABEL[provider].replace(' 로그인', '')} 연결하기`}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-card mb-4">
      <div className="flex items-center gap-3 mb-1">
        <LinkIcon className="w-5 h-5 text-primary" />
        <h2 className="font-semibold text-foreground">로그인 연결 관리</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        자주 사용하는 로그인 방식을 연결해두면 더 편하게 로그인할 수 있습니다.
      </p>
      {loading ? (
        <div className="text-sm text-muted-foreground py-4">불러오는 중...</div>
      ) : (
        <div>
          {(['email', 'google', 'kakao'] as Provider[]).map(renderRow)}
          {activeCount <= 1 && (
            <p className="text-xs text-muted-foreground mt-3">
              ※ 마지막 로그인 수단은 해제할 수 없습니다.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
