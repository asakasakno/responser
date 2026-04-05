import { useAuth } from '@/contexts/AuthContext';
import { PLAN_LIMITS } from '@/types';
import Layout from '@/components/Layout';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MessageSquare, Image, Package, ArrowRight, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  const { user, plan } = useAuth();
  const limits = PLAN_LIMITS[plan];

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-1">안녕하세요! 👋</h1>
          <p className="text-muted-foreground">오늘도 고객 응대를 자동화하세요</p>
        </div>

        {/* Plan Card */}
        <div className="bg-card rounded-xl border border-border p-6 mb-8 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">현재 플랜</p>
              <p className="text-xl font-bold text-foreground capitalize">{plan}</p>
              <p className="text-sm text-muted-foreground mt-1">
                일일 {limits.dailyLimit}회 · {limits.imageUpload ? `이미지당 최대 ${limits.maxPerImage}개` : '이미지 처리 불가'}
              </p>
            </div>
            {plan === 'free' && (
              <Link to="/pricing">
                <Button size="sm" className="gradient-primary text-primary-foreground">
                  업그레이드 <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <h2 className="text-lg font-semibold text-foreground mb-4">빠른 시작</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[
            { to: '/generate?type=review', icon: MessageSquare, title: '리뷰 답변 생성', desc: '고객 리뷰에 대한 전문적인 답변', color: 'text-primary' },
            { to: '/generate?type=inquiry', icon: TrendingUp, title: '문의 답변 생성', desc: '상품 문의에 정확한 답변', color: 'text-accent' },
            { to: '/generate?type=claim', icon: Image, title: '클레임 대응 생성', desc: '불만/교환/환불 전문 대응', color: 'text-destructive' },
          ].map((action, i) => (
            <Link key={i} to={action.to} className="bg-card rounded-xl border border-border p-5 hover:shadow-elevated transition-shadow group">
              <action.icon className={`w-8 h-8 ${action.color} mb-3`} />
              <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">{action.title}</h3>
              <p className="text-sm text-muted-foreground">{action.desc}</p>
            </Link>
          ))}
        </div>

        {/* Tips */}
        <div className="bg-primary/5 rounded-xl p-6 border border-primary/10">
          <div className="flex items-start gap-3">
            <Package className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h3 className="font-semibold text-foreground mb-1">상품을 등록하면 더 정확한 답변이 생성됩니다</h3>
              <p className="text-sm text-muted-foreground mb-3">상품명, 카테고리, 특이사항을 등록하면 AI가 맥락을 이해합니다.</p>
              <Link to="/products">
                <Button variant="outline" size="sm">상품 등록하기</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
