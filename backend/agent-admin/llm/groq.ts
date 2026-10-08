import type Groq from "groq-sdk";
import type { ChatCompletionMessageParam, ChatCompletionAssistantMessageParam } from "groq-sdk/resources/chat/completions";
import type { CompletionResult, LlmProvider, ToolCall } from "./types";

// Strongest production Groq model that supports custom function calling (per
// console.groq.com/docs/models, 2026-10). Override with GROQ_MODEL, e.g.
// llama-3.3-70b-versatile.
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

type GroqClient = Pick<Groq, "chat">;

function parseArguments(raw: string | undefined): Pick<ToolCall, "input" | "inputError"> {
  try {
    const parsed = JSON.parse(raw && raw.trim() ? raw : "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return { input: parsed };
    return { input: null, inputError: "Tool arguments must be a JSON object." };
  } catch {
    return { input: null, inputError: "Tool arguments were not valid JSON." };
  }
}

export function createGroqProvider(opts: { client?: GroqClient; model?: string; apiKey?: string } = {}): LlmProvider {
  const model = opts.model ?? process.env.GROQ_MODEL ?? DEFAULT_GROQ_MODEL;
  let client = opts.client;

  async function getClient(): Promise<GroqClient> {
    if (!client) {
      const { default: GroqSdk } = await import("groq-sdk");
      client = new GroqSdk({ apiKey: opts.apiKey ?? process.env.GROQ_API_KEY });
    }
    return client;
  }

  return {
    name: "groq",

    configError() {
      if (opts.client || opts.apiKey || process.env.GROQ_API_KEY) return undefined;
      return "GROQ_API_KEY is not set on the server.";
    },

    userMessage: (text): ChatCompletionMessageParam => ({ role: "user", content: text }),

    async complete({ system, messages, tools }): Promise<CompletionResult> {
      const groq = await getClient();
      const completion = await groq.chat.completions.create({
        model,
        messages: [{ role: "system", content: system }, ...(messages as ChatCompletionMessageParam[])],
        tools: tools.map((t) => ({
          type: "function" as const,
          function: { name: t.name, description: t.description, parameters: t.input_schema },
        })),
        tool_choice: "auto",
      });

      const choice = completion.choices[0];
      const message = choice?.message;
      const rawCalls = message?.tool_calls ?? [];

      // Replay only fields every Groq model accepts back as input (drop
      // reasoning/annotations/executed_tools that some models attach).
      const assistantMessage: ChatCompletionAssistantMessageParam = { role: "assistant", content: message?.content ?? "" };
      if (rawCalls.length > 0) assistantMessage.tool_calls = rawCalls;

      const toolCalls: ToolCall[] = rawCalls.map((call) => ({
        id: call.id,
        name: call.function.name,
        ...parseArguments(call.function.arguments),
      }));

      const reason = choice?.finish_reason;
      const finish =
        reason === "length"
          ? "truncated"
          : (reason as string) === "content_filter"
            ? "refused"
            : toolCalls.length > 0
              ? "tool_calls"
              : "done";

      return { assistantMessage, text: message?.content ?? "", toolCalls, finish };
    },

    toolResultMessages: (results) =>
      results.map((r): ChatCompletionMessageParam => ({
        role: "tool",
        tool_call_id: r.id,
        content: r.isError ? `ERROR: ${r.content}` : r.content,
      })),
  };
}
