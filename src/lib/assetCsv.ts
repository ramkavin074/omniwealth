// CSV import for holdings: parsing, header matching and per-row validation.
// Pure (no DB, no React) so the browser can preview with exactly the same
// rules the server re-applies before inserting anything.

export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'JPY', 'CHF', 'CNY'] as const;
export const MAX_IMPORT_ROWS = 500;
export const MAX_IMPORT_BYTES = 512 * 1024;

const ASSET_TYPES = [
  'STOCK', 'ETF', 'MUTUAL_FUND', 'CRYPTO', 'COMMODITY', 'CASH', 'FIXED_INCOME',
  'PENSION', 'HSA', 'REAL_ESTATE', 'OTHER', 'LIABILITY',
] as const;

const ACCOUNT_CATEGORIES = [
  'INDIVIDUAL', 'IRA', 'ROTH_IRA', '401K', 'HSA', 'PPF', 'PF', 'PENSION',
  'SOCIAL_SECURITY', '529', 'TRUST', 'REAL_ESTATE', 'LIABILITY',
] as const;

/** Raw, still-untrusted field values for one row (what travels to the server). */
export interface RawRow {
  name: string;
  type: string;
  category: string;
  accountNumber: string;
  currency: string;
  value: string;
  quantity: string;
  ticker: string;
  pillar: string;
  owner: string;
}

export interface CleanRow {
  name: string;
  assetType: string;
  accountCategory: string;
  accountNumber: string;
  currency: string;
  value: number;
  quantity: number | null;
  ticker: string | null;
  pillar: string;
  owner: string;
}

export interface ParsedRow {
  line: number; // 1-based line in the file, counting the header
  raw: RawRow;
  clean: CleanRow | null;
  errors: string[];
  warnings: string[];
  duplicate: boolean;
}

export const TEMPLATE_CSV = [
  'Name,Type,Currency,Value,Quantity,Ticker,Account Category,Account Number,Legacy Pillar',
  'Checking account,Cash,USD,12500,,,INDIVIDUAL,1234,',
  'Apple shares,Stock,USD,18000,100,AAPL,INDIVIDUAL,5678,Growth',
  'Mortgage,Liability,USD,310000,,,LIABILITY,,',
].join('\r\n');

// ---- CSV tokenizer ------------------------------------------------------

