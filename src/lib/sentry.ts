import * as Sentry from '@sentry/react';

// Keys / fields that should NEVER reach Sentry.
const REDACT_KEY_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /api[_-]?key/i,
  /service[_-]?role/i,
  /authorization/i,
  /cookie/i,
  /payment[_-]?key/i,
  /paymentkey/i,
  /card[_-]?number/i,
  /\bcvc\b/i,
  /\bcvv\b/i,
  /\bemail\b/i,
  /\bphone\b/i,
  /\baddress\b/i,
  /\bbirth/i,
  /review_text/i,
  /inquiry_text/i,
  /original_text/i,
  /original_review/i,
  /\bcontent\b/i,
  /\bmessage\b/i,
  /\bbody\b/i,
];

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
const LONG_TOKEN_RE = /\b[A-Za-z0-9_-]{32,}\b/g;
const PHONE_RE = /\b01[016789][\s-]?\d{3,4}[\s-]?\d{4}\b/g;

const REDACTED = '[REDACTED]';

function maskString(input: string): string {
  if (typeof input !== 'string') return input;
  let out = input;
  out = out.replace(JWT_RE, REDACTED);
  out = out.replace(EMAIL_RE, REDACTED);
  out = out.replace(PHONE_RE, REDACTED);
  // Mask long opaque tokens last (after JWT)
  out = out.replace(LONG_TOKEN_RE, (m) => (m.length >= 32 ? REDACTED : m));
  return out;
}

function shouldRedactKey(key: string): boolean {
  return REDACT_KEY_PATTERNS.some((re) => re.test(key));
}

function deepRedact(value: unknown, depth = 0): unknown {
  if (value == null || depth > 6) return value;
  if (typeof value === 'string') return maskString(value);
  if (Array.isArray(value)) return value.map((v) => deepRedact(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (shouldRedactKey(k)) {
        out[k] = REDACTED;
      } else {
        out[k] = deepRedact(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

function scrubUrl(url?: string): string | undefined {
  if (!url) return url;
  try {
    const u = new URL(url, 'http://x');
    const SENSITIVE_QS = [
      'access_token', 'refresh_token', 'paymentKey', 'orderId',
      'code', 'state', 'token', 'secret', 'key',
    ];
    SENSITIVE_QS.forEach((q) => {
      if (u.searchParams.has(q)) u.searchParams.set(q, REDACTED);
    });
    return u.pathname + (u.search || '') + (u.hash || '');
  } catch {
    return url;
  }
}

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!import.meta.env.PROD || !dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    replaysSessionSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event) {
      try {
        // Strip identifying user info
        if (event.user) {
          delete event.user.email;
          delete event.user.ip_address;
          delete (event.user as Record<string, unknown>).username;
        }

        // Scrub request
        if (event.request) {
          if (event.request.headers) {
            const safeHeaders: Record<string, string> = {};
            for (const [k, v] of Object.entries(event.request.headers)) {
              if (shouldRedactKey(k) || /apikey|x-supabase/i.test(k)) continue;
              safeHeaders[k] = typeof v === 'string' ? maskString(v) : String(v);
            }
            event.request.headers = safeHeaders;
          }
          delete (event.request as Record<string, unknown>).cookies;
          event.request.url = scrubUrl(event.request.url);
          if (event.request.data) {
            event.request.data = deepRedact(event.request.data);
          }
          if (event.request.query_string) {
            event.request.query_string = maskString(
              typeof event.request.query_string === 'string'
                ? event.request.query_string
                : JSON.stringify(event.request.query_string),
            );
          }
        }

        // Scrub extras / contexts / tags
        if (event.extra) event.extra = deepRedact(event.extra) as Record<string, unknown>;
        if (event.contexts) event.contexts = deepRedact(event.contexts) as typeof event.contexts;
        if (event.tags) event.tags = deepRedact(event.tags) as typeof event.tags;

        // Scrub breadcrumbs
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map((b) => ({
            ...b,
            message: b.message ? maskString(b.message) : b.message,
            data: b.data ? (deepRedact(b.data) as Record<string, unknown>) : b.data,
          }));
        }

        // Scrub message + exception values
        if (event.message) event.message = maskString(event.message);
        if (event.exception?.values) {
          event.exception.values = event.exception.values.map((ex) => ({
            ...ex,
            value: ex.value ? maskString(ex.value) : ex.value,
          }));
        }
      } catch {
        // If scrubbing fails, drop the event to be safe.
        return null;
      }
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      // Drop console.debug noise
      if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') return null;
      // Scrub URLs in navigation/fetch/xhr breadcrumbs
      if (breadcrumb.data && typeof breadcrumb.data === 'object') {
        const data = breadcrumb.data as Record<string, unknown>;
        if (typeof data.url === 'string') data.url = scrubUrl(data.url);
        if (typeof data.to === 'string') data.to = scrubUrl(data.to);
        if (typeof data.from === 'string') data.from = scrubUrl(data.from);
      }
      return breadcrumb;
    },
  });
}

export { Sentry };
