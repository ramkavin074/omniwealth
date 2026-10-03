'use client';

import { useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { exportAssetsCsvAction } from '@/actions/vault';
import ImportCsvModal from '@/components/dashboard/ImportCsvModal';

export default function DataExportCard({
  assets = [],
  baseCurrency = 'USD',
  canImport = false,
}: {
  assets?: any[];
  baseCurrency?: string;
  canImport?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [msg, setMsg] = useState('');

  async function download() {
    setBusy(true);
    setMsg('');
    try {
      const res = await exportAssetsCsvAction();
      if (!res.success) {
        setMsg(res.error);
        return;
      }
      const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `omniwealth-assets-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setMsg('Export failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 transition-colors">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
        <Download className="w-5 h-5 text-slate-500 dark:text-slate-400" />
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Data Export</h2>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Assets as CSV</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Every household holding with its value, owner, pillar, beneficiary and access notes.
          </p>
        </div>
        <button
          type="button"
          onClick={download}
          disabled={busy}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl cursor-pointer disabled:opacity-50 transition"
        >
          <Download className="w-3.5 h-3.5" />
          {busy ? 'Preparing…' : 'Download CSV'}
        </button>
      </div>
      {canImport && (
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Import holdings from CSV</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Add many accounts at once from a spreadsheet. You review everything before it&apos;s added.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl cursor-pointer transition"
          >
            <Upload className="w-3.5 h-3.5" /> Import CSV
          </button>
        </div>
      )}
      {importOpen && (
        <ImportCsvModal existingAssets={assets} baseCurrency={baseCurrency} onClose={() => setImportOpen(false)} />
      )}
      {msg && <p className="text-[11px] text-rose-600 dark:text-rose-400">{msg}</p>}
    </div>
  );
}
