import AdminGuard from '@/components/admin/AdminGuard';
import AdminBetaApplications from '@/components/admin/AdminBetaApplications';
export default function AdminBetaApplicationsPage() {
  return <AdminGuard><AdminBetaApplications /></AdminGuard>;
}
