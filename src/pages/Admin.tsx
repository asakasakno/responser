import AdminGuard from '@/components/admin/AdminGuard';
import AdminDashboard from '@/components/admin/AdminDashboard';

export default function Admin() {
  return (
    <AdminGuard>
      <AdminDashboard />
    </AdminGuard>
  );
}
