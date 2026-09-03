'use client';

import { useEffect, useMemo, useState } from 'react';
import { t, type Lang } from '../i18n';
import {
  buildAccountantExport,
  resolveRange,
  type AccountantExport,
  type RangeKind,
} from '../db/accountant';
import { buildAccountantCsv, buildTallyXml, downloadFile } from '../export';
import { getGstConfig } from '../settings';
import { SCREEN_PAD } from '../ui';

interface Props {
  lang: Lang;
  onClose: () => void;
}

const money = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
const money2 = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

const RANGES: RangeKind[] = [
  'this-month',
  'last-month',
  'this-quarter',
  'this-fy',
  'custom',
];

type Report = 'summary' | 'daybook' | 'items' | 'cashbook' | 'pnl';
const REPORTS: Report[] = ['summary', 'daybook', 'items', 'cashbook', 'pnl'];

interface DayRow {
  date: string;
  kind: string;
  ref: string;
  inAmt: number; // money in (sales, receipts)
  outAmt: number; // money out (purchases, expenses, payments)
}

export default function AccountantScreen({ lang, onClose }: Props) {
  const gstOn = getGstConfig().enabled;
  const [kind, setKind] = useState<RangeKind>('this-month');
  const [fromISO, setFromISO] = useState('');
  const [toISO, setToISO] = useState('');
  const [rep, setRep] = useState<Report>('summary');
  const [data, setData] = useState<AccountantExport | null>(null);

  const range = resolveRange(kind, fromISO || undefined, toISO || undefined);
  const loading =
    !data || data.range.from !== range.from || data.range.to !== range.to;

  useEffect(() => {
    let alive = true;
    const r = resolveRange(kind, fromISO || undefined, toISO || undefined);
    buildAccountantExport(r).then((d) => {
      if (alive) setData(d);
    });
    return () => {
      alive = false;
    };
  }, [kind, fromISO, toISO]);

  const slug = data
    ? data.range.label.replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '')
    : 'export';

  // ---- day book: every transaction, chronological ----
  const daybook = useMemo<DayRow[]>(() => {
    if (!data) return [];
    const rows: DayRow[] = [];
    for (const s of data.sales)
      rows.push({
        date: s.date,
        kind: s.isRefund ? t(lang, 'acct.db.refund') : t(lang, 'acct.db.sale'),
        ref: `${s.billNo} · ${s.party}`,
        inAmt: s.isRefund ? 0 : s.total,
        outAmt: s.isRefund ? -s.total : 0,
      });
    for (const p of data.purchases)
      rows.push({
        date: p.date,
        kind: t(lang, 'acct.db.purchase'),
        ref: `${p.invoiceNo} · ${p.party}`,
        inAmt: 0,
        outAmt: p.total,
      });
    for (const e of data.expenses)
      rows.push({
        date: e.date,
        kind: t(lang, 'acct.db.expense'),
        ref: `${t(lang, `exp.cat.${e.category}`)}${e.payee ? ` · ${e.payee}` : ''}`,
        inAmt: 0,
        outAmt: e.amount,
      });
    for (const r of data.receipts)
      rows.push({
        date: r.date,
        kind: t(lang, 'acct.db.receipt'),
        ref: `${r.customer} · ${r.tender}`,
        inAmt: r.amount,
        outAmt: 0,
      });
    for (const p of data.payments)
      rows.push({
        date: p.date,
        kind: t(lang, 'acct.db.payment'),
        ref: p.supplier,
        inAmt: 0,
        outAmt: p.amount,
      });
    return rows.sort((a, b) => a.date.localeCompare(b.date));
  }, [data, lang]);

  // ---- cash book: cash in / out with running balance ----
  const cashbook = useMemo(() => {
    if (!data) return { rows: [] as (DayRow & { bal: number })[], net: 0 };
    const rows: DayRow[] = [];
    for (const s of data.sales) {
      // cash portion only. a refund's cashAmount is negative on the row's total,
      // but the register stores only `total` + `tender`; approximate: cash tender
      // bills move their whole total, split/others contribute nothing here.
      if (s.tender === 'cash') {
        rows.push({
          date: s.date,
          kind: s.isRefund ? t(lang, 'acct.db.refund') : t(lang, 'acct.db.sale'),
          ref: s.billNo,
          inAmt: s.isRefund ? 0 : s.total,
          outAmt: s.isRefund ? -s.total : 0,
        });
      }
    }
    for (const r of data.receipts)
      if (r.tender === 'cash')
        rows.push({ date: r.date, kind: t(lang, 'acct.db.receipt'), ref: r.customer, inAmt: r.amount, outAmt: 0 });
    for (const e of data.expenses)
      if (e.tender === 'cash')
        rows.push({
          date: e.date,
          kind: t(lang, 'acct.db.expense'),
          ref: t(lang, `exp.cat.${e.category}`),
          inAmt: 0,
          outAmt: e.amount,
        });
    for (const p of data.payments)
      rows.push({ date: p.date, kind: t(lang, 'acct.db.payment'), ref: p.supplier, inAmt: 0, outAmt: p.amount });
    rows.sort((a, b) => a.date.localeCompare(b.date));
    let bal = 0;
    const withBal = rows.map((r) => {
      bal = Math.round((bal + r.inAmt - r.outAmt) * 100) / 100;
      return { ...r, bal };
    });
    return { rows: withBal, net: bal };
  }, [data, lang]);

  const header = (
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
        {t(lang, 'acct.title')}
      </h2>
      <button
        type="button"
        onClick={onClose}
        className="font-medium text-teal-700 dark:text-teal-300"
      >
        {t(lang, 'settings.close')}
      </button>
    </div>
  );

  return (
    <div className={`p-4 space-y-3 md:mx-auto md:max-w-2xl ${SCREEN_PAD}`}>
      {header}

      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setKind(r)}
            className={`h-8 rounded-lg px-2.5 text-xs font-semibold ${
              kind === r
                ? 'bg-teal-700 text-white'
                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
            }`}
          >
            {t(lang, `acct.range.${r}`)}
          </button>
        ))}
      </div>

      {kind === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fromISO}
            onChange={(e) => setFromISO(e.target.value)}
            className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50"
          />
          <span className="text-slate-400">→</span>
          <input
            type="date"
            value={toISO}
            onChange={(e) => setToISO(e.target.value)}
            className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50"
          />
        </div>
      )}

      <div className="grid grid-cols-5 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {REPORTS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setRep(k)}
            className={`h-8 rounded-lg text-xs font-semibold transition ${
              rep === k
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-50'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {t(lang, `acct.rep.${k}`)}
          </button>
        ))}
      </div>

      {loading || !data ? (
        <p className="text-slate-500 dark:text-slate-400">
          {t(lang, 'acct.building')}
        </p>
      ) : (
        <>
          {rep === 'summary' && (
            <div className="space-y-3">
              <div className="space-y-1 rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">
                <p className="mb-1 font-semibold text-slate-900 dark:text-slate-50">
                  {data.range.label}
                </p>
                <Row label={t(lang, 'acct.turnover')} v={money(data.summary.turnover)} />
                <Row label={t(lang, 'acct.purchases')} v={money(data.summary.purchaseTotal)} />
                <Row label={t(lang, 'acct.expenses')} v={money(data.summary.expenseTotal)} />
                {gstOn && (
                  <>
                    <Row label={t(lang, 'acct.gstOut')} v={money(data.summary.gstOutputTotal)} />
                    <Row label={t(lang, 'acct.gstIn')} v={'−' + money(data.summary.gstInputTotal)} />
                    <Row label={t(lang, 'acct.gstNet')} v={money(data.summary.netGstPayable)} bold />
                  </>
                )}
                <Row label={t(lang, 'acct.grossProfit')} v={money(data.summary.grossProfitApprox)} />
                <Row label={t(lang, 'acct.receivables')} v={money(data.summary.receivablesNow)} />
                <Row label={t(lang, 'acct.payables')} v={money(data.summary.payablesNow)} />
              </div>

              <p className="text-xs text-slate-400 dark:text-slate-500">
                {t(lang, 'acct.counts')
                  .replace('{s}', String(data.sales.length))
                  .replace('{p}', String(data.purchases.length))
                  .replace('{e}', String(data.expenses.length))}
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    downloadFile(`kadai-accounts-${slug}.csv`, buildAccountantCsv(data))
                  }
                  className="h-12 rounded-xl bg-teal-700 font-semibold text-white"
                >
                  {t(lang, 'acct.csv')}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadFile(
                      `kadai-tally-${slug}.xml`,
                      buildTallyXml(data),
                      'application/xml',
                    )
                  }
                  className="h-12 rounded-xl bg-slate-200 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100"
                >
                  {t(lang, 'acct.tally')}
                </button>
              </div>
              <p className="text-[11px] leading-snug text-slate-400 dark:text-slate-500">
                {t(lang, 'acct.disclaimer')}
              </p>
            </div>
          )}

          {rep === 'daybook' && (
            <Table
              cols={[t(lang, 'acct.col.date'), t(lang, 'acct.col.type'), t(lang, 'acct.col.ref'), t(lang, 'acct.col.in'), t(lang, 'acct.col.out')]}
              rows={daybook.map((r) => [
                r.date.slice(5),
                r.kind,
                r.ref,
                r.inAmt ? money(r.inAmt) : '',
                r.outAmt ? money(r.outAmt) : '',
              ])}
              foot={[
                '',
                '',
                'Σ',
                money(daybook.reduce((a, r) => a + r.inAmt, 0)),
                money(daybook.reduce((a, r) => a + r.outAmt, 0)),
              ]}
              empty={t(lang, 'acct.none')}
            />
          )}

          {rep === 'items' && (
            <Table
              cols={[t(lang, 'acct.col.item'), t(lang, 'acct.col.qty'), t(lang, 'acct.col.sale'), t(lang, 'acct.col.cost'), t(lang, 'acct.col.profit'), '%']}
              rows={data.itemProfit.map((r) => [
                r.name,
                String(r.qty),
                money(r.saleValue),
                money(r.costValue),
                money(r.profit),
                String(r.pct),
              ])}
              foot={[
                'Σ',
                '',
                money(data.itemProfit.reduce((a, r) => a + r.saleValue, 0)),
                money(data.itemProfit.reduce((a, r) => a + r.costValue, 0)),
                money(data.itemProfit.reduce((a, r) => a + r.profit, 0)),
                '',
              ]}
              empty={t(lang, 'acct.none')}
            />
          )}

          {rep === 'cashbook' && (
            <Table
              cols={[t(lang, 'acct.col.date'), t(lang, 'acct.col.type'), t(lang, 'acct.col.ref'), t(lang, 'acct.col.in'), t(lang, 'acct.col.out'), t(lang, 'acct.col.bal')]}
              rows={cashbook.rows.map((r) => [
                r.date.slice(5),
                r.kind,
                r.ref,
                r.inAmt ? money(r.inAmt) : '',
                r.outAmt ? money(r.outAmt) : '',
                money2(r.bal),
              ])}
              foot={['', '', t(lang, 'acct.cashNet'), '', '', money2(cashbook.net)]}
              empty={t(lang, 'acct.none')}
            />
          )}

          {rep === 'pnl' && (
            <div className="space-y-1 rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">
              <Row label={t(lang, 'acct.pnl.grossSales')} v={money(data.summary.pnl.grossSales)} />
              <Row label={t(lang, 'acct.pnl.returns')} v={'−' + money(data.summary.pnl.returns)} />
              <Row label={t(lang, 'acct.pnl.netSales')} v={money(data.summary.pnl.netSales)} bold />
              <Row label={t(lang, 'acct.pnl.cogs')} v={'−' + money(data.summary.pnl.cogs)} />
              <Row label={t(lang, 'acct.pnl.grossProfit')} v={money(data.summary.pnl.grossProfit)} bold />
              <Row label={t(lang, 'acct.pnl.expenses')} v={'−' + money(data.summary.pnl.expenseTotal)} />
              {data.summary.expenseByCategory.map((c) => (
                <Row
                  key={c.category}
                  label={`   ${t(lang, `exp.cat.${c.category}`)}`}
                  v={money(c.amount)}
                  dim
                />
              ))}
              <div className="my-1 border-t border-slate-300 dark:border-slate-600" />
              <Row label={t(lang, 'acct.pnl.netProfit')} v={money(data.summary.pnl.netProfit)} bold />
              <p className="pt-2 text-[11px] leading-snug text-slate-400 dark:text-slate-500">
                {t(lang, 'acct.pnl.note')}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Row({
  label,
  v,
  bold,
  dim,
}: {
  label: string;
  v: string;
  bold?: boolean;
  dim?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${
        bold
          ? 'font-semibold text-slate-900 dark:text-slate-50'
          : dim
            ? 'text-xs text-slate-400 dark:text-slate-500'
            : 'text-slate-600 dark:text-slate-300'
      }`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  );
}