/** RFC-4180-style parser: quoted fields, "" escapes, CRLF/LF, BOM, and a
 *  comma / semicolon / tab delimiter sniffed from the header line. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const delim = count('\t') > count(',') && count('\t') >= count(';')
    ? '\t'
    : count(';') > count(',')
      ? ';'
      : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop fully blank lines.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

// ---- Header matching ----------------------------------------------------

const HEADER_ALIASES: Record<keyof RawRow, string[]> = {
  name: ['name', 'asset', 'asset name', 'account', 'account name', 'holding', 'description'],
  type: ['type', 'asset type', 'class', 'asset class'],
  category: ['account category', 'category', 'account type'],
  accountNumber: ['account number', 'account no', 'account #', 'account id', 'number'],
  currency: ['currency', 'ccy', 'curr'],
  value: ['value', 'native value', 'total value', 'amount', 'balance', 'market value'],
  quantity: ['quantity', 'qty', 'units', 'shares'],
  ticker: ['ticker', 'symbol'],
  pillar: ['legacy pillar', 'pillar', 'purpose', 'rationale'],
  owner: ['owner', 'member'],
};

const norm = (s: string) => s.toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();

function mapHeaders(header: string[]): Partial<Record<keyof RawRow, number>> {
  const out: Partial<Record<keyof RawRow, number>> = {};
  header.forEach((h, idx) => {
    const n = norm(h);
    for (const key of Object.keys(HEADER_ALIASES) as (keyof RawRow)[]) {
      if (out[key] === undefined && HEADER_ALIASES[key].includes(n)) {
        out[key] = idx;
        return;
      }
    }
  });
  return out;
}

// ---- Value normalisation ------------------------------------------------

const TYPE_ALIASES: Record<string, string> = {
  stock: 'STOCK', stocks: 'STOCK', equity: 'STOCK', equities: 'STOCK', share: 'STOCK', shares: 'STOCK',
  etf: 'ETF', etfs: 'ETF',
  'mutual fund': 'MUTUAL_FUND', 'mutual funds': 'MUTUAL_FUND', fund: 'MUTUAL_FUND', funds: 'MUTUAL_FUND',
  crypto: 'CRYPTO', cryptocurrency: 'CRYPTO', bitcoin: 'CRYPTO',
  gold: 'COMMODITY', silver: 'COMMODITY', commodity: 'COMMODITY', 'commodity gold': 'COMMODITY',
  cash: 'CASH', bank: 'CASH', savings: 'CASH', checking: 'CASH', deposit: 'CASH', 'bank account': 'CASH',
  'fixed income': 'FIXED_INCOME', bond: 'FIXED_INCOME', bonds: 'FIXED_INCOME', ppf: 'FIXED_INCOME',
  fd: 'FIXED_INCOME', 'fixed deposit': 'FIXED_INCOME',
  pension: 'PENSION', retirement: 'PENSION', '401k': 'PENSION', ira: 'PENSION',
  hsa: 'HSA',
  'real estate': 'REAL_ESTATE', property: 'REAL_ESTATE', house: 'REAL_ESTATE', home: 'REAL_ESTATE', land: 'REAL_ESTATE',
  other: 'OTHER',
  liability: 'LIABILITY', debt: 'LIABILITY', loan: 'LIABILITY', mortgage: 'LIABILITY', 'credit card': 'LIABILITY',
};

function normalizeType(raw: string): { type: string; known: boolean } {
  const n = norm(raw);
  if (!n) return { type: 'OTHER', known: true };
  const direct = n.toUpperCase().replace(/ /g, '_');
  if ((ASSET_TYPES as readonly string[]).includes(direct)) return { type: direct, known: true };
  const alias = TYPE_ALIASES[n];
  return alias ? { type: alias, known: true } : { type: 'OTHER', known: false };
}

function normalizeCategory(raw: string): { cat: string; known: boolean } {
  const n = raw.trim();
  if (!n) return { cat: 'INDIVIDUAL', known: true };
  const up = n.toUpperCase().replace(/[\s\-()]+/g, '_').replace(/^_+|_+$/g, '');
  const fixed = up === '401_K' || up === '401(K)' ? '401K' : up;
  return (ACCOUNT_CATEGORIES as readonly string[]).includes(fixed)
    ? { cat: fixed, known: true }
    : { cat: 'INDIVIDUAL', known: false };
}

/** Parses "1,234.50", "$1 234", "(500)" etc. Returns null when not a number. */
function parseNumber(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  const parens = /^\(.*\)$/.test(s);
  s = s.replace(/[^0-9.,\-]/g, '');
  if (!s) return null;
  // "1.234,56" (EU) vs "1,234.56" (US) vs "1,25,000" (Indian grouping).
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    const after = s.length - lastComma - 1;
    const commas = s.split(',').length - 1;
    // A lone comma followed by 1-2 digits is a decimal comma ("12,5");
    // anything else (groups of three, or several commas) is thousands.
    const decimalComma = lastDot !== -1 || (commas === 1 && after !== 3);
    s = decimalComma ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else {
    s = s.replace(/,/g, '');
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return parens ? -Math.abs(n) : n;
}

export const dupKey = (name: string, accountNumber: string, currency: string) =>
  `${name.trim().toLowerCase()}|${(accountNumber || 'DEFAULT').trim().toLowerCase()}|${currency.trim().toUpperCase()}`;

/** Validates one raw row. Used by the browser preview AND the server. */
export function normalizeRaw(
  raw: RawRow,
  baseCurrency: string,
): { clean: CleanRow | null; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const name = raw.name.trim().slice(0, 200);
  if (!name) errors.push('Name is missing');

  const t = normalizeType(raw.type);
  if (!t.known) warnings.push(`Unknown type "${raw.type.trim()}", using Other`);
  const isLiability = t.type === 'LIABILITY';

  const c = normalizeCategory(raw.category);
  if (!c.known) warnings.push(`Unknown category "${raw.category.trim()}", using Individual`);
  const accountCategory = isLiability ? 'LIABILITY' : c.cat;

  const currencyRaw = raw.currency.trim().toUpperCase() || baseCurrency.toUpperCase();
  if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(currencyRaw)) {
    errors.push(`Currency "${raw.currency.trim()}" isn't supported (use ${SUPPORTED_CURRENCIES.join(', ')})`);
  }

  let value = parseNumber(raw.value);
  if (value === null) {
    errors.push('Value is missing or not a number');
  } else if (value < 0) {
    if (isLiability) value = Math.abs(value);
    else errors.push('Value is negative (enter debts with Type = Liability)');
  } else if (value > 1e13) {
    errors.push('Value is too large');
  }

  let quantity = parseNumber(raw.quantity);
  if (quantity !== null && quantity <= 0) {
    errors.push('Quantity must be more than zero');
    quantity = null;
  }
  let ticker: string | null = raw.ticker.trim().slice(0, 40) || null;
  // Refresh Prices recomputes value as quantity x live price, so a ticker
  // without a quantity would silently turn the value into one unit's price.
  if (ticker && quantity === null) {
    warnings.push('Ticker ignored because Quantity is empty (live prices need both)');
    ticker = null;
  }
  if (isLiability) ticker = null;

  if (errors.length > 0 || value === null) return { clean: null, errors, warnings };

  return {
    clean: {
      name,
      assetType: t.type,
      accountCategory,
      accountNumber: raw.accountNumber.trim().slice(0, 100) || 'DEFAULT',
      currency: currencyRaw,
      value,
      quantity,
      ticker,
      pillar: raw.pillar.trim().slice(0, 200) || 'General Long-Term Growth',
      owner: raw.owner.trim(),
    },
    errors,
    warnings,
  };
}

