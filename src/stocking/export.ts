// Catalogue + stock export. Same column names the importer accepts, so an
// export can be edited and re-imported. Plus a `stock_value` column for the
// owner's report.

import type { Product } from './types';

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCatalogueCsv(products: Product[]): string {
  const header = [
    'barcode',
    'name',
    'mrp',
    'price',
    'cost',
    'unit',
    'stock',
    'low_stock_threshold',
    'expiry',
    'gst',
    'hsn',
    'stock_value',
    'stock_cost',
  ];
  const lines = [header.join(',')];
  for (const p of products) {
    lines.push(
      [
        p.barcode ?? '',
        p.name,
        p.mrp,
        p.price,
        p.costPrice || '',
        p.unit,
        p.stockQty,
        p.lowStockThreshold,
        p.expiryDate ?? '',
        p.gstRate || '',
        p.hsn ?? '',
        Math.round(p.price * p.stockQty * 100) / 100,
        p.costPrice ? Math.round(p.costPrice * p.stockQty * 100) / 100 : '',
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\n') + '\n';
}

/** Trigger a browser download. Reliable in a desktop browser (the owner can
 *  export from the in-OmniWealth /stocking page). On the Android WebView a
 *  blob download may need the Filesystem plugin — revisit if a shop needs
 *  on-device export. */
export function downloadCsv(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
