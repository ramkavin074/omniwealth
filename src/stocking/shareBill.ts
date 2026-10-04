// Share a bill over WhatsApp (or any app): the receipt as an image where the
// platform can, with the plain-text bill as the fallback. Used by the
// post-sale screen and by the Sales list (re-send an old bill).

import { t, unitLabel, type Lang } from './i18n';
import { saleLineTotal, type GstConfig, type Sale } from './types';
import { getReceiptConfig } from './settings';
import { shareReceiptImage } from './receiptImage';
import { upiPayLine } from './upiLink';

const q2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const money = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

/** A "pay by UPI" line, only when money is still owed on this bill. */
export function upiTail(s: Sale, lang: Lang): string {
  const rc = getReceiptConfig();
  const owed = q2(s.total - s.cashAmount - s.upiAmount - (s.cardAmount ?? 0));
  if (owed <= 0 || !rc.upiId) return '';
  return upiPayLine(
    { pa: rc.upiId, pn: rc.shopName || undefined, am: owed, tn: s.billNo },
    t(lang, 'upi.payBy'),
  );
}

/** The bill as plain text (the fallback when an image can't be shared). */
export function billText(s: Sale, lang: Lang, gst: Pick<GstConfig, 'gstin'>): string {
  return (
    [
      s.billNo,
      new Date(s.createdAt).toLocaleString('en-IN'),
      ...(gst.gstin ? [`GSTIN: ${gst.gstin}`] : []),
      ...s.items.map(
        (i) =>
          `${i.name}  ${i.qty} ${unitLabel(lang, i.unit)} x ${i.unitPrice}` +
          (i.discount > 0 ? ` (-${i.discountPct > 0 ? i.discountPct + '%' : i.discount})` : '') +
          ` = ${saleLineTotal(i)}`,
      ),
      ...(s.discount > 0 ? [`${t(lang, 'sell.discount')}: -${s.discount}`] : []),
      ...s.taxBreakup.map((r) => `GST ${r.rate}%  CGST ${r.cgst} + SGST ${r.sgst}`),
      ...(s.roundoff ? [`${t(lang, 'sell.roundoff')}: ${s.roundoff > 0 ? '+' : ''}${s.roundoff}`] : []),
      `${t(lang, 'sell.total')}: ${money(s.total)}`,
      `${t(lang, 'sell.paid')}: ${t(lang, `sell.tender.${s.tenderType}`)}`,
      ...(s.salesman ? [`${t(lang, 'sell.salesman')}: ${s.salesman}`] : []),
    ].join('\n') + upiTail(s, lang)
  );
}

/**
 * Open the share sheet with the bill image; if the device can't share images,
 * fall back to a WhatsApp message with the bill as text.
 */
export async function sendBill(sale: Sale, lang: Lang, gst: GstConfig): Promise<void> {
  const r = await shareReceiptImage(sale, { lang, gst, receipt: getReceiptConfig() }, upiTail(sale, lang));
  if (r === 'unsupported' || r === 'error') {
    window.open(`https://wa.me/?text=${encodeURIComponent(billText(sale, lang, gst))}`, '_blank');
  }
}
