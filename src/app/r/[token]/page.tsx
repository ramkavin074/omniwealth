import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { assets, households, reportLinks, users } from '@/db/schema';
import { fetchLiveExchangeRatesAction } from '@/actions/vault';
import { hashReportToken } from '@/lib/reportToken';
import { formatFull } from '@/lib/format';
import PrintButton from './PrintButton';

// Public, read-only net-worth summary opened from a link the household created
// in Settings. No login. It deliberately leaves out account numbers, tickers,
// beneficiaries, access notes and documents. Links expire and can be revoked;
// every failure looks the same so a link can't be probed.

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Net worth report',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer' as const,
};

const TYPE_NAMES: Record<string, string> = {
  MUTUAL_FUND: 'Mutual funds',
  REAL_ESTATE: 'Real estate',
  FIXED_INCOME: 'Fixed income',
  STOCK: 'Stocks',
  STOCKS: 'Stocks',
  ETF: 'ETFs',
  ETFS: 'ETFs',
  EQUITY: 'Equities',
  EQUITIES: 'Equities',
  CASH: 'Cash',
  CRYPTO: 'Crypto',
  PENSION: 'Pension',
  COMMODITY: 'Commodities',
  HSA: 'HSA',
  OTHER: 'Other',
};
const typeName = (t: string) => TYPE_NAMES[t] || t.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

function Unavailable() {
  return (
    <main className="mx-auto max-w-md px-6 py-20 text-center font-sans text-slate-700">
      <h1 className="text-lg font-bold text-slate-900">This link isn&rsquo;t available</h1>
      <p className="mt-2 text-sm">It may have expired or been turned off. Ask the person who shared it for a new one.</p>
    </main>
  );
}

export default async function ReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return <Unavailable />;

  let link;
  try {
    [link] = await db
      .select()
      .from(reportLinks)
      .where(
        and(
          eq(reportLinks.tokenHash, hashReportToken(token)),
          isNull(reportLinks.revokedAt),
          gt(reportLinks.expiresAt, new Date()),
        ),
      );
  } catch {
    return <Unavailable />;
  }
  if (!link) return <Unavailable />;

  // Best-effort view counter; never blocks the page.
  db.update(reportLinks)
    .set({ viewCount: sql`${reportLinks.viewCount} + 1`, lastViewedAt: new Date() })
    .where(eq(reportLinks.id, link.id))
    .catch(() => {});

  const [hh] = await db.select().from(households).where(eq(households.id, link.householdId));
  if (!hh) return <Unavailable />;
  const base = hh.baseCurrency || 'USD';

  const rows = await db
    .select({
      name: assets.name,
      type: assets.assetType,
      category: assets.accountCategory,
      value: assets.nativeValue,
      currency: assets.nativeCurrency,
      owner: users.fullName,
    })
    .from(assets)
    .leftJoin(users, eq(assets.userId, users.id))
    .where(eq(assets.householdId, link.householdId));

  const rates = await fetchLiveExchangeRatesAction();
  const toBase = (amount: number, cur: string) =>
    cur === base ? amount : (amount * (rates[base] || 1)) / (rates[cur] || 1);

  type Row = { name: string; type: string; owner: string; native: number; cur: string; baseVal: number; liability: boolean };
  const items: Row[] = rows.map((r) => {
    const t = (r.type || 'OTHER').toUpperCase();
    const liability = t === 'LIABILITY' || t === 'DEBT' || (r.category || '').toUpperCase() === 'LIABILITY';
    const native = Math.abs(parseFloat(r.value || '0'));
    const cur = r.currency || 'USD';
    return { name: r.name, type: liability ? 'LIABILITY' : t, owner: r.owner || '', native, cur, baseVal: Math.abs(toBase(native, cur)), liability };
  });

  const assetRows = items.filter((i) => !i.liability).sort((a, b) => b.baseVal - a.baseVal);
  const debtRows = items.filter((i) => i.liability).sort((a, b) => b.baseVal - a.baseVal);
  const totalAssets = assetRows.reduce((s, i) => s + i.baseVal, 0);
  const totalDebts = debtRows.reduce((s, i) => s + i.baseVal, 0);
  const netWorth = totalAssets - totalDebts;

  const byType = new Map<string, number>();
  for (const i of assetRows) byType.set(i.type, (byType.get(i.type) || 0) + i.baseVal);
  const allocation = [...byType.entries()].sort((a, b) => b[1] - a[1]);

  const fmt = (n: number) => `${formatFull(n, base)} ${base}`;
  const dateFmt = (d: Date) => d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

  return (
    <main className="mx-auto max-w-3xl bg-white px-5 py-8 font-sans text-slate-800 print:px-0">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">Net worth report</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{hh.name}</h1>
          <p className="mt-1 text-xs text-slate-500">
            Prepared {dateFmt(new Date())} &middot; amounts in {base} &middot; link expires {dateFmt(link.expiresAt)}
          </p>
        </div>
        <PrintButton />
      </header>

      <section className="mt-6 grid grid-cols-3 gap-3">
        {[
          ['Net worth', netWorth],
          ['Assets', totalAssets],
          ['Liabilities', totalDebts],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label as string}</p>
            <p className="mt-1 font-mono text-sm font-bold text-slate-900 sm:text-base">{fmt(value as number)}</p>
          </div>
        ))}
      </section>

      {allocation.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">Allocation</h2>
          <ul className="mt-3 space-y-2">
            {allocation.map(([type, val]) => {
              const pct = totalAssets > 0 ? (val / totalAssets) * 100 : 0;
              return (
                <li key={type} className="text-sm">
                  <div className="flex justify-between gap-3">
                    <span>{typeName(type)}</span>
                    <span className="font-mono text-slate-600">
                      {pct.toFixed(1)}% &middot; {fmt(val)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-teal-600" style={{ width: `${Math.max(pct, 1)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {[
        ['Holdings', assetRows],
        ['Liabilities', debtRows],
      ].map(([title, list]) =>
        (list as Row[]).length > 0 ? (
          <section key={title as string} className="mt-8">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">{title as string}</h2>
            <table className="mt-3 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-2 font-semibold">Name</th>
                  <th className="py-2 pr-2 font-semibold">Type</th>
                  <th className="hidden py-2 pr-2 font-semibold sm:table-cell">Owner</th>
                  <th className="py-2 text-right font-semibold">Value ({base})</th>
                </tr>
              </thead>
              <tbody>
                {(list as Row[]).map((r, i) => (
                  <tr key={i} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-2">
                      {r.name}
                      {r.cur !== base && (
                        <span className="block text-[11px] text-slate-400">
                          {formatFull(r.native, r.cur)} {r.cur}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-slate-600">{r.liability ? 'Liability' : typeName(r.type)}</td>
                    <td className="hidden py-2 pr-2 text-slate-600 sm:table-cell">{r.owner}</td>
                    <td className="py-2 text-right font-mono">{formatFull(r.baseVal, base)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null,
      )}

      <footer className="mt-10 border-t border-slate-200 pt-4 text-[11px] leading-relaxed text-slate-400">
        Read-only summary shared by the household. Account numbers, beneficiaries, notes and documents are not included.
        Values are as last entered, converted at current exchange rates. For information only; not financial, tax or legal advice.
        Generated with OmniWealth.
      </footer>
    </main>
  );
}
