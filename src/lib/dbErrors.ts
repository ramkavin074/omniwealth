// Helpers for turning database failures into safe, useful behaviour.

/**
 * The Postgres error code (e.g. '23505' unique violation), looking through the
 * error's `.cause` chain: Drizzle wraps the driver error in a "Failed query"
 * error, so the code is usually on the cause, not on the error itself.
 */
export function pgCode(error: unknown): string | undefined {
  let e: unknown = error;
  for (let i = 0; i < 4 && typeof e === 'object' && e !== null; i++) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}

/**
 * The message to show a person after a failed action. Errors we threw on
 * purpose carry a friendly message and pass through; database errors (whose
 * text includes the SQL and its parameters, even a password hash) are replaced
 * by `fallback` and stay in the server logs.
 */
export function safeMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  if (pgCode(error) || /^Failed query:/i.test(error.message) || /\bparams:/i.test(error.message)) {
    return fallback;
  }
  return error.message;
}
