import { db } from '@/db';
import { assets, users } from '@/db/schema';
import { getSessionUserAction, getExchangeRate, setupDemoHouseholdAction } from '@/actions/vault';
import { eq } from 'drizzle-orm';
import DashboardClient from '@/components/DashboardClient';

export default async function DashboardPage() {
  const session = await getSessionUserAction();

  if (!session) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 w-full max-w-md shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto text-xl">
              🌐
            </div>
            <h1 className="text-xl font-extrabold text-white">Global Family Vault</h1>
            <p className="text-xs text-slate-400">Initialize your multi-currency family wealth command center.</p>
          </div>

          <form action={setupDemoHouseholdAction} className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Your Full Name</label>
              <input name="fullName" defaultValue="Primary Owner" required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500" />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Household Name</label>
              <input name="householdName" defaultValue="Family Legacy" required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500" />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Email Address</label>
              <input name="email" type="email" defaultValue="owner@family.com" required className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500" />
            </div>

            <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer shadow-lg">
              Enter Family Vault
            </button>
          </form>
        </div>
      </main>
    );
  }

  const householdId = session.household.id;
  const baseCurrency = session.household.baseCurrency;

  const rawAssets = await db
    .select({
      id: assets.id,
      name: assets.name,
      ticker: assets.ticker,
      assetType: assets.assetType,
      accountCategory: assets.accountCategory,
      accountNumber: assets.accountNumber,
      rationale: assets.rationale,
      nativeValue: assets.nativeValue,
      nativeCurrency: assets.nativeCurrency,
      user: { fullName: users.fullName },
    })
    .from(assets)
    .leftJoin(users, eq(assets.userId, users.id))
    .where(eq(assets.householdId, householdId));

  const convertedAssets = await Promise.all(
    rawAssets.map(async (asset) => {
      const fxRate = await getExchangeRate(asset.nativeCurrency, baseCurrency);
      return { ...asset, nativeValue: parseFloat(asset.nativeValue) * fxRate };
    })
  );

  return (
    <DashboardClient 
      session={session} 
      initialAssets={convertedAssets} 
      baseCurrency={baseCurrency} 
    />
  );
}