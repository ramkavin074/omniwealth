import { Resend } from 'resend';

// Transactional email via Resend, sending as the domain mailbox the user
// owns (admin@omniwealth.org) rather than raw SMTP through that mailbox —
// Resend is built for automated/app-initiated sends (proper SPF/DKIM once
// omniwealth.org is verified in the Resend dashboard, bounce handling,
// delivery status), so the real Zoho inbox stays reserved for human mail.

let client: Resend | null = null;

function getClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured.');
  }
  if (!client) client = new Resend(apiKey);
  return client;
}

export const MAIL_FROM =
  process.env.RESEND_FROM_EMAIL || 'OmniWealth <admin@omniwealth.org>';

/** Send one email through Resend. Throws if unconfigured or delivery fails —
 *  callers already wrap sends in try/catch to clean up on failure. */
export async function sendMail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}): Promise<void> {
  const { error } = await getClient().emails.send({
    from: opts.from ?? MAIL_FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
  if (error) throw error;
}
