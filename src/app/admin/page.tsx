import { redirect } from 'next/navigation';
import { getSessionUserAction } from '@/actions/vault';
import AdminDashboardClient from './AdminDashboardClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getSessionUserAction();

  if (!session) {
    redirect('/login');
  }

  // "Super Admin Portal" — restricted to SUPER_ADMIN accounts only.
  if (session.user.role !== 'SUPER_ADMIN') {
    redirect('/');
  }

  return <AdminDashboardClient />;
}
