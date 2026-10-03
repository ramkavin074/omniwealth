'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, Download, FileSpreadsheet, X } from 'lucide-react';
import { importAssetsCsvAction } from '@/actions/import';
import {
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  TEMPLATE_CSV,
  dupKey,
  parseAssetCsv,
  type ParseResult,
} from '@/lib/assetCsv';

interface Props {
  existingAssets: any[];
  baseCurrency: string;
  onClose: () => void;
}

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'omniwealth-import-template.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ImportCsvModal({ existingAssets, baseCurrency, onClose }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [readError, setReadError] = useState('');
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [done, setDone] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const existingKeys = useMemo(
    () => new Set(existingAssets.map((a) => dupKey(a.name || '', a.accountNumber || '', a.nativeCurrency || 'USD'))),
    [existingAssets],
  );

  const onFile = async (file: File | undefined) => {
    setReadError('');
    setError('');
    setResult(null);
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setReadError('That file is too large (max 512 KB).');
      return;
    }
    setFileName(file.name);
    try {
      setResult(parseAssetCsv(await file.text(), baseCurrency, existingKeys));
    } catch {
      setReadError('Could not read that file.');
    }
  };

  const rows = result?.rows ?? [];
  const valid = rows.filter((r) => r.clean);
  const invalid = rows.filter((r) => !r.clean);
  const duplicates = valid.filter((r) => r.duplicate);
  const toImport = valid.filter((r) => includeDuplicates || !r.duplicate);

  const submit = () => {
    setError('');
    startTransition(async () => {
      const res = await importAssetsCsvAction(
        toImport.map((r) => r.raw),
        !includeDuplicates,
      );
      if (!res.success) {
        setError(res.error);
        return;
      }
      setDone({ imported: res.imported, skipped: res.skipped });
      router.refresh();
    });
  };

  const problems = rows.filter((r) => r.errors.length > 0 || r.warnings.length > 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs overflow-y-auto flex items-center justify-center p-4 print:hidden">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-xl my-auto text-slate-900 dark:text-white">
        <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-bold flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-teal-600" /> Import from CSV
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-4">
              <Check className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                  Imported {done.imported} holding{done.imported === 1 ? '' : 's'}.
                </p>
                {done.skipped > 0 && (
                  <p className="text-emerald-700 dark:text-emerald-400 text-xs mt-0.5">
                    {done.skipped} skipped (duplicates or invalid rows).
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-sm font-semibold cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Upload a spreadsheet saved as CSV. It needs a <strong>Name</strong> and a <strong>Value</strong> column; Type, Currency,
              Quantity, Ticker, Account Category, Account Number and Legacy Pillar are optional. Your own export from Household
              Settings works too. Up to {MAX_IMPORT_ROWS} rows. Nothing is added until you confirm.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-xs font-semibold cursor-pointer"
              >
                {fileName ? 'Choose a different file' : 'Choose CSV file'}
              </button>
              <button
                type="button"
                onClick={downloadTemplate}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Download template
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                className="hidden"
                onChange={(e) => {
                  void onFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>
            {fileName && <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">File: {fileName}</p>}
            {readError && <p className="text-xs text-rose-600 dark:text-rose-400">{readError}</p>}
            {result?.fatal && (
              <div className="flex items-start gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 p-3 text-xs text-rose-700 dark:text-rose-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {result.fatal}
              </div>
            )}

            {result && !result.fatal && (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat label="Ready" value={valid.length - duplicates.length} tone="ok" />
                  <Stat label="Duplicates" value={duplicates.length} tone={duplicates.length ? 'warn' : 'mute'} />
                  <Stat label="Errors" value={invalid.length} tone={invalid.length ? 'bad' : 'mute'} />
                </div>

                {duplicates.length > 0 && (
                  <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeDuplicates}
                      onChange={(e) => setIncludeDuplicates(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      Also import the {duplicates.length} row{duplicates.length === 1 ? '' : 's'} that {duplicates.length === 1 ? 'matches' : 'match'} an existing holding
                      (same name, account number and currency). Skipped by default.
                    </span>
                  </label>
                )}

                {problems.length > 0 && (
                  <ul className="max-h-40 overflow-y-auto space-y-1 rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-[11px]">
                    {problems.slice(0, 25).map((r) => (
                      <li key={r.line} className={r.errors.length ? 'text-rose-700 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'}>
                        <span className="font-mono">Row {r.line}</span>
                        {r.raw.name ? ` (${r.raw.name})` : ''}: {[...r.errors, ...r.warnings].join('; ')}
                      </li>
                    ))}
                    {problems.length > 25 && <li className="text-slate-500">…and {problems.length - 25} more</li>}
                  </ul>
                )}

                {toImport.length > 0 && (
                  <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                    {toImport.slice(0, 8).map((r) => (
                      <div key={r.line} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                        <span className="truncate font-medium">{r.clean!.name}</span>
                        <span className="shrink-0 font-mono text-slate-500 dark:text-slate-400">
                          {r.clean!.assetType.replace(/_/g, ' ').toLowerCase()} · {r.clean!.value.toLocaleString()} {r.clean!.currency}
                        </span>
                      </div>
                    ))}
                    {toImport.length > 8 && (
                      <div className="px-3 py-2 text-[11px] text-slate-500">…and {toImport.length - 8} more</div>
                    )}
                  </div>
                )}
              </>
            )}

            {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending || toImport.length === 0}
                className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 disabled:opacity-40 text-white text-sm font-semibold cursor-pointer"
              >
                {pending ? 'Importing…' : `Import ${toImport.length || ''} holding${toImport.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'ok' | 'warn' | 'bad' | 'mute' }) {
  const color = {
    ok: 'text-emerald-700 dark:text-emerald-400',
    warn: 'text-amber-700 dark:text-amber-400',
    bad: 'text-rose-700 dark:text-rose-400',
    mute: 'text-slate-400',
  }[tone];
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 py-2">
      <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}
