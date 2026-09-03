'use client';

import { useRef, useState } from 'react';
import { t, type Lang } from '../i18n';
import { importProducts } from '../db/products';
import { importCustomers } from '../db/customers';
import { importOrders } from '../db/orders';
import { importExpenses } from '../db/expenses';
import {
  CSV_TEMPLATE,
  CUSTOMERS_CSV_TEMPLATE,
  EXPENSES_CSV_TEMPLATE,
  ORDERS_CSV_TEMPLATE,
  parseCsv,
  parseCustomersCsv,
  parseExpensesCsv,
  parseOrdersCsv,
} from '../import';

interface Props {
  lang: Lang;
  onClose: () => void;
}

type Kind = 'products' | 'customers' | 'orders' | 'expenses';

type State =
  | { kind: 'idle' }
  | { kind: 'preview'; rows: number; unknown: string[]; text: string }
  | { kind: 'error'; message: string }
  | { kind: 'importing' }
  | { kind: 'done'; added: number; updated: number | null; skipped: number };

const KINDS: Kind[] = ['products', 'customers', 'orders', 'expenses'];

const TEMPLATES: Record<Kind, string> = {
  products: CSV_TEMPLATE,
  customers: CUSTOMERS_CSV_TEMPLATE,
  orders: ORDERS_CSV_TEMPLATE,
  expenses: EXPENSES_CSV_TEMPLATE,
};

/** Parse `text` for `kind` → row count + unknown columns, or an error key. */
function parseFor(
  kind: Kind,
  text: string,
): { rows: number; unknown: string[] } | { errorKey: string } {
  if (kind === 'products') {
    const p = parseCsv(text);
    if (p.missingNameColumn) return { errorKey: 'import.noNameColumn' };
    if (p.rows.length === 0) return { errorKey: 'import.noRows' };
    return { rows: p.rows.length, unknown: p.unknownColumns };
  }
  if (kind === 'customers') {
    const p = parseCustomersCsv(text);
    if (p.missingNameColumn) return { errorKey: 'import.noNameColumn' };
    if (p.rows.length === 0) return { errorKey: 'import.noRows' };
    return { rows: p.rows.length, unknown: p.unknownColumns };
  }
  if (kind === 'orders') {
    const p = parseOrdersCsv(text);
    if (p.missingCustomerColumn) return { errorKey: 'import.noCustomerColumn' };
    if (p.rows.length === 0) return { errorKey: 'import.noRows' };
    return { rows: p.rows.length, unknown: p.unknownColumns };
  }
  const p = parseExpensesCsv(text);
  if (p.missingAmountColumn) return { errorKey: 'import.noAmountColumn' };
  if (p.rows.length === 0) return { errorKey: 'import.noRows' };
  return { rows: p.rows.length, unknown: p.unknownColumns };
}

export default function ImportScreen({ lang, onClose }: Props) {
  const [kind, setKind] = useState<Kind>('products');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const fileRef = useRef<HTMLInputElement>(null);

  const template = TEMPLATES[kind];

  const onFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseFor(kind, text);
    if ('errorKey' in parsed) {
      setState({ kind: 'error', message: t(lang, parsed.errorKey) });
      return;
    }
    setState({
      kind: 'preview',
      rows: parsed.rows,
      unknown: parsed.unknown,
      text,
    });
  };

  const runImport = async () => {
    if (state.kind !== 'preview') return;
    const { text } = state;
    setState({ kind: 'importing' });
    if (kind === 'products') {
      const r = await importProducts(parseCsv(text).rows);
      setState({ kind: 'done', added: r.added, updated: r.updated, skipped: r.skipped });
    } else if (kind === 'customers') {
      const r = await importCustomers(parseCustomersCsv(text).rows);
      setState({ kind: 'done', added: r.added, updated: r.updated, skipped: r.skipped });
    } else if (kind === 'orders') {
      const r = await importOrders(parseOrdersCsv(text).rows);
      setState({ kind: 'done', added: r.added, updated: null, skipped: r.skipped });
    } else {
      const r = await importExpenses(parseExpensesCsv(text).rows);
      setState({ kind: 'done', added: r.added, updated: null, skipped: r.skipped });
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kadai-${kind}-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pickKind = (k: Kind) => {
    setKind(k);
    setState({ kind: 'idle' });
  };

  return (
    <div className="p-4 space-y-4 md:mx-auto md:max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">
          {t(lang, 'import.title')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-teal-700 dark:text-teal-300 font-medium"
        >
          {t(lang, 'product.cancel')}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => pickKind(k)}
            className={`h-9 rounded-lg text-sm font-semibold ${
              kind === k
                ? 'bg-teal-700 text-white'
                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
            }`}
          >
            {t(lang, `import.kind.${k}`)}
          </button>
        ))}
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-300">
        {t(lang, `import.help.${kind}`)}
      </p>

      <button
        type="button"
        onClick={downloadTemplate}
        className="text-teal-700 dark:text-teal-300 font-medium underline text-sm"
      >
        {t(lang, 'import.downloadTemplate')}
      </button>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />

      {(state.kind === 'idle' || state.kind === 'error') && (
        <>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full h-14 rounded-xl bg-teal-700 text-lg font-bold text-white"
          >
            {t(lang, 'import.chooseFile')}
          </button>
          {state.kind === 'error' && (
            <p className="rounded-xl bg-red-100 dark:bg-red-900/40 px-4 py-3 text-red-700 dark:text-red-300">
              {state.message}
            </p>
          )}
        </>
      )}

      {state.kind === 'preview' && (
        <div className="space-y-3">
          <p className="text-slate-800 dark:text-slate-100">
            {t(lang, 'import.rowsFound').replace('{n}', String(state.rows))}
          </p>
          {state.unknown.length > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t(lang, 'import.ignoredColumns')}: {state.unknown.join(', ')}
            </p>
          )}
          <button
            type="button"
            onClick={runImport}
            className="w-full h-14 rounded-xl bg-teal-700 text-lg font-bold text-white"
          >
            {t(lang, 'import.confirm')}
          </button>
        </div>
      )}

      {state.kind === 'importing' && (
        <p className="text-slate-600 dark:text-slate-300">
          {t(lang, 'import.importing')}
        </p>
      )}

      {state.kind === 'done' && (
        <div className="space-y-3">
          <div className="rounded-xl bg-emerald-100 dark:bg-emerald-900/40 px-4 py-3 text-emerald-800 dark:text-emerald-200">
            {t(lang, 'import.added')}: {state.added}
            {state.updated !== null && (
              <> · {t(lang, 'import.updated')}: {state.updated}</>
            )}{' '}
            · {t(lang, 'import.skipped')}: {state.skipped}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full h-12 rounded-xl bg-slate-200 dark:bg-slate-700 font-semibold text-slate-700 dark:text-slate-100"
          >
            {t(lang, 'import.done')}
          </button>
        </div>
      )}
    </div>
  );
}
