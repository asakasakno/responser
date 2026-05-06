import { ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import StepUpDialog from './StepUpDialog';
import { registerStepUpHandler } from '@/hooks/useAdminAction';
import {
  LayoutDashboard, Users, CreditCard, Zap, BarChart3,
  TrendingUp, AlertTriangle, Settings, ArrowLeft, LogOut, Shield, Tag, Mail, Siren, FileText
} from 'lucide-react';

const adminNav = [
  { to: '/admin', label: '대시보드', icon: LayoutDashboard, exact: true },
  { to: '/admin/users', label: '사용자 관리', icon: Users },
  { to: '/admin/payments', label: '결제 관리', icon: CreditCard },
  { to: '/admin/coupons', label: '쿠폰 관리', icon: Tag },
  { to: '/admin/energy', label: '응답에너지 관리', icon: Zap },
  { to: '/admin/ai-usage', label: 'AI 사용량', icon: BarChart3 },
  { to: '/admin/conversion', label: '전환 분석', icon: TrendingUp },
  { to: '/admin/inquiries', label: '문의 관리', icon: Mail },
  { to: '/admin/anomalies', label: '이상 탐지', icon: Siren },
  { to: '/admin/audit', label: '감사 로그', icon: FileText },
  { to: '/admin/alerts', label: '알림', icon: AlertTriangle },
  { to: '/admin/settings', label: '설정', icon: Settings },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-60 flex-col border-r border-border bg-card">
        <div className="p-4 border-b border-border">
          <Link to="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-destructive" />
            </div>
            <div>
              <span className="text-sm font-bold text-foreground block leading-tight">관리자 콘솔</span>
              <span className="text-[10px] text-muted-foreground">응대도우미</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {adminNav.map(item => {
            const active = isActive(item.to, item.exact);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground text-xs"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-2" />
            사용자 화면으로
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground text-xs"
            onClick={async () => { await signOut(); navigate('/'); }}
          >
            <LogOut className="w-3.5 h-3.5 mr-2" />
            로그아웃
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between p-3 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-destructive" />
            <span className="font-bold text-sm">관리자 콘솔</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </header>

        {/* Mobile nav */}
        <div className="md:hidden overflow-x-auto border-b border-border bg-card">
          <div className="flex px-2 py-1.5 gap-1 min-w-max">
            {adminNav.map(item => {
              const active = isActive(item.to, item.exact);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                    active ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                  }`}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
