import { describe, expect, it, vi } from "vitest";
import { createGroqProvider } from "@/backend/agent-admin/llm/groq";
import { createAnthropicProvider } from "@/backend/agent-admin/llm/anthropic";
import { getProvider } from "@/backend/agent-admin/llm";

const TOOLS = [{ name: "list_trips", description: "List trips", input_schema: { type: "object", properties: {} } }];

describe("Groq provider", () => {
  function groqWith(message: Record<string, unknown>, finish_reason = "stop") {
    const create = vi.fn(async () => ({ choices: [{ message: { role: "assistant", ...message }, finish_reason }] }));
    return { provider: createGroqProvider({ client: { chat: { completions: { create } } } as any, model: "test-model" }), create };
  }

  it("sends OpenAI-style function tools with the system prompt first", async () => {
    const { provider, create } = groqWith({ content: "hi" });
    await provider.complete({ system: "SYS", messages: [provider.userMessage("hello")], tools: TOOLS });

    const req = (create.mock.calls[0] as any[])[0];
    expect(req.model).toBe("test-model");
    expect(req.messages[0]).toEqual({ role: "system", content: "SYS" });
    expect(req.messages[1]).toEqual({ role: "user", content: "hello" });
    expect(req.tools[0]).toEqual({ type: "function", function: { name: "list_trips", description: "List trips", parameters: TOOLS[0].input_schema } });
    expect(req.tool_choice).toBe("auto");
  });

  it("parses tool-call arguments and flags invalid JSON instead of throwing", async () => {
    const { provider } = groqWith(
      {
        content: null,
        reasoning: "internal",
        tool_calls: [
          { id: "a", type: "function", function: { name: "list_trips", arguments: '{"limit":5}' } },
          { id: "b", type: "function", function: { name: "list_trips", arguments: "{not json" } },
        ],
      },
      "tool_calls"
    );
    const res = await provider.complete({ system: "S", messages: [], tools: TOOLS });

    expect(res.finish).toBe("tool_calls");
    expect(res.toolCalls[0]).toMatchObject({ id: "a", input: { limit: 5 } });
    expect(res.toolCalls[1]).toMatchObject({ id: "b", input: null });
    expect(res.toolCalls[1].inputError).toContain("not valid JSON");
    expect(res.assistantMessage).not.toHaveProperty("reasoning");
  });

  it("returns one role:tool message per result", () => {
    const provider = createGroqProvider({ client: {} as any });
    const msgs = provider.toolResultMessages([
      { id: "a", name: "x", content: "ok", isError: false },
      { id: "b", name: "y", content: "bad", isError: true },
    ]);
    expect(msgs).toEqual([
      { role: "tool", tool_call_id: "a", content: "ok" },
      { role: "tool", tool_call_id: "b", content: "ERROR: bad" },
    ]);
  });

  it("maps length to truncated", async () => {
    const { provider } = groqWith({ content: "partial" }, "length");
    expect((await provider.complete({ system: "S", messages: [], tools: TOOLS })).finish).toBe("truncated");
  });
});

describe("Anthropic provider", () => {
  function anthropicWith(content: any[], stop_reason: string) {
    const create = vi.fn(async () => ({ content, stop_reason }));
    return { provider: createAnthropicProvider({ client: { beta: { messages: { create } } } as any, model: "claude-test" }), create };
  }

  it("requests adaptive thinking, the refusal fallback and auto tool choice", async () => {
    const { provider, create } = anthropicWith([{ type: "text", text: "hi" }], "end_turn");
    await provider.complete({ system: "SYS", messages: [provider.userMessage("hello")], tools: TOOLS });

    const req = (create.mock.calls[0] as any[])[0];
    expect(req).toMatchObject({
      model: "claude-test",
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      tool_choice: { type: "auto" },
    });
    expect(req.system[0]).toMatchObject({ type: "text", text: "SYS", cache_control: { type: "ephemeral" } });
    expect(req.tools[0]).toEqual({ name: "list_trips", description: "List trips", input_schema: TOOLS[0].input_schema });
  });

  it("keeps the assistant content unchanged (thinking blocks included) and extracts tool calls", async () => {
    const content = [
      { type: "thinking", thinking: "", signature: "sig" },
      { type: "tool_use", id: "tu1", name: "list_trips", input: { limit: 3 } },
    ];
    const { provider } = anthropicWith(content, "tool_use");
    const res = await provider.complete({ system: "S", messages: [], tools: TOOLS });

    expect(res.assistantMessage).toEqual({ role: "assistant", content });
    expect(res.finish).toBe("tool_calls");
    expect(res.toolCalls).toEqual([{ id: "tu1", name: "list_trips", input: { limit: 3 } }]);
  });

  it("returns all tool results in a single user message", () => {
    const provider = createAnthropicProvider({ client: {} as any });
    expect(
      provider.toolResultMessages([
        { id: "a", name: "x", content: "ok", isError: false },
        { id: "b", name: "y", content: "bad", isError: true },
      ])
    ).toEqual([
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "a", content: "ok", is_error: false },
          { type: "tool_result", tool_use_id: "b", content: "bad", is_error: true },
        ],
      },
    ]);
  });

  it("maps refusal and pause_turn", async () => {
    expect((await anthropicWith([], "refusal").provider.complete({ system: "S", messages: [], tools: [] })).finish).toBe("refused");
    expect((await anthropicWith([], "pause_turn").provider.complete({ system: "S", messages: [], tools: [] })).finish).toBe("continue");
  });
});

describe("getProvider", () => {
  it("defaults to groq and accepts anthropic", () => {
    expect(getProvider(undefined).name).toBe("groq");
    expect(getProvider("anthropic").name).toBe("anthropic");
    expect(() => getProvider("nope")).toThrow(/AGENT_PROVIDER/);
  });
});
