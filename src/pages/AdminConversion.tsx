import AdminGuard from '@/components/admin/AdminGuard';
import AdminConversion from '@/components/admin/AdminConversion';
export default function AdminConversionPage() {
  return <AdminGuard><AdminConversion /></AdminGuard>;
}
