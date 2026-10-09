import { createHash, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MiddlewareHandler } from "hono";
import { AdminAuthError, bearerToken, verifyAdminToken } from "../lib/admin-auth";

export const AGENT_KEY_HEADER = "x-agent-key";
const MIN_SECRET_LENGTH = 32;

export function getAgentSecret(env: Record<string, string | undefined> = process.env): string | null {
  const secret = env.AGENT_ADMIN_SECRET_KEY;
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

// Hashing both sides first gives equal-length buffers (timingSafeEqual
// requires that) without leaking the secret's length through timing.
export function agentKeyMatches(provided: string, secret: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

export const AGENT_KEY_QUERY_PARAM = "key";

// allowQueryKey additionally accepts ?key=... — ONLY for the browser-openable
// read-only GET routes, where a browser can't set the header. A key in a URL
// ends up in history and server logs, so no write route ever uses this.
export function requireAgentKey(
  getSecret: () => string | null = () => getAgentSecret(),
  opts: { allowQueryKey?: boolean } = {}
): MiddlewareHandler {
  return async (c, next) => {
    const secret = getSecret();
    // Fail closed: an unset or too-short key disables the agent API entirely
    // rather than letting an empty/guessable key through.
    if (!secret) {
      return c.json({ error: "Agent admin API is not configured (AGENT_ADMIN_SECRET_KEY unset or shorter than 32 characters)." }, 503);
    }
    const provided = c.req.header(AGENT_KEY_HEADER) || (opts.allowQueryKey ? (c.req.query(AGENT_KEY_QUERY_PARAM) ?? "") : "");
    if (!provided || !agentKeyMatches(provided, secret)) {
      return c.json(
        { error: `Invalid or missing key. Send the ${AGENT_KEY_HEADER} header${opts.allowQueryKey ? ` or ?${AGENT_KEY_QUERY_PARAM}=` : ""}.` },
        401
      );
    }
    await next();
  };
}

export type VerifyAdmin = (token: string) => Promise<{ adminUserId: string }>;

export function defaultVerifyAdmin(db: SupabaseClient | null): VerifyAdmin {
  return (token) => verifyAdminToken(db, token);
}

// Approval must come from a real human admin. A request carrying the agent's
// key is refused outright — even alongside a valid admin session — so the
// agent can never approve its own actions.
export function requireAdminSession(verifyAdmin: VerifyAdmin): MiddlewareHandler<{ Variables: { adminUserId: string } }> {
  return async (c, next) => {
    if (c.req.header(AGENT_KEY_HEADER)) {
      return c.json({ error: "Actions cannot be resolved with the agent key. A human admin must approve or reject them." }, 403);
    }
    try {
      const { adminUserId } = await verifyAdmin(bearerToken(c.req.header("authorization")));
      c.set("adminUserId", adminUserId);
    } catch (e) {
      if (e instanceof AdminAuthError && (e.code === "NOT_CONFIGURED" || e.code === "ROLE_CHECK_FAILED")) {
        return c.json({ error: e.message }, 500);
      }
      return c.json({ error: (e as Error).message || "Unauthorized." }, 401);
    }
    await next();
  };
}