export interface ParseResult {
  fatal?: string;
  rows: ParsedRow[];
}

/** Parses a whole file. `existing` is a set of dupKey()s already in the household. */
export function parseAssetCsv(text: string, baseCurrency: string, existing: Set<string>): ParseResult {
  const table = parseCsv(text);
  if (table.length < 2) return { fatal: 'The file has no data rows.', rows: [] };

  const cols = mapHeaders(table[0]);
  if (cols.name === undefined || cols.value === undefined) {
    return {
      fatal: 'Could not find the required columns. The first row must include "Name" and "Value".',
      rows: [],
    };
  }
  if (table.length - 1 > MAX_IMPORT_ROWS) {
    return { fatal: `Too many rows (max ${MAX_IMPORT_ROWS} per import).`, rows: [] };
  }

  const get = (cells: string[], key: keyof RawRow) =>
    cols[key] === undefined ? '' : (cells[cols[key] as number] ?? '').trim();

  const raws: RawRow[] = table.slice(1).map((cells) => ({
    name: get(cells, 'name'),
    type: get(cells, 'type'),
    category: get(cells, 'category'),
    accountNumber: get(cells, 'accountNumber'),
    currency: get(cells, 'currency'),
    value: get(cells, 'value'),
    quantity: get(cells, 'quantity'),
    ticker: get(cells, 'ticker'),
    pillar: get(cells, 'pillar'),
    owner: get(cells, 'owner'),
  }));
  return { rows: processRawRows(raws, baseCurrency, existing) };
}

/** Validates already-split rows (from a CSV, or from the AI clean-up) and flags duplicates. */
export function processRawRows(raws: RawRow[], baseCurrency: string, existing: Set<string>): ParsedRow[] {
  const seen = new Set<string>();
  return raws.map((raw, i) => {
    const { clean, errors, warnings } = normalizeRaw(raw, baseCurrency);
    let duplicate = false;
    if (clean) {
      const key = dupKey(clean.name, clean.accountNumber, clean.currency);
      duplicate = existing.has(key) || seen.has(key);
      seen.add(key);
    }
    return { line: i + 2, raw, clean, errors, warnings, duplicate };
  });
}
