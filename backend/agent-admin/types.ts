import type { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

type AnyObjectSchema = z.ZodObject<any>;

export interface ReadTool<S extends AnyObjectSchema = AnyObjectSchema> {
  kind: "read";
  name: string;
  description: string;
  inputSchema: S;
  run(db: SupabaseClient, input: z.infer<S>): Promise<unknown>;
}

export interface WriteTool<S extends AnyObjectSchema = AnyObjectSchema> {
  kind: "write";
  name: string;
  description: string;
  inputSchema: S;
  // Shown to the human reviewer in the Agent queue, e.g. "Set commission rate to 12%".
  summarize(input: z.infer<S>): string;
  // Cross-field checks a plain object schema can't express (kept out of the
  // schema itself because Zod 4 can't .extend() a refined object). Returns an
  // error message, or undefined if the input is acceptable.
  validate?(input: z.infer<S>): string | undefined;
  // Current values of whatever this action will change. Captured when the
  // action is queued and re-captured at approval; execution is refused if
  // they differ. Throwing here (e.g. target not found) rejects the request
  // at queue time instead of queueing something that can never run.
  snapshot?(db: SupabaseClient, input: z.infer<S>): Promise<Record<string, unknown>>;
  irreversible?: boolean;
  // actorAdminId is the human admin who approved the action — recorded as the
  // actor in the existing audit tables.
  run(db: SupabaseClient, input: z.infer<S>, actorAdminId: string): Promise<unknown>;
}

export type AgentTool = ReadTool<any> | WriteTool<any>;

export function defineReadTool<S extends AnyObjectSchema>(tool: Omit<ReadTool<S>, "kind">): ReadTool<S> {
  return { kind: "read", ...tool };
}

export function defineWriteTool<S extends AnyObjectSchema>(tool: Omit<WriteTool<S>, "kind">): WriteTool<S> {
  return { kind: "write", ...tool };
}

export function pick(row: Record<string, unknown> | null | undefined, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) out[key] = row?.[key] ?? null;
  return out;
}
