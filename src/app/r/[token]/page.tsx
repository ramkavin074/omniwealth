import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { assets, households, reportLinks, users } from '@/db/schema';
import { fetchLiveExchangeRatesAction } from '@/actions/vault';
import { hashReportToken } from '@/lib/reportToken';
import { formatFull } from '@/lib/format';
import { computeGoals } from '@/lib/goals';
import PrintButton from './PrintButton';

// Public, read-only net-worth summary opened from a link the household created
// in Settings. No login. It deliberately leaves out account numbers,
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
      ticker: assets.ticker,
      quantity: assets.quantity,
      rationale: assets.rationale,
      owner: users.fullName,
    })
    .from(assets)
    .leftJoin(users, eq(assets.userId, users.id))
    .where(eq(assets.householdId, link.householdId));

  const rates = await fetchLiveExchangeRatesAction();
  const toBase = (amount: number, cur: string) =>
    cur === base ? amount : (amount * (rates[base] || 1)) / (rates[cur] || 1);

  type Row = { name: string; type: string; owner: string; native: number; cur: string; baseVal: number; liability: boolean; ticker: string; qty: number | null };
  const items: Row[] = rows.map((r) => {
    const t = (r.type || 'OTHER').toUpperCase();
    const liability = t === 'LIABILITY' || t === 'DEBT' || (r.category || '').toUpperCase() === 'LIABILITY';
    const native = Math.abs(parseFloat(r.value || '0'));
    const cur = r.currency || 'USD';
    const qty = r.quantity != null && Number.isFinite(parseFloat(r.quantity)) ? parseFloat(r.quantity) : null;
    return {
      name: r.name,
      type: liability ? 'LIABILITY' : t,
      owner: r.owner || '',
      native,
      cur,
      baseVal: Math.abs(toBase(native, cur)),
      liability,
      ticker: liability ? '' : r.ticker || '',
      // Quantity only means something for priced securities; "1" on cash/property is noise.
      qty: !liability && r.ticker && qty !== null ? qty : null,
    };
  });

  const assetRows = items.filter((i) => !i.liability).sort((a, b) => b.baseVal - a.baseVal);
  const debtRows = items.filter((i) => i.liability).sort((a, b) => b.baseVal - a.baseVal);
  const totalAssets = assetRows.reduce((s, i) => s + i.baseVal, 0);
  const totalDebts = debtRows.reduce((s, i) => s + i.baseVal, 0);
  const netWorth = totalAssets - totalDebts;

  const byType = new Map<string, number>();
  for (const i of assetRows) byType.set(i.type, (byType.get(i.type) || 0) + i.baseVal);
  const allocation = [...byType.entries()].sort((a, b) => b[1] - a[1]);

  // One compact table: holdings grouped by type (largest group first) with a
  // subtotal per group, then liabilities last.
  const groups: { key: string; title: string; total: number; list: Row[] }[] = allocation.map(([type, total]) => ({
    key: type,
    title: typeName(type),
    total,
    list: assetRows.filter((r) => r.type === type),
  }));
  if (debtRows.length > 0) groups.push({ key: 'LIABILITY', title: 'Liabilities', total: totalDebts, list: debtRows });

  const goals = computeGoals(
    hh.legacyPillars,
    rows.map((r) => ({
      assetType: r.type,
      accountCategory: r.category,
      rationale: r.rationale,
      nativeValue: r.value,
      nativeCurrency: r.currency,
    })),
    base,
    rates,
  );

  const fmt = (n: number) => `${formatFull(n, base)} ${base}`;
  const dateFmt = (d: Date) => d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const monthFmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });


  return (
    <main className="mx-auto max-w-4xl bg-white px-5 py-8 font-sans text-slate-800 print:max-w-none print:px-0 print:py-0">
      <style>{`@page { margin: 12mm; } @media print { tr, li { break-inside: avoid; } }`}</style>
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">Net worth report</p>
          <h1 className="mt-0.5 text-xl font-bold text-slate-900">{hh.name}</h1>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Prepared {dateFmt(new Date())} &middot; amounts in {base} &middot; link expires {dateFmt(link.expiresAt)}
          </p>
        </div>
        <PrintButton />
      </header>

      <section className="mt-4 grid grid-cols-3 gap-2">
        {[
          ['Net worth', netWorth],
          ['Assets', totalAssets],
          ['Liabilities', totalDebts],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label as string}</p>
            <p className="mt-0.5 font-mono text-sm font-bold text-slate-900">{fmt(value as number)}</p>
          </div>
        ))}
      </section>

      <div className={`mt-5 grid gap-5 ${goals.length > 0 ? 'md:grid-cols-2 print:grid-cols-2' : ''}`}>
        {allocation.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900">Allocation</h2>
            <table className="mt-2 w-full text-xs">
              <tbody>
                {allocation.map(([type, val]) => {
                  const pct = totalAssets > 0 ? (val / totalAssets) * 100 : 0;
                  return (
                    <tr key={type} className="border-b border-slate-100">
                      <td className="py-1 pr-2">{typeName(type)}</td>
                      <td className="w-24 py-1 pr-2">
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-teal-600" style={{ width: `${Math.max(pct, 1)}%` }} />
                        </div>
                      </td>
                      <td className="py-1 text-right font-mono text-slate-600">{pct.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {goals.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900">Goals</h2>
            <table className="mt-2 w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="py-1 pr-2 text-left font-semibold">Goal</th>
                  <th className="py-1 pr-2 text-right font-semibold">Now / target</th>
                  <th className="py-1 text-right font-semibold">Progress</th>
                </tr>
              </thead>
              <tbody>
                {goals.map((g) => (
                  <tr key={g.name} className="border-b border-slate-100 align-top">
                    <td className="py-1 pr-2">
                      {g.name}
                      {g.targetDate && (
                        <span className="block text-[10px] text-slate-400">
                          by {monthFmt(g.targetDate)}
                          {g.status === 'overdue' ? ' (past)' : ''}
                        </span>
                      )}
                    </td>
                    <td className="py-1 pr-2 text-right font-mono text-slate-600">
                      {formatFull(g.current, base)} / {formatFull(g.target, base)}
                    </td>
                    <td className={`py-1 text-right font-mono ${g.status === 'reached' ? 'text-emerald-700' : 'text-slate-700'}`}>
                      {g.status === 'reached' ? 'Reached' : `${Math.floor(g.pct)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>

      <section className="mt-5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900">Holdings</h2>
        <table className="mt-2 w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-300 text-[10px] uppercase tracking-wide text-slate-500">
              <th className="py-1 pr-2 font-semibold">Name</th>
              <th className="hidden py-1 pr-2 font-semibold sm:table-cell print:table-cell">Owner</th>
              <th className="hidden py-1 pr-2 text-right font-semibold sm:table-cell print:table-cell">Qty</th>
              <th className="hidden py-1 pr-2 text-right font-semibold sm:table-cell print:table-cell">Original</th>
              <th className="py-1 pr-2 text-right font-semibold">Value ({base})</th>
              <th className="py-1 text-right font-semibold">%</th>
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.key}>
              <tr className="bg-slate-50">
                <td className="py-1 pl-1 pr-2 text-[11px] font-bold text-slate-800">
                  {g.title} <span className="font-normal text-slate-400">({g.list.length})</span>
                </td>
                <td className="hidden sm:table-cell print:table-cell" colSpan={3} />
                <td className="py-1 pr-2 text-right font-mono text-[11px] font-bold text-slate-800">{formatFull(g.total, base)}</td>
                <td className="py-1 text-right font-mono text-[11px] text-slate-500">
                  {g.key === 'LIABILITY' || totalAssets <= 0 ? '' : ((g.total / totalAssets) * 100).toFixed(1)}
                </td>
              </tr>
              {g.list.map((r, i) => (
                <tr key={i} className="border-b border-slate-100 align-top">
                  <td className="py-1 pl-1 pr-2">
                    {r.name}
                    {r.ticker && <span className="ml-1 font-mono text-[10px] text-slate-400">{r.ticker}</span>}
                  </td>
                  <td className="hidden py-1 pr-2 text-slate-600 sm:table-cell print:table-cell">{r.owner}</td>
                  <td className="hidden py-1 pr-2 text-right font-mono text-slate-600 sm:table-cell print:table-cell">
                    {r.qty !== null ? r.qty.toLocaleString('en-US', { maximumFractionDigits: 4 }) : ''}
                  </td>
                  <td className="hidden py-1 pr-2 text-right font-mono text-slate-400 sm:table-cell print:table-cell">
                    {r.cur !== base ? `${formatFull(r.native, r.cur)} ${r.cur}` : ''}
                  </td>
                  <td className="py-1 pr-2 text-right font-mono">{formatFull(r.baseVal, base)}</td>
                  <td className="py-1 text-right font-mono text-slate-500">
                    {r.liability || totalAssets <= 0 ? '' : ((r.baseVal / totalAssets) * 100).toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </section>

      <footer className="mt-6 border-t border-slate-200 pt-3 text-[10px] leading-relaxed text-slate-400">
        Read-only summary shared by the household. Account numbers, beneficiaries, notes and documents are not included.
        Values are as last entered, converted at current exchange rates. For information only; not financial, tax or legal advice.
        Generated with OmniWealth.
      </footer>
    </main>
  );
}
