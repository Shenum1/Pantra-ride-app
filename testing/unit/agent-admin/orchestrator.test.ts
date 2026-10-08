import { describe, expect, it, vi } from "vitest";
import { runAgentConversation } from "@/backend/agent-admin/orchestrator";
import type { CompletionResult, LlmProvider, ToolResult } from "@/backend/agent-admin/llm/types";

const KEY = "k".repeat(40);
let baseCounter = 0;
// Fresh base URL per test so the per-process tools cache never leaks between tests.
const freshBase = () => `https://agent.test/${++baseCounter}`;

const TOOLS = [
  { name: "list_support_tickets", description: "List tickets", input_schema: { type: "object" }, requires_approval: false },
  { name: "reply_to_support_ticket", description: "Reply", input_schema: { type: "object" }, requires_approval: true },
];

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function fakeApi(routes: Record<string, (body: any) => Response>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, init });
    if (u.endsWith("/tools")) return json(200, { tools: TOOLS });
    const name = u.split("/tools/")[1];
    const handler = routes[name];
    return handler ? handler(JSON.parse(String(init?.body ?? "{}"))) : json(404, { error: "Unknown tool" });
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

// Scripted model: returns the given completions in order and records what it saw.
function fakeProvider(script: CompletionResult[]) {
  const seenResults: ToolResult[][] = [];
  const seenMessageCounts: number[] = [];
  let i = 0;
  const provider: LlmProvider = {
    name: "fake",
    configError: () => undefined,
    userMessage: (text) => ({ role: "user", text }),
    complete: vi.fn(async ({ messages }) => {
      seenMessageCounts.push(messages.length);
      return script[Math.min(i++, script.length - 1)];
    }),
    toolResultMessages: (results) => {
      seenResults.push(results);
      return [{ role: "tool_results", results }];
    },
  };
  return { provider, seenResults, seenMessageCounts };
}

const toolTurn = (calls: { id: string; name: string; input: Record<string, unknown> | null; inputError?: string }[], text = ""): CompletionResult => ({
  assistantMessage: { role: "assistant", calls: calls.map((c) => c.id) },
  text,
  toolCalls: calls,
  finish: "tool_calls",
});
const finalTurn = (text: string): CompletionResult => ({ assistantMessage: { role: "assistant", text }, text, toolCalls: [], finish: "done" });

