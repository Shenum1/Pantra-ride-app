import { Hono } from "hono";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../lib/supabase-admin";
import { defaultVerifyAdmin, requireAdminSession, requireAgentKey, type VerifyAdmin } from "./auth";
import { agentInputSchema, defaultToolRegistry, getToolDefinitions, RATIONALE_FIELD, type ToolRegistry } from "./registry";
import { AgentActionConflictError, AgentActionNotFoundError, enqueueAction, getAction, resolveAction } from "./hitl";

export interface AgentAdminRouterDeps {
  db: SupabaseClient | null;
  registry?: ToolRegistry;
  getSecret?: () => string | null;
  verifyAdmin?: VerifyAdmin;
}

const actionIdSchema = z.string().uuid();
const resolveBodySchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    note: z.string().max(2000).optional(),
  })
  .strict();

function issues(error: z.ZodError) {
  return error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
}

async function readJson(req: { json(): Promise<unknown> }): Promise<{ ok: true; body: unknown } | { ok: false }> {
  try {
    return { ok: true, body: await req.json() };
  } catch {
    return { ok: false };
  }
}

// Mounted at /api/v1/agent-admin (see backend/hono.ts). Plain JSON in and out,
// for an LLM agent — deliberately not tRPC.
export function createAgentAdminRouter(deps: AgentAdminRouterDeps) {
  const registry = deps.registry ?? defaultToolRegistry;
  const agentAuth = requireAgentKey(deps.getSecret);
  const adminAuth = requireAdminSession(deps.verifyAdmin ?? defaultVerifyAdmin(deps.db));
  const router = new Hono<{ Variables: { adminUserId: string } }>();

  router.get("/tools", agentAuth, (c) => c.json({ tools: getToolDefinitions(registry) }));

  router.post("/tools/:name", agentAuth, async (c) => {
    const db = deps.db;
    if (!db) return c.json({ error: "Database is not configured (SUPABASE_SERVICE_ROLE_KEY unset)." }, 503);

    const tool = registry.get(c.req.param("name"));
    if (!tool) return c.json({ error: `Unknown tool '${c.req.param("name")}'. GET /tools lists the available tools.` }, 404);

    const raw = await readJson(c.req);
    if (!raw.ok) return c.json({ error: "Request body must be a JSON object." }, 400);

    const parsed = agentInputSchema(tool).safeParse(raw.body ?? {});
    if (!parsed.success) return c.json({ error: "Invalid input.", issues: issues(parsed.error) }, 400);

    if (tool.kind === "read") {
      try {
        return c.json({ data: await tool.run(db, parsed.data) });
      } catch (e) {
        return c.json({ error: (e as Error).message }, 422);
      }
    }

    const { [RATIONALE_FIELD]: rationale, ...input } = parsed.data as Record<string, unknown>;
    const invalid = tool.validate?.(input);
    if (invalid) return c.json({ error: "Invalid input.", issues: [{ path: "", message: invalid }] }, 400);

    try {
      const action = await enqueueAction(db, tool, input, rationale as string);
      return c.json(
        {
          actionId: action.id,
          status: action.status,
          message: "Queued for human approval. Nothing has changed yet. Poll GET /actions/{actionId} for the outcome.",
        },
        202
      );
    } catch (e) {
      return c.json({ error: (e as Error).message }, 422);
    }
  });

  router.get("/actions/:id", agentAuth, async (c) => {
    const db = deps.db;
    if (!db) return c.json({ error: "Database is not configured (SUPABASE_SERVICE_ROLE_KEY unset)." }, 503);
    const id = actionIdSchema.safeParse(c.req.param("id"));
    if (!id.success) return c.json({ error: "Action id must be a UUID." }, 400);

    try {
      return c.json({ action: await getAction(db, id.data) });
    } catch (e) {
      if (e instanceof AgentActionNotFoundError) return c.json({ error: e.message }, 404);
      throw e;
    }
  });

  router.post("/actions/:id/resolve", adminAuth, async (c) => {
    const db = deps.db;
    if (!db) return c.json({ error: "Database is not configured (SUPABASE_SERVICE_ROLE_KEY unset)." }, 503);
    const id = actionIdSchema.safeParse(c.req.param("id"));
    if (!id.success) return c.json({ error: "Action id must be a UUID." }, 400);

    const raw = await readJson(c.req);
    if (!raw.ok) return c.json({ error: "Request body must be a JSON object." }, 400);
    const body = resolveBodySchema.safeParse(raw.body);
    if (!body.success) return c.json({ error: "Invalid input.", issues: issues(body.error) }, 400);

    try {
      const action = await resolveAction(db, id.data, body.data.decision, c.get("adminUserId"), body.data.note, registry);
      return c.json({ action });
    } catch (e) {
      if (e instanceof AgentActionNotFoundError) return c.json({ error: e.message }, 404);
      if (e instanceof AgentActionConflictError) return c.json({ error: e.message, status: e.currentStatus }, 409);
      throw e;
    }
  });

  return router;
}

export const agentAdminRouter = createAgentAdminRouter({ db: supabaseAdmin });
