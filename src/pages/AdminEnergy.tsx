import AdminGuard from '@/components/admin/AdminGuard';
import AdminEnergy from '@/components/admin/AdminEnergy';
export default function AdminEnergyPage() {
  return <AdminGuard><AdminEnergy /></AdminGuard>;
}
