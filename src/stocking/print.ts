// Receipt printing (C7). Two outputs from one bill:
//  1. `printReceipt` — a self-contained HTML doc sized for a 58/80mm roll,
//     rendered in a hidden iframe and sent to the OS print dialog. Works on
//     desktop and on Android (print to any service / Wi-Fi thermal printer).
//  2. `escposReceipt` — raw ESC/POS bytes for a direct BLE / USB thermal
//     printer. Pure; the transport (a Capacitor BLE plugin) is a later step.

import { t, unitLabel, type Lang } from './i18n';
import type { GstConfig, Sale } from './types';
import { saleLineTotal } from './types';
import type { ReceiptConfig } from './settings';

interface PrintOpts {
  lang: Lang;
  gst: Pick<GstConfig, 'gstin'>;
  receipt: ReceiptConfig;
}

const rupee = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const esc = (s: string) =>
  s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string);

/** A full HTML document for one receipt, styled for `receipt.paper` mm. */
export function receiptHtml(sale: Sale, opts: PrintOpts): string {
  const { lang, gst, receipt } = opts;
  const widthMm = receipt.paper === 80 ? 72 : 54; // printable area < roll width
  const isRefund = !!sale.refundOf;
  const d = new Date(sale.createdAt);

  const rows = sale.items
    .map((i) => {
      const line = saleLineTotal(i);
      return `<tr><td class="nm">${esc(i.name)}${
        i.discount > 0 ? ` <span class="dim">(-${i.discount})</span>` : ''
      }<br><span class="dim">${i.qty} ${esc(unitLabel(lang, i.unit))} × ${rupee(
        i.unitPrice,
      )}</span></td><td class="amt">${rupee(line)}</td></tr>`;
    })
    .join('');

  const taxLines = (sale.taxBreakup ?? [])
    .map(
      (r) =>
        `<tr><td class="dim">GST ${r.rate}% (${rupee(r.taxable)})</td><td class="amt dim">${rupee(
          r.cgst + r.sgst,
        )}</td></tr>`,
    )
    .join('');

  const tenderLabel = t(lang, `sell.tender.${sale.tenderType}`);
  const splitBits =
    sale.tenderType === 'split'
      ? ` (${t(lang, 'sell.tender.cash')} ${rupee(sale.cashAmount)}${
          sale.upiAmount ? ` · UPI ${rupee(sale.upiAmount)}` : ''
        }${sale.cardAmount ? ` · ${t(lang, 'sell.tender.card')} ${rupee(sale.cardAmount)}` : ''})`
      : '';

  return `<!doctype html><html><head><meta charset="utf-8">
<title>${esc(sale.billNo)}</title>
<style>
  @page { size: ${receipt.paper}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { width: ${widthMm}mm; margin: 0 auto; padding: 2mm 0 4mm;
    font: 12px/1.35 -apple-system, "Segoe UI", Roboto, sans-serif; color: #000; }
  h1 { font-size: 15px; text-align: center; margin: 0; }
  .ctr { text-align: center; }
  .dim { color: #333; font-size: 11px; }
  hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: 1px 0; }
  td.amt { text-align: right; white-space: nowrap; padding-left: 4px; }
  .tot td { font-weight: 700; font-size: 14px; padding-top: 3px; }
  .foot { text-align: center; margin-top: 6px; }
</style></head><body onload="window.print()">
  ${receipt.shopName ? `<h1>${esc(receipt.shopName)}</h1>` : ''}
  ${receipt.line2 ? `<div class="ctr dim">${esc(receipt.line2)}</div>` : ''}
  ${gst.gstin ? `<div class="ctr dim">GSTIN: ${esc(gst.gstin)}</div>` : ''}
  ${gst.gstin ? `<div class="ctr dim">${t(lang, 'sell.taxInvoice')}</div>` : ''}
  <hr>
  <div><b>${esc(sale.billNo)}</b>${isRefund ? ` · ${t(lang, 'sales.refundTag')}` : ''}</div>
  <div class="dim">${d.toLocaleString('en-IN')}</div>
  ${sale.salesman ? `<div class="dim">${t(lang, 'sell.salesman')}: ${esc(sale.salesman)}</div>` : ''}
  <hr>
  <table>${rows}</table>
  <hr>
  <table>
    ${
      sale.discount > 0
        ? `<tr><td>${t(lang, 'sell.subtotal')}</td><td class="amt">${rupee(
            sale.total + sale.discount,
          )}</td></tr><tr><td>${t(lang, 'sell.discount')}</td><td class="amt">-${rupee(
            sale.discount,
          )}</td></tr>`
        : ''
    }
    ${taxLines}
    <tr class="tot"><td>${t(lang, 'sell.total')}</td><td class="amt">${rupee(sale.total)}</td></tr>
  </table>
  <div class="dim" style="margin-top:3px">${t(lang, 'sell.paid')}: ${esc(tenderLabel)}${esc(splitBits)}</div>
  ${receipt.footer ? `<div class="foot">${esc(receipt.footer)}</div>` : ''}
</body></html>`;
}

