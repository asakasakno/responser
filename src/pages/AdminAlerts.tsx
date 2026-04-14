import AdminGuard from '@/components/admin/AdminGuard';
import AdminAlerts from '@/components/admin/AdminAlerts';
export default function AdminAlertsPage() {
  return <AdminGuard><AdminAlerts /></AdminGuard>;
}
