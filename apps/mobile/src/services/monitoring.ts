/**
 * Crash/error reporting adapter.
 *
 * Sentry activates when EXPO_PUBLIC_SENTRY_DSN is set AND @sentry/react-native
 * is installed (EAS dev/production builds — the native module is loaded
 * lazily so Expo Go never crashes). Without it, errors go to the console so
 * nothing is silently swallowed.
 *
 * Wiring Sentry for production:
 *   npx expo install @sentry/react-native
 *   add "@sentry/react-native/expo" to app.json plugins
 *   set EXPO_PUBLIC_SENTRY_DSN in EAS env
 */

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

type SentryLike = {
  init: (options: { dsn: string; tracesSampleRate?: number }) => void;
  captureException: (error: unknown) => void;
  captureMessage: (message: string) => void;
};

let sentry: SentryLike | null | undefined;

function loadSentry(): SentryLike | null {
  if (sentry !== undefined) return sentry;
  if (!dsn) {
    sentry = null;
    return sentry;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sentry = require("@sentry/react-native") as SentryLike;
    sentry.init({ dsn, tracesSampleRate: 0.1 });
  } catch {
    sentry = null;
  }
  return sentry;
}

export function captureError(error: unknown, context?: string): void {
  const client = loadSentry();
  if (client) {
    client.captureException(error);
  } else {
    console.error(`[monitoring]${context ? ` ${context}:` : ""}`, error);
  }
}

export function captureMessage(message: string): void {
  const client = loadSentry();
  if (client) {
    client.captureMessage(message);
  } else {
    console.warn(`[monitoring] ${message}`);
  }
}
