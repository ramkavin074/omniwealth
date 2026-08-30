/**
 * Coerce an arbitrary value into a clean decimal string safe to store in a
 * Postgres `numeric` column.
 *
 * Strips grouping separators / currency symbols / whitespace, and falls back
 * to `fallback` when the result isn't a finite number. Used at every DB
 * write boundary for money / quantity fields (AI-parsed statement values,
 * form inputs, computed prices).
 */
export function toNumeric(value: unknown, fallback = '0'): string {
  if (value === null || value === undefined) return fallback;

  let s = String(value).trim();
  if (s === '') return fallback;

  // Drop everything except digits, sign, decimal point.
  s = s.replace(/[^0-9.\-]/g, '');

  // Keep only the first '-' (and only if leading) and the first '.'.
  const neg = s.startsWith('-');
  s = s.replace(/-/g, '');
  const firstDot = s.indexOf('.');
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
  }
  if (neg) s = '-' + s;

  const n = Number(s);
  if (!Number.isFinite(n)) return fallback;

  return s === '' || s === '-' || s === '.' ? fallback : s;
}
