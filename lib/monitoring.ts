import * as Sentry from '@sentry/react-native';
import { supabase } from './supabase';

// Crash and error reporting for the phone apps (Sentry). Does nothing unless
// EXPO_PUBLIC_SENTRY_DSN is set, and nothing in development, so local work and
// tests stay quiet. The web build has its own no-op copy (monitoring.web.ts):
// the server also renders the web app, and the native SDK is not for that.
//
// What is sent: the crash or error, the app version and the phone model. Who
// it happened to is an opaque account id, never a name, email or phone number
// (sendDefaultPii stays off), so a report can be matched to an account by us
// but reads as nothing to anyone else.

let started = false;

export function initMonitoring(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (started || !dsn || __DEV__) return;
  started = true;

  Sentry.init({
    dsn,
    environment: process.env.EXPO_PUBLIC_APP_ENV ?? 'production',
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    Sentry.setUser(session?.user ? { id: session.user.id } : null);
  });
}

export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!started) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export const wrapRootComponent = Sentry.wrap;
