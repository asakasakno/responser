import AdminGuard from '@/components/admin/AdminGuard';
import AdminAnomalies from '@/components/admin/AdminAnomalies';
export default function AdminAnomaliesPage() {
  return <AdminGuard><AdminAnomalies /></AdminGuard>;
}
