'use client';

import { useState } from 'react';
import { t, type Lang } from '../i18n';
import { getGstConfig, getTaxConfig } from '../settings';
import {
  fyStartYearOf,
  taxReport,
  toggleTaxNote,
  type TaxReport,
} from '../db/tax';
import { useLiveQuery } from '../hooks';
import { SCREEN_PAD } from '../ui';

interface Props {
  lang: Lang;
  onClose: () => void;
}

const money = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
const money2 = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

const heading =
  'text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500';

export default function TaxScreen({ lang, onClose }: Props) {
  const thisFy = fyStartYearOf();
  const [fy, setFy] = useState(thisFy);
  const [gst] = useState(getGstConfig);
  const [tax] = useState(getTaxConfig);

  const rep = useLiveQuery<TaxReport | undefined>(
    () =>
      taxReport(fy, {
        gstEnabled: gst.enabled,
        gstScheme: tax.gstScheme,
        presumptive: tax.presumptive,
      }),
    [fy, gst.enabled, tax.gstScheme, tax.presumptive],
  );

  const Check = ({ ck, done }: { ck: string; done: boolean }) => (
    <button
      type="button"
      onClick={() => toggleTaxNote(ck)}
      className={`h-6 w-6 shrink-0 rounded border text-sm ${
        done
          ? 'border-teal-600 bg-teal-600 text-white'
          : 'border-slate-300 dark:border-slate-600'
      }`}
      aria-label="mark done"
    >
      {done ? '✓' : ''}
    </button>
  );

  return (
    <div className={`p-4 space-y-4 ${SCREEN_PAD}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
          {t(lang, 'tax.title')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="font-medium text-teal-700 dark:text-teal-300"
        >
          {t(lang, 'settings.close')}
        </button>
      </div>

      <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {[thisFy, thisFy - 1].map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => setFy(y)}
            className={`h-9 flex-1 rounded-lg text-sm font-semibold transition ${
              fy === y
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-50'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            FY {y}-{String(y + 1).slice(2)}
          </button>
        ))}
      </div>

      {!rep ? (
        <p className="pt-6 text-center text-slate-400">…</p>
      ) : (
        <>
          {/* turnover */}
          <section className="space-y-1">
            <p className={heading}>{t(lang, 'tax.turnover')}</p>
            <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
                {money(rep.turnover)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {rep.billCount} {t(lang, 'sales.bills').toLowerCase()} ·{' '}
                {t(lang, 'sell.tender.cash')} {money(rep.cash)} ·{' '}
                {t(lang, 'sell.tender.upi')} {money(rep.digital)}
                {rep.refundTotal > 0 &&
                  ` · ${t(lang, 'sales.refunds')} ${money(rep.refundTotal)}`}
              </p>
            </div>
          </section>

          {/* GST */}
          {rep.gstEnabled && rep.gstScheme === 'regular' && (
            <section className="space-y-2">
              <p className={heading}>
                {t(lang, 'tax.gst')} · {money(rep.gstCollected)}
              </p>
              {rep.gstByRate.length > 0 && (
                <div className="space-y-0.5 rounded-xl bg-slate-100 p-3 text-xs dark:bg-slate-800">
                  {rep.gstByRate.map((r) => (
                    <div key={r.rate} className="flex justify-between">
                      <span>
                        {r.rate}% · {t(lang, 'tax.taxable')} {money(r.taxable)}
                      </span>
                      <span className="tabular-nums">
                        CGST {money2(r.cgst)} · SGST {money2(r.sgst)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-0.5 rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>{t(lang, 'tax.gstOut')}</span>
                  <span className="tabular-nums">{money(rep.gstCollected)}</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>{t(lang, 'tax.gstIn')}</span>
                  <span className="tabular-nums">
                    −{money(rep.gstInputCredit)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold text-slate-900 dark:text-slate-50">
                  <span>{t(lang, 'tax.gstNet')}</span>
                  <span className="tabular-nums">{money(rep.netGstPayable)}</span>
                </div>
              </div>
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {rep.gstMonths.map((m) => (
                  <li key={m.key} className="flex items-center gap-3 py-2 text-sm">
                    <Check ck={m.key} done={m.done} />
                    <span className="flex-1">
                      <span className="block text-slate-800 dark:text-slate-100">
                        {m.month}
                      </span>
                      <span className="text-xs text-slate-400">
                        {t(lang, 'tax.payBy')} {m.dueDate}
                      </span>
                    </span>
                    <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-100">
                      {money(m.collected)}
                    </span>
                  </li>
                ))}
              </ul>
              {rep.gstMonths.length === 0 && (
                <p className="text-xs text-slate-400">{t(lang, 'tax.noGst')}</p>
              )}
            </section>
          )}

          {rep.gstEnabled && rep.gstScheme === 'composition' && (
            <section className="space-y-2">
              <p className={heading}>{t(lang, 'tax.composition')}</p>
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {rep.compositionQuarters.map((q) => (
                  <li key={q.key} className="flex items-center gap-3 py-2 text-sm">
                    <Check ck={q.key} done={q.done} />
                    <span className="flex-1">
                      <span className="block text-slate-800 dark:text-slate-100">
                        {q.label} · {money(q.turnover)}
                      </span>
                      <span className="text-xs text-slate-400">
                        CMP-08 {t(lang, 'tax.payBy')} {q.dueDate}
                      </span>
                    </span>
                    <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-100">
                      {money(q.tax)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* income tax */}
          {rep.presumptive && (
            <section className="space-y-2">
              <p className={heading}>{t(lang, 'tax.income')}</p>
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">
                    {t(lang, 'tax.profit')}
                  </span>
                  <span className="tabular-nums font-semibold text-slate-900 dark:text-slate-50">
                    {money(rep.presumptiveProfit)}
                  </span>
                </div>
                <div className="mt-1 flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">
                    {t(lang, 'tax.estTax')}
                  </span>
                  <span className="tabular-nums font-semibold text-slate-900 dark:text-slate-50">
                    {money(rep.estimatedIncomeTax)}
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-snug text-slate-400 dark:text-slate-500">
                  {t(lang, 'tax.incomeNote')}
                </p>
              </div>

              {rep.advance.length > 0 && (
                <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                  {rep.advance.map((a) => (
                    <li
                      key={a.key}
                      className="flex items-center gap-3 py-2 text-sm"
                    >
                      <Check ck={a.key} done={a.status === 'paid'} />
                      <span className="flex-1">
                        <span className="block text-slate-800 dark:text-slate-100">
                          {t(lang, 'tax.advance')} {a.cumPercent}% ·{' '}
                          {t(lang, 'tax.payBy')} {a.label}
                        </span>
                        <span
                          className={`text-xs ${
                            a.status === 'overdue'
                              ? 'text-rose-600 dark:text-rose-400'
                              : a.status === 'due-soon'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-400'
                          }`}
                        >
                          {t(lang, `tax.status.${a.status}`)}
                        </span>
                      </span>
                      <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-100">
                        {money(a.cumAmount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <button
            type="button"
            onClick={() =>
              window.open(
                `https://wa.me/?text=${encodeURIComponent(summaryText(lang, rep))}`,
                '_blank',
              )
            }
            className="h-11 w-full rounded-xl bg-emerald-600 font-semibold text-white"
          >
            {t(lang, 'tax.share')}
          </button>
          <p className="text-[11px] leading-snug text-slate-400 dark:text-slate-500">
            {t(lang, 'tax.disclaimer')}
          </p>
        </>
      )}
    </div>
  );
}

function summaryText(lang: Lang, r: TaxReport): string {
  const L: string[] = [
    `${t(lang, 'tax.title')} — FY ${r.fyLabel}`,
    `${t(lang, 'tax.turnover')}: ${money2(r.turnover)} (cash ${money2(r.cash)}, digital ${money2(r.digital)})`,
  ];
  if (r.gstEnabled && r.gstScheme === 'regular') {
    L.push(`GST collected (output): ${money2(r.gstCollected)}`);
    for (const g of r.gstByRate)
      L.push(`  ${g.rate}%  taxable ${money2(g.taxable)}  CGST ${money2(g.cgst)}  SGST ${money2(g.sgst)}`);
    L.push(`GST input credit (ITC): ${money2(r.gstInputCredit)}`);
    L.push(`Net GST payable: ${money2(r.netGstPayable)}`);
  }
  if (r.gstEnabled && r.gstScheme === 'composition') {
    for (const q of r.compositionQuarters)
      L.push(`${q.label}: turnover ${money2(q.turnover)}, 1% = ${money2(q.tax)}`);
  }
  if (r.presumptive) {
    L.push(`Presumptive profit (44AD): ${money2(r.presumptiveProfit)}`);
    L.push(`Estimated income tax: ${money2(r.estimatedIncomeTax)}`);
  }
  return L.join('\n');
}
