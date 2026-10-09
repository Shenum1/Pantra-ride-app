import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createAgentAdminRouter } from "@/backend/agent-admin/router";
import { createToolRegistry } from "@/backend/agent-admin/registry";
import { defineReadTool, defineWriteTool } from "@/backend/agent-admin/types";
import { createFakeDb } from "./fake-db";

const SECRET = "s".repeat(40);

function setup() {
  const readRun = vi.fn(async (_db: unknown, input: { status?: string; limit: number }) => ({ echoed: input }));
  const writeRun = vi.fn(async () => ({ ok: true }));

  const readTool = defineReadTool({
    name: "list_things",
    description: "Test read tool that echoes the input it received, used to check query-string parsing.",
    inputSchema: z.object({
      status: z.enum(["open", "closed"]).optional().describe("Filter by status."),
      limit: z.number().int().default(50).describe("Page size."),
    }),
    run: readRun as any,
  });
  const writeTool = defineWriteTool({
    name: "change_thing",
    description: "Test write tool that must never be reachable through the browser-openable read link.",
    inputSchema: z.object({ id: z.string().describe("Thing id.") }),
    summarize: (i) => `Change ${i.id}`,
    run: writeRun as any,
  });

  const router = createAgentAdminRouter({
    db: createFakeDb().db,
    registry: createToolRegistry([readTool, writeTool]),
    getSecret: () => SECRET,
  });
  return { router, readRun, writeRun };
}

describe("browser-openable read links", () => {
  it("rejects a missing or wrong ?key= and never runs the tool", async () => {
    const { router, readRun } = setup();
    expect((await router.request("/read/list_things")).status).toBe(401);
    expect((await router.request("/read/list_things?key=wrong")).status).toBe(401);
    expect(readRun).not.toHaveBeenCalled();
  });

  it("runs a read tool with the key in the URL and parses query values", async () => {
    const { router, readRun } = setup();
    const res = await router.request(`/read/list_things?key=${SECRET}&status=open&limit=5`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { echoed: { status: "open", limit: 5 } } });
    expect(readRun).toHaveBeenCalledTimes(1);
  });

  it("does not echo the key into the response and sets no-store / no-referrer headers", async () => {
    const { router } = setup();
    const res = await router.request(`/read/list_things?key=${SECRET}`);

    expect(await res.text()).not.toContain(SECRET);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("also accepts the x-agent-key header on the same routes", async () => {
    const { router } = setup();
    expect((await router.request("/read/list_things", { headers: { "x-agent-key": SECRET } })).status).toBe(200);
  });

  it("returns 400 with field issues for invalid parameters", async () => {
    const { router } = setup();
    const res = await router.request(`/read/list_things?key=${SECRET}&status=bogus`);
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).issues[0].path).toBe("status");
  });

  it("makes write tools unreachable through the read link", async () => {
    const { router, writeRun } = setup();
    expect((await router.request(`/read/change_thing?key=${SECRET}&id=abc`)).status).toBe(404);
    expect(writeRun).not.toHaveBeenCalled();
  });

  it("lists only read tools at /read and hides write tools", async () => {
    const { router } = setup();
    const res = await router.request(`/read?key=${SECRET}`);
    const names = ((await res.json()) as any).tools.map((t: any) => t.name);
    expect(names).toEqual(["list_things"]);
  });

  it("still refuses ?key= on every other route (write queueing, tools list, action polling)", async () => {
    const { router, writeRun } = setup();
    expect((await router.request(`/tools?key=${SECRET}`)).status).toBe(401);
    expect(
      (
        await router.request(`/tools/change_thing?key=${SECRET}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: "x", rationale: "should never be queued via a link" }),
        })
      ).status
    ).toBe(401);
    expect((await router.request(`/actions/00000000-0000-4000-8000-000000000000?key=${SECRET}`)).status).toBe(401);
    expect(writeRun).not.toHaveBeenCalled();
  });

  it("fails closed with 503 when no secret is configured, even with a ?key=", async () => {
    const router = createAgentAdminRouter({ db: createFakeDb().db, registry: createToolRegistry([]), getSecret: () => null });
    expect((await router.request("/read?key=anything")).status).toBe(503);
  });
});
