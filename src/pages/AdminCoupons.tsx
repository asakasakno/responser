import AdminGuard from '@/components/admin/AdminGuard';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminCoupons from '@/components/admin/AdminCoupons';

export default function AdminCouponsPage() {
  return (
    <AdminGuard>
      <AdminLayout>
        <AdminCoupons />
      </AdminLayout>
    </AdminGuard>
  );
}
