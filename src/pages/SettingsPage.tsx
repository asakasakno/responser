import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { PLAN_LIMITS } from '@/types';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CreditCard, User, Shield } from 'lucide-react';

export default function SettingsPage() {
  const { user, plan } = useAuth();
  const limits = PLAN_LIMITS[plan];

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
      </div>
    </Layout>
  );
}
