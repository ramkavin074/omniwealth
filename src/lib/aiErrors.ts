// Turns raw provider failures into messages people can act on. Shared by every
// AI server action so "busy" and "bad key" read the same everywhere.

export const SHARED_BUSY_MESSAGE =
  "OmniWealth's shared AI is busy right now. Try again in a minute, or add your own key in Settings → AI key for unlimited use.";
export const OWN_KEY_BUSY_MESSAGE =
  'Your AI provider is busy or out of quota. Try again in a moment, or check your usage with that provider.';
export const OWN_KEY_REJECTED_MESSAGE =
  'Your AI provider rejected the saved key. Check it in Settings → AI key.';

const text = (err: unknown) => {
  const e = err as { status?: unknown; code?: unknown; message?: unknown } | null;
  return `${e?.status ?? ''} ${e?.code ?? ''} ${e?.message ?? ''}`;
};

/** Rate-limit / quota / overload (HTTP 429, 503, RESOURCE_EXHAUSTED...). */
export function isBusyError(err: unknown): boolean {
  return /\b429\b|\b503\b|RESOURCE_EXHAUSTED|UNAVAILABLE|quota|overloaded|rate.?limit/i.test(text(err));
}

/** Bad / revoked key (HTTP 401/403, API_KEY_INVALID...). */
export function isKeyRejectedError(err: unknown): boolean {
  return /\b401\b|\b403\b|API_KEY_INVALID|API key not valid|PERMISSION_DENIED|UNAUTHENTICATED/i.test(text(err));
}

export function friendlyAiError(err: unknown, usingOwnKey: boolean, fallback: string): string {
  if (isBusyError(err)) return usingOwnKey ? OWN_KEY_BUSY_MESSAGE : SHARED_BUSY_MESSAGE;
  if (isKeyRejectedError(err)) {
    return usingOwnKey
      ? OWN_KEY_REJECTED_MESSAGE
      : 'The shared AI is unavailable right now. Please try again later, or add your own key in Settings → AI key.';
  }
  return fallback;
}
