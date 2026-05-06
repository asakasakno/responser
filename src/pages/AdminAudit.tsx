import AdminGuard from '@/components/admin/AdminGuard';
import AdminAuditLog from '@/components/admin/AdminAuditLog';
export default function AdminAuditPage() {
  return <AdminGuard><AdminAuditLog /></AdminGuard>;
}
