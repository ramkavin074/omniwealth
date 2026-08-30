import * as Sentry from '@sentry/nextjs';

/**
 * Report a handled error. Unhandled errors in server actions / route
 * handlers are captured automatically via instrumentation's onRequestError;
 * use this in catch blocks that swallow the error and return a result.
 */
export function logError(context: string, err: unknown, extra?: Record<string, unknown>) {
  console.error(`[${context}]`, err);
  Sentry.captureException(err, { tags: { context }, extra });
}
