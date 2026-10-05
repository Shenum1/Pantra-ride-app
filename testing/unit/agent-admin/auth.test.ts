import { describe, expect, it } from "vitest";
import { agentKeyMatches, getAgentSecret } from "@/backend/agent-admin/auth";
import { createAgentAdminRouter } from "@/backend/agent-admin/router";
import { createToolRegistry } from "@/backend/agent-admin/registry";
import { createFakeDb } from "./fake-db";

const SECRET = "a".repeat(40);

function routerWith(secret: string | null) {
  return createAgentAdminRouter({ db: createFakeDb().db, registry: createToolRegistry([]), getSecret: () => secret });
}

describe("agent key auth", () => {
  it("rejects a request with no key", async () => {
    const res = await routerWith(SECRET).request("/tools");
    expect(res.status).toBe(401);
  });

  it("rejects a wrong key", async () => {
    const res = await routerWith(SECRET).request("/tools", { headers: { "x-agent-key": "b".repeat(40) } });
    expect(res.status).toBe(401);
  });

  it("accepts the correct key", async () => {
    const res = await routerWith(SECRET).request("/tools", { headers: { "x-agent-key": SECRET } });
    expect(res.status).toBe(200);
  });

  it("does not accept the key as an Authorization bearer token", async () => {
    const res = await routerWith(SECRET).request("/tools", { headers: { authorization: `Bearer ${SECRET}` } });
    expect(res.status).toBe(401);
  });

  it("fails closed with 503 when the secret is not configured", async () => {
    const res = await routerWith(null).request("/tools", { headers: { "x-agent-key": "" } });
    expect(res.status).toBe(503);
  });

  it("treats an unset or short secret as unconfigured", () => {
    expect(getAgentSecret({})).toBeNull();
    expect(getAgentSecret({ AGENT_ADMIN_SECRET_KEY: "short-secret" })).toBeNull();
    expect(getAgentSecret({ AGENT_ADMIN_SECRET_KEY: SECRET })).toBe(SECRET);
  });

  it("is mounted on the real backend app at /v1/agent-admin and protected there", async () => {
    const { default: backendApp } = await import("@/backend/hono");
    const res = await backendApp.request("/v1/agent-admin/tools");
    // 503 if AGENT_ADMIN_SECRET_KEY is unset in this environment, 401 if set —
    // never 404 (unmounted) and never 200 (unprotected).
    expect([401, 503]).toContain(res.status);
  });

  it("compares keys of different lengths without throwing", () => {
    expect(agentKeyMatches("x", SECRET)).toBe(false);
    expect(agentKeyMatches(SECRET, SECRET)).toBe(true);
  });
});
