import type { Metadata } from 'next';
import LandingPage from '@/components/LandingPage';

// The OmniWealth product page. It used to be the home page; the home page is now the landing page for all the apps (see src/app/page.tsx).
export const metadata: Metadata = { alternates: { canonical: '/wealth' } };

export default function WealthLandingPage() {
  return <LandingPage />;
}
