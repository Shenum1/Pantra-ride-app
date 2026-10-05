import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createAgentAdminRouter } from "@/backend/agent-admin/router";
import { createToolRegistry } from "@/backend/agent-admin/registry";
import { defineReadTool, defineWriteTool } from "@/backend/agent-admin/types";
import { AdminAuthError } from "@/backend/lib/admin-auth";
import { createFakeDb } from "./fake-db";

const SECRET = "s".repeat(40);
const ADMIN_TOKEN = "admin-session-token";
const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const RATIONALE = "Rider reported the issue twice; replying to close the loop.";

function setup() {
  const { db, tables } = createFakeDb({ config: [{ id: "cfg", rate: 0.1 }] });

  const writeRun = vi.fn(async (_db: unknown, input: { rate: number }, _actorAdminId: string) => ({ applied: input.rate }));
  const readRun = vi.fn(async () => ({ hello: "world" }));

  const setRate = defineWriteTool({
    name: "set_rate",
    description: "Test write tool that sets a rate on the single config row, guarded by a snapshot of the current value.",
    inputSchema: z.object({ rate: z.number().min(0).max(1).describe("New rate as a decimal fraction.") }),
    summarize: (input) => `Set rate to ${input.rate}`,
    snapshot: async (fakeDb: any) => {
      const { data } = await fakeDb.from("config").select("*").eq("id", "cfg").single();
      return { rate: data.rate };
    },
    run: writeRun as any,
  });

  const readTool = defineReadTool({
    name: "read_thing",
    description: "Test read tool that returns a fixed object immediately without any approval being involved.",
    inputSchema: z.object({}),
    run: readRun as any,
  });

  const verifyAdmin = vi.fn(async (token: string) => {
    if (token === ADMIN_TOKEN) return { adminUserId: ADMIN_ID };
    throw new AdminAuthError("NOT_ADMIN", "This account does not have admin access.");
  });

  const router = createAgentAdminRouter({
    db,
    registry: createToolRegistry([setRate, readTool]),
    getSecret: () => SECRET,
    verifyAdmin,
  });

  const agent = (path: string, body?: unknown) =>
    router.request(path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "x-agent-key": SECRET, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  const resolve = (id: string, decision: "APPROVED" | "REJECTED", headers: Record<string, string> = { authorization: `Bearer ${ADMIN_TOKEN}` }) =>
    router.request(`/actions/${id}/resolve`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ decision }),
    });

  const queue = async (rate = 0.12) => {
    const res = await agent("/tools/set_rate", { rate, rationale: RATIONALE });
    expect(res.status).toBe(202);
    return ((await res.json()) as { actionId: string }).actionId;
  };

  return { tables, writeRun, readRun, agent, resolve, queue };
}

describe("agent-admin HITL", () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => {
    t = setup();
  });

  it("runs read tools immediately", async () => {
    const res = await t.agent("/tools/read_thing", {});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { hello: "world" } });
  });

  it("queues write tools as PENDING with a 202 and does not execute them", async () => {
    const id = await t.queue();
    expect(t.writeRun).not.toHaveBeenCalled();
    const row = t.tables.agent_pending_actions.find((r) => r.id === id)!;
    expect(row).toMatchObject({ status: "PENDING", actionType: "set_rate", payload: { rate: 0.12 }, rationale: RATIONALE, beforeSnapshot: { rate: 0.1 } });
    expect(row.payload).not.toHaveProperty("rationale");
  });

  it("rejects unknown keys and a missing rationale", async () => {
    expect((await t.agent("/tools/set_rate", { rate: 0.12, rationale: RATIONALE, extra: 1 })).status).toBe(400);
    expect((await t.agent("/tools/set_rate", { rate: 0.12 })).status).toBe(400);
    expect((await t.agent("/tools/no_such_tool", {})).status).toBe(404);
  });

  it("refuses to let the agent key resolve actions", async () => {
    const id = await t.queue();
    const res = await t.resolve(id, "APPROVED", { "x-agent-key": SECRET, authorization: `Bearer ${ADMIN_TOKEN}` });
    expect(res.status).toBe(403);
    expect(t.writeRun).not.toHaveBeenCalled();
  });

  it("refuses non-admin sessions", async () => {
    const id = await t.queue();
    expect((await t.resolve(id, "APPROVED", { authorization: "Bearer not-an-admin" })).status).toBe(401);
    expect((await t.resolve(id, "APPROVED", {})).status).toBe(401);
    expect(t.writeRun).not.toHaveBeenCalled();
  });

  it("executes exactly once on approval, as the approving admin", async () => {
    const id = await t.queue();
    const res = await t.resolve(id, "APPROVED");
    expect(res.status).toBe(200);
    const { action } = (await res.json()) as any;
    expect(action).toMatchObject({ status: "EXECUTED", result: { applied: 0.12 }, resolvedByAdminId: ADMIN_ID });
    expect(t.writeRun).toHaveBeenCalledTimes(1);
    expect(t.writeRun.mock.calls[0][2]).toBe(ADMIN_ID);

    const again = await t.resolve(id, "APPROVED");
    expect(again.status).toBe(409);
    expect(t.writeRun).toHaveBeenCalledTimes(1);
  });

  it("never executes a rejected action", async () => {
    const id = await t.queue();
    const res = await t.resolve(id, "REJECTED");
    expect(((await res.json()) as any).action.status).toBe("REJECTED");
    expect((await t.resolve(id, "APPROVED")).status).toBe(409);
    expect(t.writeRun).not.toHaveBeenCalled();
  });

  it("records EXECUTION_FAILED, not EXECUTED, when the action throws", async () => {
    t.writeRun.mockRejectedValueOnce(new Error("Payout must be in manual_review"));
    const id = await t.queue();
    const { action } = (await (await t.resolve(id, "APPROVED")).json()) as any;
    expect(action.status).toBe("EXECUTION_FAILED");
    expect(action.error).toContain("manual_review");
  });

  it("refuses to execute if the live value changed after the action was queued", async () => {
    const id = await t.queue(0.12);
    t.tables.config[0].rate = 0.15; // someone changed it in admin-web meanwhile
    const { action } = (await (await t.resolve(id, "APPROVED")).json()) as any;
    expect(action.status).toBe("EXECUTION_FAILED");
    expect(action.error).toContain("live values changed");
    expect(t.writeRun).not.toHaveBeenCalled();
  });

  it("lets the agent poll its action's outcome", async () => {
    const id = await t.queue();
    await t.resolve(id, "APPROVED");
    const res = await t.agent(`/actions/${id}`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).action.status).toBe("EXECUTED");
    expect((await t.agent("/actions/00000000-0000-4000-8000-000000000000")).status).toBe(404);
  });
});