describe("runAgentConversation", () => {
  it("loads tools with the agent key, runs a read tool, and continues to a final answer", async () => {
    const { fetchImpl, calls } = fakeApi({ list_support_tickets: () => json(200, { data: { tickets: [{ id: "t1" }], total: 1 } }) });
    const { provider, seenResults } = fakeProvider([
      toolTurn([{ id: "c1", name: "list_support_tickets", input: { status: "open" } }]),
      finalTurn("There is 1 open ticket."),
    ]);

    const res = await runAgentConversation("How many open tickets?", [], { provider, fetch: fetchImpl, apiBaseUrl: freshBase(), agentKey: KEY });

    expect(calls[0].url).toMatch(/\/tools$/);
    expect((calls[0].init?.headers as Record<string, string>)["x-agent-key"]).toBe(KEY);
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({ status: "open" });
    expect(seenResults[0][0]).toMatchObject({ id: "c1", isError: false });
    expect(seenResults[0][0].content).toContain('"total":1');
    expect(res.agentResponse).toBe("There is 1 open ticket.");
    expect(res.toolExecutionResult).toBe("list_support_tickets → ok");
  });

  it("reports a 202 as queued for approval, never as done", async () => {
    const { fetchImpl } = fakeApi({ reply_to_support_ticket: () => json(202, { actionId: "act-123", status: "PENDING" }) });
    const { provider, seenResults } = fakeProvider([
      toolTurn([{ id: "c1", name: "reply_to_support_ticket", input: { ticketId: "t1", text: "Hi", rationale: "Customer waiting" } }]),
      finalTurn("I've queued a reply for your approval."),
    ]);

    const res = await runAgentConversation("Reply to t1", [], { provider, fetch: fetchImpl, apiBaseUrl: freshBase(), agentKey: KEY });

    expect(seenResults[0][0].content).toContain("Queued for human approval");
    expect(seenResults[0][0].content).toContain("act-123");
    expect(res.toolExecutionResult).toBe("reply_to_support_ticket → queued for approval (action act-123)");
  });

  it("feeds API validation errors back to the model as errors", async () => {
    const { fetchImpl } = fakeApi({
      reply_to_support_ticket: () => json(400, { error: "Invalid input.", issues: [{ path: "rationale", message: "Required" }] }),
    });
    const { provider, seenResults } = fakeProvider([
      toolTurn([{ id: "c1", name: "reply_to_support_ticket", input: { ticketId: "t1", text: "Hi" } }]),
      finalTurn("I need a rationale."),
    ]);

    const res = await runAgentConversation("Reply", [], { provider, fetch: fetchImpl, apiBaseUrl: freshBase(), agentKey: KEY });

    expect(seenResults[0][0].isError).toBe(true);
    expect(seenResults[0][0].content).toContain("rationale");
    expect(res.toolExecutionResult).toBe("reply_to_support_ticket → rejected (400)");
  });

  it("turns unparseable tool arguments into an error result instead of calling the API", async () => {
    const { fetchImpl, calls } = fakeApi({});
    const { provider, seenResults } = fakeProvider([
      toolTurn([{ id: "c1", name: "list_support_tickets", input: null, inputError: "Tool arguments were not valid JSON." }]),
      finalTurn("Sorry, retrying."),
    ]);

    await runAgentConversation("List", [], { provider, fetch: fetchImpl, apiBaseUrl: freshBase(), agentKey: KEY });

    expect(calls.filter((c) => c.url.includes("/tools/"))).toHaveLength(0);
    expect(seenResults[0][0]).toMatchObject({ isError: true, content: "Tool arguments were not valid JSON." });
  });

  it("returns an append-only history that the next turn builds on", async () => {
    const { fetchImpl } = fakeApi({ list_support_tickets: () => json(200, { data: {} }) });
    const prior = [{ role: "user", text: "earlier" }, { role: "assistant", text: "earlier answer" }];
    const { provider, seenMessageCounts } = fakeProvider([
      toolTurn([{ id: "c1", name: "list_support_tickets", input: {} }]),
      finalTurn("Done"),
    ]);

    const res = await runAgentConversation("Next", prior, { provider, fetch: fetchImpl, apiBaseUrl: freshBase(), agentKey: KEY });

    expect(res.history.slice(0, 2)).toEqual(prior);
    expect(res.history[2]).toEqual({ role: "user", text: "Next" });
    // user + assistant(tool call) + tool results + assistant(final)
    expect(res.history).toHaveLength(prior.length + 4);
    expect(seenMessageCounts).toEqual([3, 5]);
  });

  it("stops at the step limit and still answers every pending tool call", async () => {
    const { fetchImpl } = fakeApi({ list_support_tickets: () => json(200, { data: {} }) });
    const { provider, seenResults } = fakeProvider([toolTurn([{ id: "loop", name: "list_support_tickets", input: {} }])]);

    const res = await runAgentConversation("Loop forever", [], {
      provider,
      fetch: fetchImpl,
      apiBaseUrl: freshBase(),
      agentKey: KEY,
      maxToolRounds: 2,
    });

    expect(res.agentResponse).toContain("stopped after 2 steps");
    expect(seenResults).toHaveLength(3); // 2 executed rounds + 1 "not executed" so history stays valid
    expect(seenResults[2][0]).toMatchObject({ isError: true });
    expect(seenResults[2][0].content).toContain("step limit");
  });

  it("returns a plain message without any network call when the agent key is missing", async () => {
    const { fetchImpl, calls } = fakeApi({});
    const { provider } = fakeProvider([finalTurn("unused")]);

    const res = await runAgentConversation("Hi", [], { provider, fetch: fetchImpl, apiBaseUrl: freshBase(), agentKey: "" });

    expect(res.agentResponse).toContain("AGENT_ADMIN_SECRET_KEY");
    expect(calls).toHaveLength(0);
  });

  it("explains a rejected agent key instead of throwing", async () => {
    const fetchImpl = vi.fn(async () => json(401, { error: "Invalid" })) as unknown as typeof fetch;
    const { provider } = fakeProvider([finalTurn("unused")]);

    const res = await runAgentConversation("Hi", [], { provider, fetch: fetchImpl, apiBaseUrl: freshBase(), agentKey: KEY });

    expect(res.agentResponse).toContain("401");
    expect(res.agentResponse).toContain("AGENT_ADMIN_SECRET_KEY");
  });
});
