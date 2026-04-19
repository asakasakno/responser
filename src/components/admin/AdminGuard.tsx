import { useEffect, useState, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle } from 'lucide-react';
import AdminLayout from './AdminLayout';

export default function AdminGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    (supabase.rpc as any)('current_user_has_role', { _role: 'admin' })
      .then(({ data }: { data: boolean | null }) => setIsAdmin(!!data));
  }, [user]);

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">로딩 중...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (isAdmin === null) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">권한 확인 중...</div>;
  if (!isAdmin) return (
    <AdminLayout>
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertTriangle className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold">접근 권한이 없습니다</h1>
        <p className="text-muted-foreground">관리자만 접근할 수 있는 페이지입니다.</p>
      </div>
    </AdminLayout>
  );

  return <AdminLayout>{children}</AdminLayout>;
}
