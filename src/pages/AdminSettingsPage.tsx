import AdminGuard from '@/components/admin/AdminGuard';
import AdminSettings from '@/components/admin/AdminSettings';
export default function AdminSettingsPage() {
  return <AdminGuard><AdminSettings /></AdminGuard>;
}
