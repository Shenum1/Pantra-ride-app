// Reports server failures to Sentry, so a break in production is seen by us
// before a rider reports it.
//
// Hand-rolled over fetch (Sentry's envelope endpoint) instead of @sentry/node:
// the server is bundled by Metro for Vercel, and @sentry/node's automatic
// instrumentation is not made for that. This sends one small event per
// failure and nothing else — no request bodies, headers or tokens — only the
// error, where it happened (the procedure path) and an opaque user id.
//
// Does nothing unless SENTRY_DSN is set, so local runs and tests stay quiet.

const pending = new Set<Promise<void>>();

type Dsn = { endpoint: string; key: string };

function parseDsn(dsn: string | undefined): Dsn | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, "");
    if (!url.username || !projectId) return null;
    return { endpoint: `${url.protocol}//${url.host}/api/${projectId}/envelope/`, key: url.username };
  } catch {
    return null;
  }
}

export type ReportContext = {
  /** Where it happened, e.g. the tRPC path "rides.create" or "GET /api/webhooks/flutterwave". */
  where?: string;
  userId?: string;
};

function buildEnvelope(error: unknown, context: ReportContext, dsnRaw: string): string {
  const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");
  const eventId = crypto.randomUUID().replace(/-/g, "");
  const now = new Date();
  const event = {
    event_id: eventId,
    timestamp: now.getTime() / 1000,
    platform: "node",
    level: "error",
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    server_name: "pantra-api",
    tags: context.where ? { where: context.where } : undefined,
    user: context.userId ? { id: context.userId } : undefined,
    exception: { values: [{ type: err.name || "Error", value: err.message }] },
    extra: { stack: err.stack?.split("\n").slice(0, 12).join("\n") },
  };
  return [
    JSON.stringify({ event_id: eventId, sent_at: now.toISOString(), dsn: dsnRaw }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");
}

/** Queue a report. Never throws and never blocks the caller; call `flushErrorReports` before the response ends. */
export function reportServerError(error: unknown, context: ReportContext = {}): void {
  const dsnRaw = process.env.SENTRY_DSN;
  const dsn = parseDsn(dsnRaw);
  if (!dsn || !dsnRaw) return;

  const send = (async () => {
    try {
      await fetch(`${dsn.endpoint}?sentry_key=${dsn.key}&sentry_version=7`, {
        method: "POST",
        headers: { "content-type": "application/x-sentry-envelope" },
        body: buildEnvelope(error, context, dsnRaw),
        signal: AbortSignal.timeout(2500),
      });
    } catch (e) {
      console.error("Could not send error report:", (e as Error).message);
    }
  })();

  pending.add(send);
  void send.finally(() => pending.delete(send));
}

/** A serverless function can be frozen the moment it responds, so wait for any queued reports first. */
export async function flushErrorReports(): Promise<void> {
  if (pending.size > 0) await Promise.allSettled([...pending]);
}
