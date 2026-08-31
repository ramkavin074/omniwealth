/**
 * Report a handled error. Use this in catch blocks that swallow the
 * error and return a result to the caller, so there's still a server-side
 * record of what went wrong.
 *
 * (Was wired to Sentry; that SDK's server instrumentation is incompatible
 * with the current Next/Turbopack build, so this is console-only for now.)
 */
export function logError(context: string, err: unknown, extra?: Record<string, unknown>) {
  if (extra && Object.keys(extra).length > 0) {
    console.error(`[${context}]`, err, extra);
  } else {
    console.error(`[${context}]`, err);
  }
}
