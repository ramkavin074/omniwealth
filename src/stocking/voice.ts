// Voice item entry (EXPERIMENTAL). Speak an item name; it lands in the Sell
// search box and the normal search-to-add flow takes over.
//
//  - Native: @capacitor-community/speech-recognition (Android's on-device /
//    Google recogniser). Dynamically imported, only touched on a device.
//  - Web: the browser SpeechRecognition API when present (Chrome).
//  - Otherwise unavailable — the mic button hides itself.
//
// Tamil ('ta-IN') recognition of shop item names + numbers is UNPROVEN. Keep
// this behind the "is it available" check and field-test before leaning on it.

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
