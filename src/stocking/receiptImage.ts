// Render a bill as a receipt-style PNG and hand it to the OS share sheet
// (so it can go to WhatsApp as an image, not plain text). Pure Canvas — no
// library. Falls back to a text share where Web Share with files isn't
// available (older WebView, desktop).

import { t, unitLabel, type Lang } from './i18n';
import { saleLineTotal, type GstConfig, type Sale } from './types';
import type { ReceiptConfig } from './settings';

interface Opts {
  lang: Lang;
  gst: Pick<GstConfig, 'gstin'>;
  receipt: ReceiptConfig;
}

const rupee = (n: number) =>
  '₹' +
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type DrawOp =
  | { k: 'line'; text: string; align: 'l' | 'c'; bold?: boolean; size?: number; dim?: boolean }
  | { k: 'row'; left: string; right: string; bold?: boolean; size?: number; dim?: boolean }
  | { k: 'hr' }
  | { k: 'gap'; h: number };

function build(sale: Sale, opts: Opts): DrawOp[] {
  const { lang, gst, receipt } = opts;
  const ops: DrawOp[] = [];
  const push = (o: DrawOp) => ops.push(o);

  if (receipt.shopName) push({ k: 'line', text: receipt.shopName, align: 'c', bold: true, size: 17 });
  if (receipt.line2) push({ k: 'line', text: receipt.line2, align: 'c', dim: true });
  if (gst.gstin) push({ k: 'line', text: `GSTIN: ${gst.gstin}`, align: 'c', dim: true });
  if (gst.gstin) push({ k: 'line', text: t(lang, 'sell.taxInvoice'), align: 'c', dim: true });
  push({ k: 'hr' });

  push({
    k: 'line',
    text: sale.billNo + (sale.refundOf ? ` · ${t(lang, 'sales.refundTag')}` : ''),
    align: 'l',
    bold: true,
  });
  push({ k: 'line', text: new Date(sale.createdAt).toLocaleString('en-IN'), align: 'l', dim: true });
  if (sale.salesman) {
    push({ k: 'line', text: `${t(lang, 'sell.salesman')}: ${sale.salesman}`, align: 'l', dim: true });
  }
  push({ k: 'hr' });

  for (const i of sale.items) {
    const dtag =
      i.discount > 0
        ? ` (-${i.discountPct > 0 ? i.discountPct + '%' : rupee(i.discount)})`
        : '';
    push({ k: 'row', left: i.name + dtag, right: rupee(saleLineTotal(i)) });
    push({
      k: 'line',
      text: `  ${i.qty} ${unitLabel(lang, i.unit)} × ${rupee(i.unitPrice)}`,
      align: 'l',
      dim: true,
      size: 12,
    });
  }
  if (sale.items.length) push({ k: 'hr' });

  if (sale.discount > 0) {
    push({
      k: 'row',
      left: t(lang, 'sell.subtotal'),
      right: rupee(sale.total - (sale.roundoff ?? 0) + sale.discount),
    });
    push({ k: 'row', left: t(lang, 'sell.discount'), right: '-' + rupee(sale.discount) });
  }
  for (const r of sale.taxBreakup ?? []) {
    push({
      k: 'row',
      left: `GST ${r.rate}% (${rupee(r.taxable)})`,
      right: rupee(r.cgst + r.sgst),
      dim: true,
      size: 12,
    });
  }
  if (sale.roundoff) {
    push({
      k: 'row',
      left: t(lang, 'sell.roundoff'),
      right: (sale.roundoff > 0 ? '+' : '-') + rupee(Math.abs(sale.roundoff)),
      dim: true,
      size: 12,
    });
  }
  push({ k: 'row', left: t(lang, 'sell.total'), right: rupee(sale.total), bold: true, size: 17 });

  const tender = t(lang, `sell.tender.${sale.tenderType}`);
  const split =
    sale.tenderType === 'split'
      ? ` (${t(lang, 'sell.tender.cash')} ${rupee(sale.cashAmount)}` +
        (sale.upiAmount ? ` · UPI ${rupee(sale.upiAmount)}` : '') +
        (sale.cardAmount ? ` · ${t(lang, 'sell.tender.card')} ${rupee(sale.cardAmount)}` : '') +
        ')'
      : '';
  push({ k: 'gap', h: 4 });
  push({ k: 'line', text: `${t(lang, 'sell.paid')}: ${tender}${split}`, align: 'l', dim: true });
  if (receipt.footer) {
    push({ k: 'gap', h: 8 });
    push({ k: 'line', text: receipt.footer, align: 'c' });
  }
  return ops;
}

