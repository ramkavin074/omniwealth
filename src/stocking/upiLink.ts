// UPI collect links — the zero-cost way to ask a customer to pay.
//
// `upi://pay?pa=<vpa>&pn=<name>&am=<amount>&tn=<note>` is an NPCI-standard
// intent URL. When it lands in a WhatsApp message and the customer taps it,
// Android hands it to whichever UPI app they have (GPay / PhonePe / Paytm…)
// pre-filled with the shop's VPA + amount. No gateway, no fee, no SDK.
//
// There is no payment callback with this approach — the owner still marks the
// khata entry received by hand once the money shows in their bank app.

/** A VPA looks like `name@bank`. Loose check — just enough to skip junk. */
export function isLikelyVpa(s: string): boolean {
  return /^[a-z0-9.\-_]{2,}@[a-z]{2,}$/i.test(s.trim());
}

export function cleanVpa(raw: string): string {
  return (raw || '').trim().replace(/\s+/g, '').toLowerCase();
}

export interface UpiLinkParts {
  pa: string; // payee VPA (the shop's UPI ID)
  pn?: string; // payee name (shop name)
  am?: number; // amount in rupees
  tn?: string; // transaction note (bill no / "khata")
}

/** Build a `upi://pay?…` URL. Returns '' if the VPA is missing/malformed. */
export function buildUpiLink({ pa, pn, am, tn }: UpiLinkParts): string {
  const vpa = cleanVpa(pa);
  if (!isLikelyVpa(vpa)) return '';
  const p = new URLSearchParams({ pa: vpa, cu: 'INR' });
  if (pn) p.set('pn', pn.trim());
  if (typeof am === 'number' && am > 0) p.set('am', am.toFixed(2));
  if (tn) p.set('tn', tn.trim().slice(0, 50));
  return `upi://pay?${p.toString()}`;
}

/** The line to append to a WhatsApp message so the recipient can pay. */
export function upiPayLine(
  parts: UpiLinkParts,
  label = 'Pay by UPI',
): string {
  const link = buildUpiLink(parts);
  return link ? `\n${label}: ${link}` : '';
}
