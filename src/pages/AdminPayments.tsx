import AdminGuard from '@/components/admin/AdminGuard';
import AdminPayments from '@/components/admin/AdminPayments';
export default function AdminPaymentsPage() {
  return <AdminGuard><AdminPayments /></AdminGuard>;
}
