// Shelf / price labels: name, price and a scannable barcode, laid out for an A4 sticker
// sheet or a small label roll, and sent to the OS print dialog (same route as receipts).

import { canEncode128, code128Svg } from '@/lib/code128';

export type LabelLayout = 'a4' | 'roll';
export type LabelPrice = 'rate' | 'mrp' | 'none';

export interface LabelItem {
  name: string;
  barcode: string; // already non-empty and encodable
  rate: number;
  mrp: number;
  copies: number;
}

export interface LabelOptions {
  layout: LabelLayout;
  price: LabelPrice;
  shopName?: string;
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

const rupee = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

export const MAX_COPIES = 200;

/** One label's markup. */
function labelHtml(it: LabelItem, o: LabelOptions): string {
  const price =
    o.price === 'none' ? 0 : o.price === 'mrp' ? it.mrp || it.rate : it.rate || it.mrp;
  const bars = canEncode128(it.barcode) ? code128Svg(it.barcode, 40) : '';
  return `<div class="lb">
<div class="nm">${esc(it.name)}</div>
${price > 0 ? `<div class="pr">${esc(rupee(price))}</div>` : ''}
<div class="bc">${bars}</div>
<div class="cd">${esc(it.barcode)}${o.shopName ? ' · ' + esc(o.shopName) : ''}</div>
</div>`;
}

/** Full printable document. Copies are repeated in order. */
export function labelsHtml(items: LabelItem[], o: LabelOptions): string {
  const cells: string[] = [];
  for (const it of items) {
    const n = Math.min(MAX_COPIES, Math.max(1, Math.floor(it.copies) || 1));
    const html = labelHtml(it, o);
    for (let i = 0; i < n; i++) cells.push(html);
  }
  const a4 = o.layout === 'a4';
  const css = a4
    ? `@page{size:A4;margin:8mm}
body{margin:0;font-family:system-ui,sans-serif}
.sheet{display:grid;grid-template-columns:repeat(3,1fr);gap:0}
.lb{box-sizing:border-box;height:36mm;padding:2.5mm 3mm;border:0.2mm dashed #bbb;overflow:hidden;page-break-inside:avoid}`
    : `@page{size:50mm 25mm;margin:0}
body{margin:0;font-family:system-ui,sans-serif}
.sheet{display:block}
.lb{box-sizing:border-box;width:50mm;height:25mm;padding:1.5mm 2mm;overflow:hidden;page-break-after:always}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Labels</title><style>
${css}
.nm{font-size:${a4 ? '9pt' : '7pt'};font-weight:600;line-height:1.15;max-height:${a4 ? '10mm' : '7mm'};overflow:hidden}
.pr{font-size:${a4 ? '14pt' : '10pt'};font-weight:800;line-height:1.1}
.bc{height:${a4 ? '12mm' : '8mm'};margin-top:1mm}
.bc svg{width:100%;height:100%;display:block}
.cd{font-size:${a4 ? '7pt' : '5.5pt'};text-align:center;color:#333;margin-top:0.5mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
</style></head><body onload="setTimeout(function(){window.print()},300)"><div class="sheet">${cells.join('')}</div></body></html>`;
}

/** Send a document to the OS print dialog through a throwaway iframe. */
export function printHtml(html: string): void {
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    document.body.removeChild(frame);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  window.setTimeout(() => {
    try {
      document.body.removeChild(frame);
    } catch {
      /* already gone */
    }
  }, 120_000);
}

/** A short internal code for items that have no barcode; shopkeeper sticks the label on the item. */
export function newInternalCode(existing: Set<string>): string {
  for (let i = 0; i < 50; i++) {
    const code = 'K' + String(Math.floor(Math.random() * 1e7)).padStart(7, '0');
    if (!existing.has(code)) return code;
  }
  return 'K' + Date.now().toString(36).toUpperCase();
}
