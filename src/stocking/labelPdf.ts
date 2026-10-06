// Labels as a PDF the phone can share or print. Android's WebView cannot open a print
// dialog, so on a phone the label sheet is drawn on a canvas, wrapped in a PDF and handed
// to the system share sheet (Print, Save, WhatsApp, a printer app...).

import { canEncode128, code128Modules } from '@/lib/code128';
import { buildPdf, type PdfPage } from '@/lib/pdf';
import { MAX_COPIES, type LabelItem, type LabelOptions } from './labels';

const MM_PER_PT = 25.4 / 72;
const rupee = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

interface Layout {
  pageMm: [number, number];
  dpi: number;
  cols: number;
  rows: number;
  cellMm: [number, number];
  originMm: [number, number];
  padMm: [number, number];
  barMm: number;
  namePt: number;
  pricePt: number;
  codePt: number;
  border: boolean;
}

function layoutFor(kind: LabelOptions['layout']): Layout {
  if (kind === 'roll') {
    return {
      pageMm: [50, 25], dpi: 300, cols: 1, rows: 1, cellMm: [50, 25], originMm: [0, 0],
      padMm: [2, 1.5], barMm: 8, namePt: 7, pricePt: 10, codePt: 5.5, border: false,
    };
  }
  const margin = 8;
  const cellW = (210 - margin * 2) / 3;
  const cellH = 36;
  return {
    pageMm: [210, 297], dpi: 200, cols: 3, rows: Math.floor((297 - margin * 2) / cellH),
    cellMm: [cellW, cellH], originMm: [margin, margin],
    padMm: [3, 2.5], barMm: 12, namePt: 9, pricePt: 14, codePt: 7, border: true,
  };
}

function priceFor(it: LabelItem, o: LabelOptions): number {
  if (o.price === 'none') return 0;
  return o.price === 'mrp' ? it.mrp || it.rate : it.rate || it.mrp;
}

/** Greedy word wrap into at most `maxLines`, ellipsising the last line. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= maxW || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length > 1 && ctx.measureText(last + '…').width > maxW) last = last.slice(0, -1);
    kept[maxLines - 1] = last + '…';
    return kept;
  }
  return lines;
}

function drawLabel(
  ctx: CanvasRenderingContext2D, L: Layout, it: LabelItem, o: LabelOptions,
  xPx: number, yPx: number,
) {
  const pxMm = L.dpi / 25.4;
  const ptPx = L.dpi / 72;
  const w = L.cellMm[0] * pxMm;
  const h = L.cellMm[1] * pxMm;
  const padX = L.padMm[0] * pxMm;
  const padY = L.padMm[1] * pxMm;
  const innerW = w - padX * 2;

  if (L.border) {
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = '#bbb';
    ctx.lineWidth = 1;
    ctx.strokeRect(xPx + 0.5, yPx + 0.5, w - 1, h - 1);
    ctx.restore();
  }

  ctx.fillStyle = '#000';
  ctx.textBaseline = 'top';
  let y = yPx + padY;

  ctx.font = `600 ${L.namePt * ptPx}px system-ui, sans-serif`;
  for (const line of wrap(ctx, it.name, innerW, 2)) {
    ctx.fillText(line, xPx + padX, y);
    y += L.namePt * ptPx * 1.2;
  }
  y += L.namePt * ptPx * 0.1;

  const price = priceFor(it, o);
  if (price > 0) {
    ctx.font = `800 ${L.pricePt * ptPx}px system-ui, sans-serif`;
    ctx.fillText(rupee(price), xPx + padX, y);
    y += L.pricePt * ptPx * 1.15;
  }

  // Bars: whole-pixel module width keeps the edges crisp; 10-module quiet zones each side.
  const modules = canEncode128(it.barcode) ? code128Modules(it.barcode) : '';
  const barH = L.barMm * pxMm;
  if (modules) {
    const mw = Math.max(1, Math.floor(innerW / (modules.length + 20)));
    const total = mw * (modules.length + 20);
    const x0 = xPx + padX + (innerW - total) / 2 + mw * 10;
    for (let i = 0; i < modules.length; ) {
      if (modules[i] === '1') {
        let j = i;
        while (j < modules.length && modules[j] === '1') j++;
        ctx.fillRect(x0 + i * mw, y, (j - i) * mw, barH);
        i = j;
      } else i++;
    }
  }
  y += barH + L.codePt * ptPx * 0.2;

  ctx.font = `${L.codePt * ptPx}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  const code = it.barcode + (o.shopName ? ` · ${o.shopName}` : '');
  ctx.fillText(code, xPx + w / 2, y, innerW);
  ctx.textAlign = 'left';
}

const canvasJpeg = (c: HTMLCanvasElement): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    c.toBlob(
      async (b) => (b ? resolve(new Uint8Array(await b.arrayBuffer())) : reject(new Error('no image'))),
      'image/jpeg',
      0.92,
    );
  });

/** Build the label document as a PDF (A4 sheets of 21, or one 50×25 mm page per label). */
export async function labelsPdf(items: LabelItem[], o: LabelOptions): Promise<Blob> {
  const L = layoutFor(o.layout);
  const flat: LabelItem[] = [];
  for (const it of items) {
    const n = Math.min(MAX_COPIES, Math.max(1, Math.floor(it.copies) || 1));
    for (let i = 0; i < n; i++) flat.push(it);
  }
  const perPage = L.cols * L.rows;
  const pxMm = L.dpi / 25.4;
  const widthPx = Math.round(L.pageMm[0] * pxMm);
  const heightPx = Math.round(L.pageMm[1] * pxMm);
  const pages: PdfPage[] = [];

  for (let start = 0; start < flat.length; start += perPage) {
    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, widthPx, heightPx);
    flat.slice(start, start + perPage).forEach((it, i) => {
      const col = i % L.cols;
      const row = Math.floor(i / L.cols);
      drawLabel(
        ctx, L, it, o,
        (L.originMm[0] + col * L.cellMm[0]) * pxMm,
        (L.originMm[1] + row * L.cellMm[1]) * pxMm,
      );
    });
    pages.push({
      widthPt: L.pageMm[0] / MM_PER_PT,
      heightPt: L.pageMm[1] / MM_PER_PT,
      jpeg: await canvasJpeg(canvas),
      widthPx,
      heightPx,
    });
  }
  const bytes = buildPdf(pages);
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => resolve(String(fr.result).split(',')[1] ?? '');
    fr.readAsDataURL(blob);
  });

export type LabelShareResult = 'shared' | 'cancelled' | 'unsupported' | 'error';

/** Hand the PDF to the system share sheet. 'unsupported' when not running as the native app. */
export async function shareLabelsPdf(pdf: Blob, title: string): Promise<LabelShareResult> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return 'unsupported';
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    const name = `labels-${Date.now()}.pdf`;
    await Filesystem.writeFile({ path: name, data: await blobToBase64(pdf), directory: Directory.Cache });
    const { uri } = await Filesystem.getUri({ path: name, directory: Directory.Cache });
    await Share.share({ title, files: [uri], dialogTitle: title });
    return 'shared';
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (/cancel|dismiss/i.test(msg)) return 'cancelled';
    if (/not implemented|unimplemented|not available/i.test(msg)) return 'unsupported';
    return 'error';
  }
}
