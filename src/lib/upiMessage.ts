// Parses pasted UPI payment messages (bank SMS, PhonePe / GPay / Paytm
// notifications) into "money received" rows. Pure and offline: the shopkeeper
// long-presses a message, copies it, pastes it here. We only ever read what
// they paste - no SMS permission involved.

export interface ParsedReceipt {
  amount: number;
  receivedAt: number;
  ref: string | null;
  payer: string | null;
}

export interface ParsedMessages {
  receipts: ParsedReceipt[];
  /** Messages that were found but are not money coming in (or had no amount). */
  skipped: number;
}

const AMOUNT_RE = /(?:₹|\brs\.?|\binr|ரூ\.?)\s*([\d,]+(?:\.\d{1,2})?)/i;
const AMOUNT_RE_G = /(?:₹|\brs\.?|\binr|ரூ\.?)\s*[\d,]+(?:\.\d{1,2})?/gi;

const POSITIVE_RE =
  /received|credited|\bcredit\b|paid you|sent you|deposited|வரவு|பெறப்பட்ட|பெற்றீர்கள்/i;
const NEGATIVE_RE =
  /debited|\bdebit\b|you paid|you sent|paid to|sent to|transferred to|withdrawn|spent|purchase|failed|declined|requested|request(?:s|ed)? ₹|collect request/i;

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

/** Splits pasted text into one chunk per message. */
export function splitMessages(text: string): string[] {
  const out: string[] = [];
  for (const block of text.split(/\n\s*\n/)) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;
    const withAmount = lines.filter((l) => AMOUNT_RE.test(l)).length;
    if (withAmount < 2) {
      out.push(lines.join(' '));
      continue;
    }
    // Several messages pasted back to back with no blank line: every line
    // holding an amount starts a new message; other lines belong to it.
    let cur: string[] = [];
    for (const l of lines) {
      if (AMOUNT_RE.test(l) && cur.some((c) => AMOUNT_RE.test(c))) {
        out.push(cur.join(' '));
        cur = [];
      }
      cur.push(l);
    }
    if (cur.length) out.push(cur.join(' '));
  }
  return out;
}

function parseAmount(msg: string): number | null {
  const m = msg.match(AMOUNT_RE);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  return n > 0 && Number.isFinite(n) ? n : null;
}

function parseRef(msg: string): string | null {
  const labelled = msg.match(
    /(?:\bref(?:erence)?(?:\s*(?:no|number|id))?|\butr|\btxn\s*id|\btransaction\s*id|\bupi\s*id)\.?\s*[:#\-]?\s*(\d{9,18})\b/i,
  );
  if (labelled) return labelled[1];
  const upiPath = msg.match(/UPI\/(?:P2[AMP]\/)?(\d{9,18})\b/i);
  if (upiPath) return upiPath[1];
  const bare = msg.match(/\b(\d{12})\b/);
  return bare ? bare[1] : null;
}

function cleanName(raw: string): string | null {
  const name = raw
    .replace(/\s+/g, ' ')
    .replace(/[\s.,;:\-]+$/, '')
    .trim();
  if (name.length < 2 || name.length > 40) return null;
  if (/^(upi|bank|a\/c|account|your|you|ref|imps|neft)\b/i.test(name)) return null;
  return name;
}

function parsePayer(msg: string): string | null {
  // "UPI/P2A/123456789012/RAVI KUMAR" (bank SMS)
  const path = msg.match(/UPI\/(?:P2[AMP]\/)?\d{9,18}\/([A-Za-z][A-Za-z ]{1,30})/i);
  if (path) return cleanName(path[1]);
  // "Ravi Kumar paid you ₹250" / "Ravi sent you Rs 250"
  const lead = msg.match(/^(?:[^A-Za-z]*)([A-Za-z][A-Za-z .'\-]{1,38}?)\s+(?:paid|sent) you\b/i);
  if (lead) return cleanName(lead[1]);
  // "received ₹250 from Ravi Kumar" / "credited ... from ravi@okaxis"
  const from = msg.match(
    /\bfrom\s+([A-Za-z0-9][A-Za-z0-9 .'\-@_]{1,40}?)(?=\s*(?:\(|\bon\b|\bvia\b|\bto\b|\bin\b|\bUPI\b|\bref\b|\butr\b|\bat\b|\bhas\b|\bis\b|[,;]|\.\s|\.$|$|₹|\brs\b))/i,
  );
  if (from) return cleanName(from[1]);
  const by = msg.match(/\bby\s+([A-Z][A-Za-z .]{2,30}?)(?=\s*(?:\bon\b|\bref\b|[,;]|\.\s|\.$|$))/);
  if (by) return cleanName(by[1]);
  return null;
}

function parseWhen(msg: string, now: number): number {
  const nowD = new Date(now);
  let y = nowD.getFullYear();
  let mo = nowD.getMonth();
  let d = nowD.getDate();
  let hasDate = false;

  const num = msg.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/);
  const named =
    msg.match(/\b(\d{1,2})[-/ ]([A-Za-z]{3,9})[-/, ]+\s*(\d{2}|\d{4})\b/) ||
    null;
  if (num && Number(num[2]) <= 12 && Number(num[1]) <= 31) {
    d = Number(num[1]);
    mo = Number(num[2]) - 1;
    y = Number(num[3]);
    hasDate = true;
  } else if (named && MONTHS[named[2].toLowerCase().slice(0, 4)] !== undefined) {
    const key = named[2].toLowerCase();
    const idx = MONTHS[key] ?? MONTHS[key.slice(0, 3)];
    if (idx !== undefined) {
      d = Number(named[1]);
      mo = idx;
      y = Number(named[3]);
      hasDate = true;
    }
  }
  if (y < 100) y += 2000;

  const tm = msg.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
  let hh = -1;
  let mm = 0;
  if (tm) {
    hh = Number(tm[1]);
    mm = Number(tm[2]);
    const ap = tm[4]?.toLowerCase();
    if (ap === 'pm' && hh < 12) hh += 12;
    if (ap === 'am' && hh === 12) hh = 0;
    if (hh > 23 || mm > 59) hh = -1;
  }

  const sameDay =
    !hasDate || (y === nowD.getFullYear() && mo === nowD.getMonth() && d === nowD.getDate());
  if (hh < 0) {
    // No clock time: "now" for today's message, midday for an earlier date.
    return sameDay ? now : new Date(y, mo, d, 12, 0, 0).getTime();
  }
  let ts = new Date(y, mo, d, hh, mm, 0).getTime();
  // A time with no date that lands in the future means yesterday's message.
  if (!hasDate && ts > now + 5 * 60_000) ts -= 86_400_000;
  return ts;
}

export function parseUpiMessages(text: string, now: number = Date.now()): ParsedMessages {
  const receipts: ParsedReceipt[] = [];
  let skipped = 0;
  for (const msg of splitMessages(text)) {
    if (!(msg.match(AMOUNT_RE_G)?.length)) {
      // Not a payment message at all (a stray line): ignore, don't count.
      continue;
    }
    const amount = parseAmount(msg);
    const isIn =
      POSITIVE_RE.test(msg) &&
      !/debited|you paid|you sent|paid to|sent to|transferred to|withdrawn|spent|failed|declined/i.test(msg);
    if (!amount || !isIn || (NEGATIVE_RE.test(msg) && !POSITIVE_RE.test(msg))) {
      skipped++;
      continue;
    }
    receipts.push({
      amount,
      receivedAt: parseWhen(msg, now),
      ref: parseRef(msg),
      payer: parsePayer(msg),
    });
  }
  return { receipts, skipped };
}
