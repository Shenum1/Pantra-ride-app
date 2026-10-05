import type { SupabaseClient } from "@supabase/supabase-js";
import type { WriteTool } from "./types";
import { defaultToolRegistry, type ToolRegistry } from "./registry";

export type AgentActionStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXECUTED" | "EXECUTION_FAILED";

export interface AgentActionRow {
  id: string;
  actionType: string;
  payload: Record<string, unknown>;
  rationale: string;
  beforeSnapshot: Record<string, unknown> | null;
  status: AgentActionStatus;
  result: unknown;
  error: string | null;
  resolvedByAdminId: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export class AgentActionNotFoundError extends Error {
  constructor(id: string) {
    super(`Agent action ${id} not found.`);
    this.name = "AgentActionNotFoundError";
  }
}

export class AgentActionConflictError extends Error {
  constructor(public readonly currentStatus: AgentActionStatus) {
    super(`Agent action has already been resolved (status: ${currentStatus}).`);
    this.name = "AgentActionConflictError";
  }
}

const TABLE = "agent_pending_actions";

// Key-order-independent JSON, so two snapshots of the same values always
// compare equal regardless of the order columns came back in.
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`);
  return `{${entries.join(",")}}`;
}

export async function enqueueAction(
  db: SupabaseClient,
  tool: WriteTool,
  input: Record<string, unknown>,
  rationale: string
): Promise<AgentActionRow> {
  // Throws (e.g. "Payout not found.") for a target that doesn't exist, so the
  // agent hears about it now instead of queueing an action that can never run.
  const beforeSnapshot = tool.snapshot ? await tool.snapshot(db, input) : null;

  const { data, error } = await db
    .from(TABLE)
    .insert({ actionType: tool.name, payload: input, rationale, beforeSnapshot, status: "PENDING" })
    .select("*")
    .single();
  if (error || !data) throw new Error(`Could not queue action: ${error?.message ?? "no row returned"}`);
  return data as AgentActionRow;
}

export async function getAction(db: SupabaseClient, id: string): Promise<AgentActionRow> {
  const { data, error } = await db.from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new AgentActionNotFoundError(id);
  return data as AgentActionRow;
}

export async function listActions(
  db: SupabaseClient,
  opts: { status?: AgentActionStatus; limit: number; offset: number },
  registry: ToolRegistry = defaultToolRegistry
) {
  let query = db
    .from(TABLE)
    .select("*", { count: "exact" })
    .order("createdAt", { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1);
  if (opts.status) query = query.eq("status", opts.status);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  const actions = ((data ?? []) as AgentActionRow[]).map((row) => {
    const tool = registry.get(row.actionType);
    let summary = row.actionType;
    if (tool?.kind === "write") {
      try {
        summary = tool.summarize(row.payload);
      } catch {
        // A payload a newer tool version can't summarize still has to be reviewable.
      }
    }
    return { ...row, summary, irreversible: tool?.kind === "write" ? !!tool.irreversible : false };
  });

  return { actions, total: count ?? 0 };
}

// Single-shot: only a PENDING row can be resolved, and the PENDING -> X
// transition is one conditional UPDATE, so two admins (or one double-click)
// can never both win — the loser gets a conflict, never a second execution.
async function claimPending(
  db: SupabaseClient,
  id: string,
  next: "APPROVED" | "REJECTED",
  adminUserId: string,
  note: string | undefined
): Promise<AgentActionRow> {
  const now = new Date().toISOString();
  const { data, error } = await db
    .from(TABLE)
    .update({ status: next, resolvedByAdminId: adminUserId, resolutionNote: note ?? null, resolvedAt: now, updatedAt: now })
    .eq("id", id)
    .eq("status", "PENDING")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data as AgentActionRow;

  const current = await getAction(db, id);
  throw new AgentActionConflictError(current.status);
}

async function finish(db: SupabaseClient, id: string, outcome: { status: "EXECUTED"; result: unknown } | { status: "EXECUTION_FAILED"; error: string }) {
  const { data, error } = await db
    .from(TABLE)
    .update({
      status: outcome.status,
      result: outcome.status === "EXECUTED" ? (outcome.result ?? null) : null,
      error: outcome.status === "EXECUTION_FAILED" ? outcome.error : null,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) throw new Error(`Action ran but its outcome could not be recorded: ${error?.message ?? "no row returned"}`);
  return data as AgentActionRow;
}

async function executeApproved(
  db: SupabaseClient,
  row: AgentActionRow,
  adminUserId: string,
  registry: ToolRegistry
): Promise<AgentActionRow> {
  const tool = registry.get(row.actionType);
  if (!tool || tool.kind !== "write") {
    return finish(db, row.id, { status: "EXECUTION_FAILED", error: `Unknown or non-write action type '${row.actionType}'.` });
  }

  // Re-validate: the tool's schema may have tightened since the action was queued.
  const parsed = tool.inputSchema.safeParse(row.payload);
  if (!parsed.success) {
    return finish(db, row.id, { status: "EXECUTION_FAILED", error: `Stored payload is no longer valid: ${parsed.error.message}` });
  }

  try {
    if (tool.snapshot) {
      const current = await tool.snapshot(db, parsed.data);
      if (stableStringify(current) !== stableStringify(row.beforeSnapshot)) {
        return finish(db, row.id, {
          status: "EXECUTION_FAILED",
          error: `Refused: the live values changed after this action was proposed, so it was NOT applied. When proposed: ${stableStringify(
            row.beforeSnapshot
          )}. Now: ${stableStringify(current)}. Ask the agent to re-read and propose again.`,
        });
      }
    }

    const result = await tool.run(db, parsed.data, adminUserId);
    return finish(db, row.id, { status: "EXECUTED", result });
  } catch (e) {
    return finish(db, row.id, { status: "EXECUTION_FAILED", error: (e as Error).message || "Execution failed." });
  }
}

export async function resolveAction(
  db: SupabaseClient,
  id: string,
  decision: "APPROVED" | "REJECTED",
  adminUserId: string,
  note?: string,
  registry: ToolRegistry = defaultToolRegistry
): Promise<AgentActionRow> {
  const claimed = await claimPending(db, id, decision, adminUserId, note);
  if (decision === "REJECTED") return claimed;
  return executeApproved(db, claimed, adminUserId, registry);
}
