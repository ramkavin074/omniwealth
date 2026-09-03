// CSV catalogue parser for the Import screen. Excel users export / "Save As"
// CSV. Column headers are matched loosely (case / spacing / common aliases)
// so a shop's existing export usually works without editing.

import type { ImportRow } from './db/products';

const ALIASES: Record<keyof ImportRow, string[]> = {
  barcode: ['barcode', 'bar code', 'ean', 'upc', 'code', 'item code'],
  name: ['name', 'product', 'product name', 'item', 'item name', 'description'],
  mrp: ['mrp', 'max retail price', 'printed price', 'maximum retail price'],
  price: ['price', 'rate', 'selling price', 'sell price', 'sale price'],
  costPrice: [
    'cost',
    'cost price',
    'cost_price',
    'purchase price',
    'buy price',
    'buying price',
    'landing cost',
  ],
  unit: ['unit', 'uom', 'units'],
  openingStock: [
    'opening stock',
    'opening',
    'opening_stock',
    'stock',
    'qty',
    'quantity',
    'current stock',
  ],
  lowStockThreshold: [
    'low stock threshold',
    'low_stock_threshold',
    'low stock',
    'reorder level',
    'reorder',
    'min stock',
    'minimum stock',
    'threshold',
  ],
  expiryDate: [
    'expiry',
    'expiry date',
    'expiry_date',
    'expire',
    'expires',
    'exp',
    'exp date',
    'best before',
    'use by',
  ],
  gstRate: ['gst', 'gst rate', 'gst_rate', 'gst%', 'tax', 'tax rate', 'gst %'],
  hsn: ['hsn', 'hsn code', 'hsn_code', 'sac'],
};

export const CSV_TEMPLATE =
  'barcode,name,mrp,price,cost,unit,opening_stock,low_stock_threshold,expiry,gst,hsn\n' +
  '8901030865278,Aashirvaad Atta 5kg,285,280,255,packet,12,4,,5,1101\n' +
  ',Sugar (loose),,45,40,kg,20,10,,0,\n' +
  ',Amul Butter 500g,,275,255,piece,8,3,2026-11-30,12,0405\n';

export const CUSTOMERS_CSV_TEMPLATE =
  'name,phone,place,gstin,balance,limit,note\n' +
  'Ravi Traders,9876543210,Nagercoil,33ABCDE1234F1Z5,4200,10000,wedding cards\n' +
  'Selvi Stores,9843012345,Marthandam,,0,5000,\n' +
  'Walk-in (Kumar),,Thuckalay,,1500,,old balance carried over\n';

export const ORDERS_CSV_TEMPLATE =
  'order_no,customer,phone,item,qty,rate,total,advance,due,status,note\n' +
  'OLD-101,Ravi Traders,9876543210,500 wedding cards gold foil,500,18,9000,3000,2026-09-20,in_progress,design 12\n' +
  'OLD-102,Selvi Stores,9843012345,Flex banner 6x4,1,850,850,0,2026-09-10,ready,\n';

/** Normalise a date cell to 'YYYY-MM-DD', or null if unrecognised.
 *  Accepts ISO, or day-first dd/mm/yyyy and dd-mm-yyyy (the Indian norm). */
