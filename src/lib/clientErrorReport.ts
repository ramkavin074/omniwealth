// Browser-side helper: send a trimmed error report to /api/client-error.
// Deliberately conservative: de-duplicated, capped per page load, no query
// strings or page content, and it can never throw back into the app.

export type ClientErrorKind = 'error' | 'unhandledrejection' | 'route-error' | 'global-error';

const MAX_PER_LOAD = 5;
const sent = new Set<string>();
let appVersion: string | undefined;

export function setReportedAppVersion(v: string | undefined) {
  appVersion = v;
}

// Noise that says nothing about our code.
const IGNORE = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /Non-Error promise rejection captured/i,
  /chrome-extension:|moz-extension:|safari-extension:/i,
];

// Remove anything that could be a secret from URLs: "?query" and "#hash"
// (invite / join codes) and any long random-looking path segment (report-link
// tokens at /r/<token>, store ids, ...). Applied to the path, message and stack.
export const scrubUrlSecrets = (s: string) =>
  s
    .replace(/\?[^\s)]*/g, '')
    .replace(/#[^\s)]*/g, '')
    .replace(/\/[A-Za-z0-9_-]{20,}/g, '/:id');
const scrub = scrubUrlSecrets;

export function reportClientError(kind: ClientErrorKind, err: unknown, extra?: { digest?: string }): void {
  try {
    if (typeof window === 'undefined' || sent.size >= MAX_PER_LOAD) return;

    const e = err as { message?: unknown; stack?: unknown } | string | null | undefined;
    const message = scrub(String((typeof e === 'string' ? e : e?.message) ?? 'Unknown error')).slice(0, 300);
    const stackRaw = typeof e === 'object' && e && typeof e.stack === 'string' ? e.stack : '';
    const stack = scrub(stackRaw).slice(0, 1500);
    if (IGNORE.some((re) => re.test(message) || re.test(stack))) return;

    const sig = `${kind}|${message}|${stack.slice(0, 120)}`;
    if (sent.has(sig)) return;
    sent.add(sig);

    const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
    const platform = cap?.getPlatform?.() ?? 'web';
    const body = JSON.stringify({
      kind,
      message: extra?.digest ? `${message} [${extra.digest}]` : message,
      stack,
      path: scrubUrlSecrets(window.location.pathname),
      platform: platform === 'ios' || platform === 'android' ? platform : 'web',
      appVersion,
    });

    void fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'same-origin',
    }).catch(() => {});
  } catch {
    /* reporting must never break the app */
  }
}
