// Beneficiaries live in the existing free-text `assets.beneficiary` column.
// Legacy values are plain text ("Spouse — Priya"); structured values are a
// JSON array of { name, relationship, percent }. A lone name with no extra
// detail is still stored as plain text so old readers keep working.

export interface Beneficiary {
  name: string;
  relationship: string;
  /** Share of the account, 0-100; null when not specified. */
  percent: number | null;
}

const MAX_ROWS = 8;
const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

export function parseBeneficiaries(raw: string | null | undefined): Beneficiary[] {
  const text = (raw || '').trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      const arr = JSON.parse(text);
      if (Array.isArray(arr)) {
        const rows: Beneficiary[] = [];
        for (const r of arr.slice(0, MAX_ROWS)) {
          const name = clip(r?.name, 80);
          if (!name) continue;
          const p = typeof r?.percent === 'number' ? r.percent : parseFloat(r?.percent);
          rows.push({
            name,
            relationship: clip(r?.relationship, 40),
            percent: Number.isFinite(p) && p >= 0 && p <= 100 ? Math.round(p * 100) / 100 : null,
          });
        }
        return rows;
      }
    } catch {
      /* fall through: treat as plain text */
    }
  }
  return [{ name: text.slice(0, 200), relationship: '', percent: null }];
}

export function serializeBeneficiaries(rows: Beneficiary[]): string {
  const clean = rows
    .map((r) => ({ name: clip(r.name, 80), relationship: clip(r.relationship, 40), percent: r.percent }))
    .filter((r) => r.name)
    .slice(0, MAX_ROWS);
  if (clean.length === 0) return '';
  if (clean.length === 1 && !clean[0].relationship && clean[0].percent === null) return clean[0].name;
  return JSON.stringify(clean);
}

/** Server-side: accept legacy text or structured JSON, return a safe stored value (or null). */
export function normalizeBeneficiary(raw: string | null | undefined): string | null {
  return serializeBeneficiaries(parseBeneficiaries(raw)) || null;
}

/** "Priya (Spouse) 60%, Arun (Son) 40%" for exports and read-only views. */
export function formatBeneficiaries(raw: string | null | undefined): string {
  return parseBeneficiaries(raw)
    .map((b) => `${b.name}${b.relationship ? ` (${b.relationship})` : ''}${b.percent !== null ? ` ${b.percent}%` : ''}`)
    .join(', ');
}

/** 'none' = nobody named; 'shares' = percentages given but not totalling 100; 'ok' otherwise. */
export function beneficiaryStatus(raw: string | null | undefined): 'none' | 'shares' | 'ok' {
  const rows = parseBeneficiaries(raw);
  if (rows.length === 0) return 'none';
  const withPct = rows.filter((r) => r.percent !== null);
  if (withPct.length === 0) return 'ok';
  const total = rows.reduce((s, r) => s + (r.percent ?? 0), 0);
  return withPct.length === rows.length && Math.abs(total - 100) < 0.01 ? 'ok' : 'shares';
}
