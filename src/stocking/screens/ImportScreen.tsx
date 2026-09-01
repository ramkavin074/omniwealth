'use client';

import { useRef, useState } from 'react';
import { t, type Lang } from '../i18n';
import { importProducts, type ImportResult } from '../db/products';
import { CSV_TEMPLATE, parseCsv } from '../import';

interface Props {
  lang: Lang;
  onClose: () => void;
}

type State =
  | { kind: 'idle' }
  | { kind: 'preview'; rows: number; unknown: string[]; text: string }
  | { kind: 'error'; message: string }
  | { kind: 'importing' }
  | { kind: 'done'; result: ImportResult };

export default function ImportScreen({ lang, onClose }: Props) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.missingNameColumn) {
      setState({ kind: 'error', message: t(lang, 'import.noNameColumn') });
      return;
    }
    if (parsed.rows.length === 0) {
      setState({ kind: 'error', message: t(lang, 'import.noRows') });
      return;
    }
    setState({
      kind: 'preview',
      rows: parsed.rows.length,
      unknown: parsed.unknownColumns,
      text,
    });
  };

  const runImport = async () => {
    if (state.kind !== 'preview') return;
    setState({ kind: 'importing' });
    const parsed = parseCsv(state.text);
    const result = await importProducts(parsed.rows);
    setState({ kind: 'done', result });
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stocking-template.csv';
    a.click();
    URL.revokeObjectURL(url);
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

      <p className="text-sm text-slate-600 dark:text-slate-300">
        {t(lang, 'import.help')}
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
            {t(lang, 'import.added')}: {state.result.added} ·{' '}
            {t(lang, 'import.updated')}: {state.result.updated} ·{' '}
            {t(lang, 'import.skipped')}: {state.result.skipped}
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