function toISODate(v: string | undefined): string | null {
  const s = (v ?? '').trim();
  if (!s) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return s;
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(s);
  if (dmy) {
    const dd = dmy[1].padStart(2, '0');
    const mm = dmy[2].padStart(2, '0');
    const yyyy = dmy[3].length === 2 ? '20' + dmy[3] : dmy[3];
    if (+mm >= 1 && +mm <= 12 && +dd >= 1 && +dd <= 31) {
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  return null;
}

/** Split one CSV line, honouring double-quoted fields. */
function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQ = true;
    } else if (c === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function num(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(v.replace(/[₹,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export interface ParseResult {
  rows: ImportRow[];
  /** Header names the parser could not map to any known column. */
  unknownColumns: string[];
  /** True when no `name` column was found — nothing can be imported. */
  missingNameColumn: boolean;
}

export function parseCsv(text: string): ParseResult {
  const lines = text
    .replace(/^﻿/, '') // strip BOM
    .split(/\r\n|\n|\r/)
    .filter((l) => l.trim() !== '');

  if (lines.length === 0) {
    return { rows: [], unknownColumns: [], missingNameColumn: true };
  }

  const headers = splitLine(lines[0]).map((h) => h.toLowerCase());

  const colIndex: Partial<Record<keyof ImportRow, number>> = {};
  const known = new Set<string>();
  (Object.keys(ALIASES) as (keyof ImportRow)[]).forEach((key) => {
    const idx = headers.findIndex((h) => ALIASES[key].includes(h));
    if (idx !== -1) {
      colIndex[key] = idx;
      known.add(headers[idx]);
    }
  });

  const unknownColumns = headers.filter((h) => h && !known.has(h));
  const missingNameColumn = colIndex.name === undefined;
  if (missingNameColumn) {
    return { rows: [], unknownColumns, missingNameColumn };
  }

  const get = (cells: string[], key: keyof ImportRow): string | undefined => {
    const i = colIndex[key];
    return i === undefined ? undefined : cells[i];
  };

  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    const name = (get(cells, 'name') ?? '').trim();
    if (!name) continue;
    const barcodeRaw = (get(cells, 'barcode') ?? '').trim();
    rows.push({
      barcode: barcodeRaw || null,
      name,
      mrp: num(get(cells, 'mrp')),
      price: num(get(cells, 'price')),
      costPrice: num(get(cells, 'costPrice')),
      unit: (get(cells, 'unit') ?? 'piece').trim() || 'piece',
      openingStock: num(get(cells, 'openingStock')),
      lowStockThreshold: num(get(cells, 'lowStockThreshold')),
      expiryDate: toISODate(get(cells, 'expiryDate')),
      gstRate: num(get(cells, 'gstRate')),
      hsn: (get(cells, 'hsn') ?? '').trim() || null,
    });
  }

  return { rows, unknownColumns, missingNameColumn };
}

// ---- customers (credit / khata migration from an existing billing app) ----

export interface CustomerImportRow {
  name: string;
  phone: string | null;
  place: string | null;
  gstin: string | null;
  openingBalance: number; // what the customer already owes on the old system
  creditLimit: number;
  note: string | null;
}

const CUSTOMER_ALIASES: Record<keyof CustomerImportRow, string[]> = {
  name: ['name', 'customer', 'customer name', 'party', 'party name', 'account'],
  phone: ['phone', 'mobile', 'mobile no', 'contact', 'phone no', 'whatsapp'],
  place: ['place', 'area', 'city', 'town', 'village', 'address', 'location'],
  gstin: ['gstin', 'gst', 'gst no', 'gstn', 'gst number', 'tax no'],
  openingBalance: [
    'balance',
    'opening balance',
    'opening',
    'outstanding',
    'outstanding balance',
    'due',
    'closing balance',
    'to collect',
    'receivable',
  ],
  creditLimit: ['limit', 'credit limit', 'creditlimit', 'max credit'],
  note: ['note', 'notes', 'remarks', 'remark', 'comment'],
};

export interface CustomerParseResult {
  rows: CustomerImportRow[];
  unknownColumns: string[];
  missingNameColumn: boolean;
}

export function parseCustomersCsv(text: string): CustomerParseResult {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r\n|\n|\r/)
    .filter((l) => l.trim() !== '');
  if (lines.length === 0) {
    return { rows: [], unknownColumns: [], missingNameColumn: true };
  }

  const headers = splitLine(lines[0]).map((h) => h.toLowerCase());
  const colIndex: Partial<Record<keyof CustomerImportRow, number>> = {};
  const known = new Set<string>();
  (Object.keys(CUSTOMER_ALIASES) as (keyof CustomerImportRow)[]).forEach(
    (key) => {
      const idx = headers.findIndex((h) => CUSTOMER_ALIASES[key].includes(h));
      if (idx !== -1) {
        colIndex[key] = idx;
        known.add(headers[idx]);
      }
    },
  );

  const unknownColumns = headers.filter((h) => h && !known.has(h));
  if (colIndex.name === undefined) {
    return { rows: [], unknownColumns, missingNameColumn: true };
  }

  const get = (
    cells: string[],
    key: keyof CustomerImportRow,
  ): string | undefined => {
    const i = colIndex[key];
    return i === undefined ? undefined : cells[i];
  };

  const rows: CustomerImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    const name = (get(cells, 'name') ?? '').trim();
    if (!name) continue;
    rows.push({
      name,
      phone: (get(cells, 'phone') ?? '').trim() || null,
      place: (get(cells, 'place') ?? '').trim() || null,
      gstin: (get(cells, 'gstin') ?? '').trim().toUpperCase() || null,
      openingBalance: num(get(cells, 'openingBalance')),
      creditLimit: num(get(cells, 'creditLimit')),
      note: (get(cells, 'note') ?? '').trim() || null,
    });
  }
  return { rows, unknownColumns, missingNameColumn: false };
}

// ---- open orders / advance-booked jobs ----

export interface OrderImportRow {
  orderNo: string | null;
  customerName: string;
  phone: string | null;
  description: string;
  qty: number;
  rate: number;
  lineTotal: number | null; // when the sheet only has a total, not qty×rate
  advance: number;
  dueDate: string | null;
  status: string | null;
  note: string | null;
}

const ORDER_ALIASES: Record<keyof OrderImportRow, string[]> = {
  orderNo: [
    'order_no',
    'order no',
    'order',
    'order number',
    'bill no',
    'ref',
    'reference',
    'job no',
    'job card',
    'token',
  ],
  customerName: ['customer', 'customer name', 'party', 'name', 'party name'],
  phone: ['phone', 'mobile', 'contact', 'mobile no'],
  description: [
    'item',
    'description',
    'particulars',
    'work',
    'details',
    'product',
    'job',
  ],
  qty: ['qty', 'quantity', 'nos', 'count', 'pcs'],
  rate: ['rate', 'price', 'unit price', 'unit rate'],
  lineTotal: ['total', 'amount', 'line total', 'value', 'net', 'net amount'],
  advance: ['advance', 'advance paid', 'paid', 'advance amount', 'token amount'],
  dueDate: [
    'due',
    'due date',
    'delivery',
    'delivery date',
    'promised',
    'deliver on',
    'expected',
  ],
  status: ['status', 'stage', 'state'],
  note: ['note', 'notes', 'remarks', 'remark', 'comment'],
};

export interface OrderParseResult {
  rows: OrderImportRow[];
  unknownColumns: string[];
  missingCustomerColumn: boolean;
}

export function parseOrdersCsv(text: string): OrderParseResult {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r\n|\n|\r/)
    .filter((l) => l.trim() !== '');
  if (lines.length === 0) {
    return { rows: [], unknownColumns: [], missingCustomerColumn: true };
  }

  const headers = splitLine(lines[0]).map((h) => h.toLowerCase());
  const colIndex: Partial<Record<keyof OrderImportRow, number>> = {};
  const known = new Set<string>();
  (Object.keys(ORDER_ALIASES) as (keyof OrderImportRow)[]).forEach((key) => {
    const idx = headers.findIndex((h) => ORDER_ALIASES[key].includes(h));
    if (idx !== -1) {
      colIndex[key] = idx;
      known.add(headers[idx]);
    }
  });

  const unknownColumns = headers.filter((h) => h && !known.has(h));
  if (colIndex.customerName === undefined) {
    return { rows: [], unknownColumns, missingCustomerColumn: true };
  }

  const get = (
    cells: string[],
    key: keyof OrderImportRow,
  ): string | undefined => {
    const i = colIndex[key];
    return i === undefined ? undefined : cells[i];
  };

  const rows: OrderImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    const customerName = (get(cells, 'customerName') ?? '').trim();
    if (!customerName) continue;
    const hasTotalCol = colIndex.lineTotal !== undefined;
    const lineTotal = hasTotalCol ? num(get(cells, 'lineTotal')) : null;
    rows.push({
      orderNo: (get(cells, 'orderNo') ?? '').trim() || null,
      customerName,
      phone: (get(cells, 'phone') ?? '').trim() || null,
      description:
        (get(cells, 'description') ?? '').trim() || 'Order (imported)',
      qty: num(get(cells, 'qty')) || 1,
      rate: num(get(cells, 'rate')),
      lineTotal,
      advance: num(get(cells, 'advance')),
      dueDate: toISODate(get(cells, 'dueDate')),
      status: (get(cells, 'status') ?? '').trim().toLowerCase() || null,
      note: (get(cells, 'note') ?? '').trim() || null,
    });
  }
  return { rows, unknownColumns, missingCustomerColumn: false };
}
