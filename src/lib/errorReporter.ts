import { Sentry } from './sentry';

export type ReportContext = {
  feature: string;
  error_code?: string;
  input_length?: number;
  user_plan?: string;
  // Safe extras only — do NOT pass raw text, emails, payment keys, etc.
  [key: string]: unknown;
};

const SENTRY_ENABLED =
  typeof import.meta !== 'undefined' &&
  import.meta.env?.PROD === true &&
  !!import.meta.env?.VITE_SENTRY_DSN;

/**
 * Report an error for monitoring.
 *
 * NEVER pass review text, inquiry text, emails, phone numbers, payment keys,
 * or any other sensitive value in `ctx`. Pass length / category / error_code only.
 */
export function reportError(err: unknown, ctx: ReportContext): void {
  if (!import.meta.env.PROD) {
    // Dev: console.error only
    // eslint-disable-next-line no-console
    console.error('[reportError:dev]', ctx.feature, ctx.error_code ?? '', err);
    return;
  }
  if (!SENTRY_ENABLED) return;

  try {
    Sentry.withScope((scope) => {
      scope.setTag('feature', ctx.feature);
      if (ctx.error_code) scope.setTag('error_code', ctx.error_code);
      if (ctx.user_plan) scope.setTag('user_plan', ctx.user_plan);

      const safeContext: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(ctx)) {
        if (k === 'feature' || k === 'error_code' || k === 'user_plan') continue;
        safeContext[k] = v;
      }
      if (Object.keys(safeContext).length > 0) {
        scope.setContext('feature_context', safeContext);
      }

      if (err instanceof Error) {
        Sentry.captureException(err);
      } else {
        Sentry.captureMessage(
          typeof err === 'string' ? err : ctx.error_code ?? 'unknown_error',
          'error',
        );
      }
    });
  } catch {
    // Swallow — never let monitoring throw.
  }
}

/** Tag the current user (id only — no email/PII). */
export function setSentryUserId(userId: string | null): void {
  if (!SENTRY_ENABLED) return;
  try {
    if (userId) Sentry.setUser({ id: userId });
    else Sentry.setUser(null);
  } catch {
    /* noop */
  }
}