function Table({
  cols,
  rows,
  foot,
  empty,
}: {
  cols: string[];
  rows: string[][];
  foot?: string[];
  empty: string;
}) {
  if (rows.length === 0)
    return (
      <p className="pt-4 text-center text-sm text-slate-500 dark:text-slate-400">
        {empty}
      </p>
    );
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full text-xs">
        <thead className="bg-slate-100 dark:bg-slate-800">
          <tr>
            {cols.map((c, i) => (
              <th
                key={i}
                className={`px-2 py-1.5 font-semibold text-slate-500 dark:text-slate-400 ${
                  i === 0 ? 'text-left' : 'text-right'
                }`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((cell, ci) => (
                <td
                  key={ci}
                  className={`px-2 py-1.5 tabular-nums text-slate-700 dark:text-slate-200 ${
                    ci === 0 ? 'text-left' : 'text-right'
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {foot && (
          <tfoot className="border-t-2 border-slate-300 bg-slate-100 font-semibold dark:border-slate-600 dark:bg-slate-800">
            <tr>
              {foot.map((c, i) => (
                <td
                  key={i}
                  className={`px-2 py-1.5 tabular-nums text-slate-800 dark:text-slate-100 ${
                    i === 0 ? 'text-left' : 'text-right'
                  }`}
                >
                  {c}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
