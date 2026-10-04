'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { parseBeneficiaries, serializeBeneficiaries, type Beneficiary } from '@/lib/beneficiaries';

const RELATIONSHIPS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Trust', 'Charity', 'Other'];
const CELL =
  'w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-teal-600';

/**
 * Who inherits this account, and how much each. Submits as the single form
 * field `beneficiary` (serialised; a lone name stays plain text).
 */
export default function BeneficiaryField({ defaultValue = '' }: { defaultValue?: string | null }) {
  const [rows, setRows] = useState<Beneficiary[]>(() => parseBeneficiaries(defaultValue));

  const update = (i: number, patch: Partial<Beneficiary>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const withPct = rows.filter((r) => r.percent !== null);
  const total = rows.reduce((s, r) => s + (r.percent ?? 0), 0);
  const shareNote =
    withPct.length === 0
      ? null
      : withPct.length === rows.length && Math.abs(total - 100) < 0.01
        ? { ok: true, text: 'Shares add up to 100%' }
        : { ok: false, text: `Shares total ${Math.round(total * 100) / 100}% — they should add up to 100%` };

  return (
    <div className="space-y-2">
      <input type="hidden" name="beneficiary" value={serializeBeneficiaries(rows)} />
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_auto] gap-2 items-start">
          <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_5rem] gap-2">
            <input aria-label="Beneficiary name" value={r.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Name" maxLength={80} className={CELL} />
            <input aria-label="Relationship" list="beneficiary-relationships" value={r.relationship} onChange={(e) => update(i, { relationship: e.target.value })} placeholder="Relationship" maxLength={40} className={CELL} />
            <input
              aria-label="Share percent"
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step="any"
              value={r.percent ?? ''}
              onChange={(e) => {
                const v = e.target.value === '' ? null : Math.min(100, Math.max(0, parseFloat(e.target.value)));
                update(i, { percent: v !== null && Number.isFinite(v) ? v : null });
              }}
              placeholder="%"
              className={`${CELL} font-mono`}
            />
          </div>
          <button type="button" aria-label="Remove beneficiary" onClick={() => setRows((cur) => cur.filter((_, idx) => idx !== i))} className="p-2 text-slate-400 hover:text-rose-600 cursor-pointer">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <datalist id="beneficiary-relationships">
        {RELATIONSHIPS.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      {shareNote && (
        <p className={`text-[11px] ${shareNote.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>{shareNote.text}</p>
      )}
      {rows.length < 8 && (
        <button
          type="button"
          onClick={() => setRows((cur) => [...cur, { name: '', relationship: '', percent: null }])}
          className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-400 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> {rows.length === 0 ? 'Add a beneficiary' : 'Add another'}
        </button>
      )}
    </div>
  );
}
