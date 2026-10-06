import type { Metadata } from 'next';
import ResetCard from './ResetCard';
import '@/stocking/theme.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: 'Kadai: reset password' },
  icons: { icon: [{ url: '/kadai-favicon.png', sizes: '48x48', type: 'image/png' }] },
  robots: { index: false, follow: false },
};

export default async function KadaiResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <ResetCard token={typeof token === 'string' ? token : ''} />;
}
