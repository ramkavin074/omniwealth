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
};

export const CSV_TEMPLATE =
  'barcode,name,mrp,price,cost,unit,opening_stock,low_stock_threshold\n' +
  '8901030865278,Aashirvaad Atta 5kg,285,280,255,packet,12,4\n' +
  ',Sugar (loose),,45,40,kg,20,10\n';

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
    });
  }

  return { rows, unknownColumns, missingNameColumn };
}
