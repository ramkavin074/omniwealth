import { redirect } from 'next/navigation';
import { getSessionUserAction } from '@/actions/auth';
import StockingAppClient from './StockingAppClient';

// In-OmniWealth host for the stocking module (desktop / admin / quick testing).
// The offline shop-counter experience ships as the standalone
// com.omniwealth.stocking APK. Both render the same <StockingApp/>.
export const dynamic = 'force-dynamic';

export default async function StockingPage() {
  const session = await getSessionUserAction();
  if (!session) redirect('/login');
  if (!session.household?.stockingEnabled) redirect('/');

  return <StockingAppClient />;
}
