import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { assets, households, users } from '@/db/schema';
import { fetchHouseholdDocumentsAction, fetchLiveExchangeRatesAction, getSessionUserAction } from '@/actions/vault';
import { listContactsAction, listRemindersAction } from '@/actions/familyPlan';
import { formatFull } from '@/lib/format';
import { formatBeneficiaries } from '@/lib/beneficiaries';
import { buildPlanAccounts } from '@/lib/familyPlanView';
import { dueLabel } from '@/lib/familyPlan';
import PrintButton from './PrintButton';

// Family Action Plan: one printable "in case of emergency" packet — who to
// call, where every account is, who gets what, and where the paperwork lives.
// Signed-in household members only. Uses divs (not buttons/nav) so the global
// print stylesheet keeps everything.

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Family action plan', robots: { index: false, follow: false } };

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-6 break-inside-avoid-page">
    <div className="border-b border-slate-300 pb-1 text-xs font-bold uppercase tracking-wide text-slate-900">{title}</div>
    <div className="mt-2 text-sm">{children}</div>
  </section>
);

export default async function FamilyPlanPage() {
  const session = await getSessionUserAction();
  if (!session) redirect('/login');
  if (session.household?.isStoreShell) redirect('/stocking');

  const householdId = session.household.id;
  const [household] = await db.select().from(households).where(eq(households.id, householdId)).limit(1);
  const baseCurrency = household?.baseCurrency || 'USD';

  const [members, rawAssets, documents, contacts, reminders, rates] = await Promise.all([
    db.select({ fullName: users.fullName, email: users.email, role: users.role }).from(users).where(eq(users.householdId, householdId)),
    db
      .select({
        name: assets.name,
        assetType: assets.assetType,
        accountCategory: assets.accountCategory,
        accountNumber: assets.accountNumber,
        nativeValue: assets.nativeValue,
        nativeCurrency: assets.nativeCurrency,
        beneficiary: assets.beneficiary,
        accessNotes: assets.accessNotes,
        user: { fullName: users.fullName },
      })
      .from(assets)
      .leftJoin(users, eq(assets.userId, users.id))
      .where(eq(assets.householdId, householdId)),
    fetchHouseholdDocumentsAction(),
    listContactsAction(),
    listRemindersAction(),
    fetchLiveExchangeRatesAction(),
  ]);

  const { accounts, debts } = buildPlanAccounts(rawAssets, baseCurrency, rates, household?.accountInstructions);
  const upcoming = reminders.filter((r) => !r.doneAt).slice(0, 12);
  const money = (n: number) => formatFull(n, baseCurrency);

  return (
    <main className="mx-auto max-w-3xl bg-white px-5 py-8 font-sans text-slate-800 print:max-w-none print:px-1 print:py-0">
      <style>{`@page { margin: 14mm; } @media print { li, tr { break-inside: avoid; } }`}</style>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-teal-700">In case of emergency</div>
          <h1 className="text-2xl font-bold text-slate-900">Family action plan</h1>
          <p className="mt-1 text-xs text-slate-500">
            {household?.name} · prepared {new Date().toLocaleDateString()} · values in {baseCurrency}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 print:hidden">
          <PrintButton />
          <Link href="/" className="text-xs text-slate-500 underline">
            Back to dashboard
          </Link>
        </div>
      </div>

      <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        This page lists where the family&rsquo;s money is and who to contact. It contains no passwords. Keep a printed
        copy somewhere safe and tell the people below where it is. Check it at least once a year.
      </p>

      <Section title="1. Who to call first">
        {contacts.length === 0 ? (
          <p className="text-slate-500">No contacts added yet. Add them under Directives → People to call.</p>
        ) : (
          <ul className="space-y-2">
            {contacts.map((c) => (
              <li key={c.id}>
                <span className="font-semibold">{c.name}</span> <span className="text-slate-500">· {c.role}</span>
                <div className="text-xs text-slate-600">
                  {[c.phone, c.email].filter(Boolean).join(' · ')}
                  {c.note ? ` — ${c.note}` : ''}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="2. People in this household">
        <ul className="space-y-1">
          {members.map((m) => (
            <li key={m.email}>
              <span className="font-semibold">{m.fullName}</span>{' '}
              <span className="text-slate-500">· {m.role.toLowerCase()} · {m.email}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="3. Where everything is, and who gets what">
        {accounts.length === 0 ? (
          <p className="text-slate-500">No accounts added yet.</p>
        ) : (
          <ul className="space-y-3">
            {accounts.map((a) => (
              <li key={a.key} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold text-slate-900">{a.label}</span>
                  <span className="font-mono text-xs text-slate-600">{money(a.value)}</span>
                </div>
                <div className="text-xs text-slate-500">
                  {a.owners.length ? `Owner: ${a.owners.join(', ')} · ` : ''}
                  {a.holdings.slice(0, 4).join(', ')}
                  {a.holdings.length > 4 ? ` +${a.holdings.length - 4} more` : ''}
                </div>
                <div className="mt-1 text-xs">
                  <span className="font-semibold">Beneficiaries: </span>
                  {a.beneficiaries.length ? (
                    <>
                      {formatBeneficiaries(JSON.stringify(a.beneficiaries))}
                      {a.status === 'shares' && <span className="text-amber-700"> (shares do not total 100%)</span>}
                    </>
                  ) : (
                    <span className="text-rose-700">not recorded</span>
                  )}
                </div>
                {a.accessNotes.length > 0 && (
                  <div className="text-xs">
                    <span className="font-semibold">How to access: </span>
                    {a.accessNotes.join(' · ')}
                  </div>
                )}
                {a.instructions && (
                  <div className="text-xs">
                    <span className="font-semibold">Instructions: </span>
                    {a.instructions}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {debts.length > 0 && (
        <Section title="4. Loans and debts">
          <ul className="space-y-1">
            {debts.map((d, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>{d.name}</span>
                <span className="font-mono text-xs text-slate-600">{money(d.value)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={`${debts.length > 0 ? '5' : '4'}. Documents in the vault`}>
        {documents.length === 0 ? (
          <p className="text-slate-500">No documents uploaded yet (will, insurance policies, property papers).</p>
        ) : (
          <ul className="grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2 print:grid-cols-2">
            {documents.map((d) => (
              <li key={d.id} className="truncate">
                {d.name}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-slate-500">Sign in to OmniWealth and open Directives → Documents to view them.</p>
      </Section>

      {upcoming.length > 0 && (
        <Section title={`${debts.length > 0 ? '6' : '5'}. Renewals and deadlines`}>
          <ul className="space-y-1">
            {upcoming.map((r) => (
              <li key={r.id} className="flex justify-between gap-3">
                <span>
                  {r.title}
                  {r.note ? <span className="text-slate-500"> — {r.note}</span> : null}
                </span>
                <span className="shrink-0 text-xs text-slate-600">
                  {r.dueDate} · {dueLabel(r.dueDate)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <p className="mt-8 text-[10px] text-slate-400">
        Generated by OmniWealth for the household&rsquo;s own use. Informational only; not legal or financial advice.
        Beneficiary details here do not replace the designations held by each institution or your will.
      </p>
    </main>
  );
}