/** Render + send to the OS print dialog via a throwaway iframe. */
export function printReceipt(sale: Sale, opts: PrintOpts): void {
  const html = receiptHtml(sale, opts);
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
  // the doc's <body onload> calls print(); clean up after a beat.
  window.setTimeout(() => {
    try {
      document.body.removeChild(frame);
    } catch {
      /* already gone */
    }
  }, 60_000);
}

// ---- ESC/POS (for a future direct BLE / USB thermal printer) ----

const ESC = 0x1b;
const GS = 0x1d;

class Bytes {
  private parts: number[] = [];
  raw(...b: number[]) {
    this.parts.push(...b);
    return this;
  }
  text(s: string) {
    // ESC/POS printers are single-byte; strip to ASCII, map ₹ → "Rs ".
    const ascii = s.replace(/₹/g, 'Rs ').replace(/[^\x20-\x7e]/g, '');
    for (let i = 0; i < ascii.length; i++) this.parts.push(ascii.charCodeAt(i));
    return this;
  }
  line(s = '') {
    return this.text(s).raw(0x0a);
  }
  align(a: 'l' | 'c' | 'r') {
    return this.raw(ESC, 0x61, a === 'c' ? 1 : a === 'r' ? 2 : 0);
  }
  bold(on: boolean) {
    return this.raw(ESC, 0x45, on ? 1 : 0);
  }
  build() {
    return new Uint8Array(this.parts);
  }
}

/** Two-column row padded to `cols` (32 for 58mm, 42 for 80mm). */
function pad(left: string, right: string, cols: number): string {
  const l = left.length + right.length > cols ? left.slice(0, cols - right.length - 1) : left;
  const gap = Math.max(1, cols - l.length - right.length);
  return l + ' '.repeat(gap) + right;
}

export function escposReceipt(sale: Sale, opts: PrintOpts): Uint8Array {
  const { lang, gst, receipt } = opts;
  const cols = receipt.paper === 80 ? 42 : 32;
  const b = new Bytes().raw(ESC, 0x40); // init

  b.align('c');
  if (receipt.shopName) b.bold(true).line(receipt.shopName).bold(false);
  if (receipt.line2) b.line(receipt.line2);
  if (gst.gstin) b.line(`GSTIN: ${gst.gstin}`);
  b.align('l').line('-'.repeat(cols));

  b.line(sale.billNo + (sale.refundOf ? ' REFUND' : ''));
  b.line(new Date(sale.createdAt).toLocaleString('en-IN'));
  if (sale.salesman) b.line(`${t(lang, 'sell.salesman')}: ${sale.salesman}`);
  b.line('-'.repeat(cols));

  for (const i of sale.items) {
    b.line(pad(i.name, rupee(saleLineTotal(i)), cols));
    b.line(`  ${i.qty} ${unitLabel(lang, i.unit)} x ${rupee(i.unitPrice)}` +
      (i.discount > 0 ? ` -${i.discount}` : ''));
  }
  b.line('-'.repeat(cols));

  if (sale.discount > 0) {
    b.line(pad(t(lang, 'sell.subtotal'), rupee(sale.total + sale.discount), cols));
    b.line(pad(t(lang, 'sell.discount'), '-' + rupee(sale.discount), cols));
  }
  for (const r of sale.taxBreakup ?? []) {
    b.line(pad(`GST ${r.rate}% (${rupee(r.taxable)})`, rupee(r.cgst + r.sgst), cols));
  }
  b.bold(true).line(pad(t(lang, 'sell.total'), rupee(sale.total), cols)).bold(false);
  b.line(`${t(lang, 'sell.paid')}: ${t(lang, `sell.tender.${sale.tenderType}`)}`);

  if (receipt.footer) b.align('c').line().line(receipt.footer);
  b.raw(0x0a, 0x0a, 0x0a);
  b.raw(GS, 0x56, 0x00); // full cut
  return b.build();
}
