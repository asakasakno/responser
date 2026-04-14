import AdminGuard from '@/components/admin/AdminGuard';
import AdminUsers from '@/components/admin/AdminUsers';
export default function AdminUsersPage() {
  return <AdminGuard><AdminUsers /></AdminGuard>;
}
