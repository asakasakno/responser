import { useState } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { PLAN_LIMITS } from '@/types';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CreditCard, User, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function SettingsPage() {
  const { user, plan } = useAuth();
  const limits = PLAN_LIMITS[plan];
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요합니다.');

      const { data, error } = await supabase.functions.invoke('delete-account', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await supabase.auth.signOut();
      navigate('/');
      toast({ title: '회원 탈퇴 완료', description: '이용해주셔서 감사합니다.' });
    } catch (err: any) {
      toast({ title: '탈퇴 실패', description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-6">설정</h1>

        {/* Account */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-card mb-4">
          <div className="flex items-center gap-3 mb-4">
            <User className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">계정 정보</h2>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">이메일</span>
              <span className="text-foreground">{user?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">가입일</span>
              <span className="text-foreground">{user?.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : '-'}</span>
            </div>
          </div>
        </div>

        {/* Subscription */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-card mb-4">
          <div className="flex items-center gap-3 mb-4">
            <CreditCard className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">구독 정보</h2>
          </div>
          <div className="space-y-2 text-sm mb-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">현재 플랜</span>
              <span className="text-foreground font-medium capitalize">{plan}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">일일 생성 한도</span>
              <span className="text-foreground">{limits.dailyLimit}회</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">이미지 처리</span>
              <span className="text-foreground">{limits.imageUpload ? `이미지당 ${limits.maxPerImage}개` : '불가'}</span>
            </div>
          </div>
          {plan !== 'pro' && (
            <Link to="/pricing">
              <Button size="sm" className="gradient-primary text-primary-foreground">업그레이드</Button>
            </Link>
          )}
        </div>

        {/* Delete Account */}
        <div className="bg-card rounded-xl border border-destructive/30 p-5 shadow-card">
          <div className="flex items-center gap-3 mb-4">
            <Trash2 className="w-5 h-5 text-destructive" />
            <h2 className="font-semibold text-foreground">회원 탈퇴</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            탈퇴 시 모든 데이터(상품, 생성 기록, 구독 정보)가 영구 삭제되며 복구할 수 없습니다.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">회원 탈퇴</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>정말 탈퇴하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                  이 작업은 되돌릴 수 없습니다. 모든 데이터가 영구적으로 삭제됩니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? '처리 중...' : '탈퇴하기'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </Layout>
  );
}
