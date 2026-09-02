import { redirect } from 'next/navigation';
import { getSessionUserAction } from '@/actions/auth';
import StockingAppClient from './StockingAppClient';
import '@/stocking/theme.css';

// In-OmniWealth host for the stocking module (desktop / admin / quick testing).
// The offline shop-counter experience ships as the standalone
// com.omniwealth.stocking APK. Both render the same <StockingApp/>.
export const dynamic = 'force-dynamic';

export default async function StockingPage() {
  const session = await getSessionUserAction();
  if (!session) redirect('/login');
  if (!session.stores || session.stores.length === 0) redirect('/');

  const store = session.stores[0];
  return (
    <StockingAppClient
      userId={session.user.id}
      displayName={session.user.fullName}
      store={{
        id: store.id,
        name: store.name,
        role: store.role as 'owner' | 'manager' | 'staff',
      }}
    />
  );
}
