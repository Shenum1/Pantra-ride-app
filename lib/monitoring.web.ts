// Web copy of lib/monitoring.ts: reports nothing. The native Sentry SDK cannot run in the
// server render of the web app, and the API behind it reports its own failures (backend/lib/error-reporting.ts).

export function initMonitoring(): void {}

export function reportError(_error: unknown, _context?: Record<string, unknown>): void {}

export function wrapRootComponent<T>(component: T): T {
  return component;
}
