// Voice item entry (EXPERIMENTAL). Speak a shopping list; it fills the cart.
//
//  Recogniser:
//   - Native: @capacitor-community/speech-recognition (Android on-device /
//     Google). Dynamically imported, only touched on a device.
//   - Web: the browser SpeechRecognition API when present (Chrome).
//   - Neither → the mic button hides itself.
//
//  Matching the transcript to products:
//   - Online: resolveItemsAI() asks the server (Gemini) to match the spoken
//     list against the store's catalogue — handles Tamil / Tanglish / short
//     names / mis-hearings.
//   - Offline: parseSpokenItems() (rule-based) + the caller's own fuzzy pick.
//
// Tamil recognition accuracy is still UNPROVEN — field-test before leaning
// on it. Nothing is auto-billed; the cart is the review step.

import { API_BASE } from './config';

type SpeechMod = typeof import('@capacitor-community/speech-recognition');

function isNative(): boolean {
  try {
    const cap = (
      globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }
    ).Capacitor;
    return !!cap?.isNativePlatform?.();
  } catch {
    return false;
  }
}

interface WebSR {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((e: {
    results: ArrayLike<ArrayLike<{ transcript: string }>>;
  }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}
function webCtor(): (new () => WebSR) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => WebSR;
    webkitSpeechRecognition?: new () => WebSR;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export async function isVoiceAvailable(): Promise<boolean> {
  if (isNative()) {
    try {
      const m = await import('@capacitor-community/speech-recognition');
      return (await m.SpeechRecognition.available()).available;
    } catch {
      return false;
    }
  }
  return webCtor() !== null;
}

export type VoiceResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'permission' | 'unsupported' | 'no-speech' | 'error' };

// ---- AI resolution: transcript -> catalogue rows (online) ------------------

export interface ResolvedItem {
  productId: string;
  name: string;
  qty: number;
}
export interface ResolvedItems {
  items: ResolvedItem[];
  unmatched: string[];
}

function auth(): { token?: string; storeId?: string } {
  try {
    const raw = localStorage.getItem('stocking.auth');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Ask the server (Gemini) to match a spoken list to this store's catalogue.
 *  Returns null on any failure — the caller falls back to the local parser. */
export async function resolveItemsAI(
  transcript: string,
): Promise<ResolvedItems | null> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
  try {
    const { token, storeId } = auth();
    const res = await fetch(`${API_BASE}/api/stocking/resolve-items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(storeId ? { 'x-store-id': storeId } : {}),
      },
      credentials: token ? 'omit' : 'include',
      body: JSON.stringify({ transcript }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<ResolvedItems>;
    if (!Array.isArray(data.items)) return null;
    return {
      items: data.items.filter(
        (i) => i && typeof i.productId === 'string' && Number(i.qty) > 0,
      ),
      unmatched: Array.isArray(data.unmatched) ? data.unmatched : [],
    };
  } catch {
    return null;
  }
}

// ---- parsing a spoken bill into {qty, name} lines (offline fallback) -------

export interface SpokenLine {
  qty: number;
  name: string;
}

const EN_NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, dozen: 12, half: 0.5,
  quarter: 0.25,
};
const TA_NUM: Record<string, number> = {
  'ஒரு': 1, 'ஒன்று': 1, 'இரண்டு': 2, 'ரெண்டு': 2, 'மூன்று': 3, 'நான்கு': 4,
  'ஐந்து': 5, 'ஆறு': 6, 'ஏழு': 7, 'எட்டு': 8, 'ஒன்பது': 9, 'பத்து': 10,
  'பதினொன்று': 11, 'பன்னிரண்டு': 12, 'டஜன்': 12, 'அரை': 0.5, 'கால்': 0.25,
  'முக்கால்': 0.75,
};
const UNIT_WORDS = new Set([
  'kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms', 'g', 'gram', 'grams',
  'litre', 'liter', 'litres', 'liters', 'l', 'ml',
  'packet', 'packets', 'pack', 'packs', 'piece', 'pieces', 'pcs', 'pc',
  'box', 'boxes', 'nos', 'no', 'unit', 'units', 'bottle', 'bottles',
  'கிலோ', 'கிராம்', 'லிட்டர்', 'மில்லி', 'பாக்கெட்', 'பாக்கெட்டு', 'பீஸ்',
  'டப்பா', 'நபர்', 'பாட்டில்',
]);
const NOISE = new Set(['of', 'a', 'an', 'x', 'the', 'please', 'add', 'give', 'and']);

function wordToNum(tk: string): number | null {
  if (/^\d+(\.\d+)?$/.test(tk)) {
    const n = Number(tk);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return EN_NUM[tk] ?? TA_NUM[tk] ?? null;
}

function parseFragment(frag: string): SpokenLine | null {
  const toks = frag.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!toks.length) return null;
  let qty = 1;
  let qtyIdx = -1;
  for (let i = 0; i < toks.length; i++) {
    const n = wordToNum(toks[i]);
    if (n != null) {
      qty = n;
      qtyIdx = i;
      break;
    }
  }
  const name = toks
    .filter((tk, i) => i !== qtyIdx && !UNIT_WORDS.has(tk) && !NOISE.has(tk))
    .join(' ')
    .trim();
  if (!name) return null;
  return { qty: qty > 0 ? qty : 1, name };
}

/** Break one spoken utterance into billable lines. "2 kg sugar and one
 *  colgate, 5 wedding cards" → [{2,sugar},{1,colgate},{5,wedding cards}].
 *  Leading OR trailing quantity, English + Tamil number words, unit words
 *  stripped. Returns [] when nothing parseable — caller falls back to search. */
export function parseSpokenItems(text: string): SpokenLine[] {
  return text
    .split(/\s*(?:,|&|\band\b|\bplus\b|மற்றும்|\n)\s*/i)
    .map(parseFragment)
    .filter((l): l is SpokenLine => l != null);
}

/** Listen for one short utterance and return the best transcript. `bcp47`
 *  is e.g. 'ta-IN' or 'en-IN'. */
export async function listenOnce(bcp47: string): Promise<VoiceResult> {
  return isNative() ? nativeListen(bcp47) : webListen(bcp47);
}

async function nativeListen(language: string): Promise<VoiceResult> {
  let mod: SpeechMod;
  try {
    mod = await import('@capacitor-community/speech-recognition');
  } catch {
    return { ok: false, reason: 'unsupported' };
  }
  const SR = mod.SpeechRecognition;
  try {
    const perm = await SR.checkPermissions();
    if (perm.speechRecognition !== 'granted') {
      const asked = await SR.requestPermissions();
      if (asked.speechRecognition !== 'granted') {
        return { ok: false, reason: 'permission' };
      }
    }
    const res = await SR.start({
      language,
      maxResults: 1,
      partialResults: false,
      popup: false,
    });
    const text = res.matches?.[0]?.trim();
    return text ? { ok: true, text } : { ok: false, reason: 'no-speech' };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

function webListen(lang: string): Promise<VoiceResult> {
  return new Promise((resolve) => {
    const Ctor = webCtor();
    if (!Ctor) return resolve({ ok: false, reason: 'unsupported' });
    const sr = new Ctor();
    sr.lang = lang;
    sr.interimResults = false;
    sr.maxAlternatives = 1;
    let done = false;
    const finish = (r: VoiceResult) => {
      if (done) return;
      done = true;
      try {
        sr.stop();
      } catch {
        /* ignore */
      }
      resolve(r);
    };
    sr.onresult = (e) => {
      const text = e.results?.[0]?.[0]?.transcript?.trim();
      finish(text ? { ok: true, text } : { ok: false, reason: 'no-speech' });
    };
    sr.onerror = (e) =>
      finish({
        ok: false,
        reason: e.error === 'not-allowed' ? 'permission' : 'error',
      });
    sr.onend = () => finish({ ok: false, reason: 'no-speech' });
    setTimeout(() => finish({ ok: false, reason: 'no-speech' }), 8000);
    try {
      sr.start();
    } catch {
      finish({ ok: false, reason: 'error' });
    }
  });
}
