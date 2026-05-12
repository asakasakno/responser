import AdminGuard from '@/components/admin/AdminGuard';
import AdminGenerationFeedback from '@/components/admin/AdminGenerationFeedback';
export default function AdminGenerationFeedbackPage() {
  return <AdminGuard><AdminGenerationFeedback /></AdminGuard>;
}