/** A PNG blob of the receipt, sized for the configured paper width. */
export async function receiptPng(sale: Sale, opts: Opts): Promise<Blob | null> {
  const scale = 2;
  const W = opts.receipt.paper === 80 ? 576 : 384; // ~ dots on a thermal head
  const PAD = 16;
  const BASE = 13.5;

  const cv = document.createElement('canvas');
  cv.width = W * scale;
  cv.height = 4000 * scale;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, 4000);
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';

  const font = (size: number, bold?: boolean) =>
    `${bold ? '700 ' : ''}${size}px -apple-system, "Segoe UI", Roboto, "Noto Sans Tamil", sans-serif`;

  const wrap = (text: string, size: number, bold: boolean, maxW: number): string[] => {
    ctx.font = font(size, bold);
    if (ctx.measureText(text).width <= maxW) return [text];
    const words = text.split(' ');
    const out: string[] = [];
    let cur = '';
    for (const w of words) {
      const trial = cur ? cur + ' ' + w : w;
      if (ctx.measureText(trial).width <= maxW || !cur) cur = trial;
      else {
        out.push(cur);
        cur = w;
      }
    }
    if (cur) out.push(cur);
    return out;
  };

  let y = PAD;
  for (const op of build(sale, opts)) {
    if (op.k === 'gap') {
      y += op.h;
      continue;
    }
    if (op.k === 'hr') {
      ctx.save();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(PAD, y + 4);
      ctx.lineTo(W - PAD, y + 4);
      ctx.stroke();
      ctx.restore();
      y += 12;
      continue;
    }
    const size = op.size ?? BASE;
    const bold = !!op.bold;
    ctx.fillStyle = op.dim ? '#333333' : '#000000';
    if (op.k === 'line') {
      for (const ln of wrap(op.text, size, bold, W - PAD * 2)) {
        ctx.font = font(size, bold);
        ctx.textAlign = op.align === 'c' ? 'center' : 'left';
        ctx.fillText(ln, op.align === 'c' ? W / 2 : PAD, y);
        y += size + 4;
      }
    } else {
      ctx.font = font(size, bold);
      ctx.textAlign = 'right';
      const rightW = ctx.measureText(op.right).width;
      ctx.fillText(op.right, W - PAD, y);
      ctx.textAlign = 'left';
      const leftMax = W - PAD * 2 - rightW - 8;
      const lines = wrap(op.left, size, bold, leftMax);
      lines.forEach((ln, idx) => {
        ctx.fillText(ln, PAD, y + idx * (size + 4));
      });
      y += lines.length * (size + 4);
    }
  }
  y += PAD;

  const out = document.createElement('canvas');
  out.width = W * scale;
  out.height = Math.ceil(y) * scale;
  const octx = out.getContext('2d');
  if (!octx) return null;
  octx.drawImage(cv, 0, 0);

  return new Promise((res) => out.toBlob((b) => res(b), 'image/png'));
}

export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported' | 'error';

/** Render the receipt and open the OS share sheet with it as a PNG. `text`
 *  (e.g. a "pay by UPI" line) rides in the message body alongside the image. */
export async function shareReceiptImage(
  sale: Sale,
  opts: Opts,
  text?: string,
): Promise<ShareOutcome> {
  let blob: Blob | null;
  try {
    blob = await receiptPng(sale, opts);
  } catch {
    return 'error';
  }
  if (!blob) return 'error';

  const file = new File(
    [blob],
    `${sale.billNo.replace(/[^\w-]+/g, '-')}.png`,
    { type: 'image/png' },
  );
  const payload: { files: File[]; title: string; text?: string } = {
    files: [file],
    title: sale.billNo,
  };
  if (text && text.trim()) payload.text = text.trim();

  const nav = navigator as Navigator & {
    canShare?: (d: { files?: File[] }) => boolean;
  };
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share(payload);
      return 'shared';
    } catch (e) {
      return String((e as Error)?.name) === 'AbortError' ? 'cancelled' : 'error';
    }
  }
  return 'unsupported';
}
