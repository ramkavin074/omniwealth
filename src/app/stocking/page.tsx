import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUserAction } from '@/actions/auth';
import StockingAppClient from './StockingAppClient';
import '@/stocking/theme.css';

// In-OmniWealth host for the stocking module (desktop / admin / quick testing).
// The offline shop-counter experience ships as the standalone
// com.omniwealth.stocking APK. Both render the same <StockingApp/>.
export const dynamic = 'force-dynamic';

// Kadai is its own product: its own tab title, icon and installable-app name,
// instead of inheriting OmniWealth's from the site-wide layout. It sits behind
// a sign-in, so it is also kept out of search results.
export const metadata: Metadata = {
  title: { absolute: 'Kadai' },
  description: 'Kadai: stock, billing and GST for your shop.',
  manifest: '/kadai-manifest.json',
  icons: {
    icon: [
      { url: '/kadai-favicon.png', sizes: '48x48', type: 'image/png' },
      { url: '/kadai-icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: { url: '/kadai-icon-512.png', sizes: '512x512', type: 'image/png' },
  },
  appleWebApp: { capable: true, title: 'Kadai', statusBarStyle: 'black-translucent' },
  robots: { index: false, follow: false },
};

export default async function StockingPage() {
  const session = await getSessionUserAction();
  if (!session) redirect('/login');
  if (!session.stores || session.stores.length === 0) redirect('/');

  const store = session.stores[0];
  return (
    <StockingAppClient
      userId={session.user.id}
      displayName={session.user.fullName}
      hasMainApp={!session.household?.isStoreShell}
      store={{
        id: store.id,
        name: store.name,
        role: store.role as 'owner' | 'manager' | 'staff',
      }}
    />
  );
}
