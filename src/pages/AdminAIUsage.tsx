import AdminGuard from '@/components/admin/AdminGuard';
import AdminAIUsage from '@/components/admin/AdminAIUsage';
export default function AdminAIUsagePage() {
  return <AdminGuard><AdminAIUsage /></AdminGuard>;
}
