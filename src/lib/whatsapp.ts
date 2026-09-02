// Minimal WhatsApp sender for stocking reorder alerts. Uses the Meta
// WhatsApp Cloud API when configured; otherwise a no-op that logs, so the
// cron can ship before a channel is set up.
//
//   WHATSAPP_TOKEN      – Cloud API access token
//   WHATSAPP_PHONE_ID   – the sender phone-number id
//
// (A `wa.me/<phone>?text=` deep link — built client-side — covers the manual
// "send reorder" button and needs none of this.)

export function whatsappConfigured(): boolean {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
}

/** E.164-ish: strip non-digits, prepend country code 91 if it looks like a
 *  bare 10-digit Indian mobile. */
export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/\D/g, '');
  if (d.length === 10) return '91' + d;
  if (d.length === 12 && d.startsWith('91')) return d;
  if (d.length >= 11 && d.length <= 15) return d;
  return null;
}

export async function sendWhatsAppText(
  toPhone: string,
  body: string,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const to = normalizePhone(toPhone);
  if (!to) return { ok: false, error: 'bad phone' };
  if (!whatsappConfigured()) {
    console.info('[whatsapp] not configured — would send to', to, ':', body);
    return { ok: true, skipped: true };
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body },
        }),
      },
    );
    if (!res.ok) {
      return { ok: false, error: `wa ${res.status}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'wa threw' };
  }
}
