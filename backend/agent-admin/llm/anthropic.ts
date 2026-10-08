import type Anthropic from "@anthropic-ai/sdk";
import type { CompletionResult, Finish, LlmProvider, ToolCall } from "./types";

// "The latest available" Sonnet. Override with AGENT_MODEL.
export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5-5";

type AnthropicClient = Pick<Anthropic, "beta">;
type BetaMessageParam = Anthropic.Beta.Messages.BetaMessageParam;

export function createAnthropicProvider(opts: { client?: AnthropicClient; model?: string } = {}): LlmProvider {
  const model = opts.model ?? process.env.AGENT_MODEL ?? DEFAULT_ANTHROPIC_MODEL;
  let client = opts.client;

  async function getClient(): Promise<AnthropicClient> {
    if (!client) {
      const { default: AnthropicSdk } = await import("@anthropic-ai/sdk");
      // Default credential resolution: ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / profile.
      client = new AnthropicSdk();
    }
    return client;
  }

  return {
    name: "anthropic",

    configError() {
      if (opts.client || process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return undefined;
      return "ANTHROPIC_API_KEY is not set on the server.";
    },

    userMessage: (text): BetaMessageParam => ({ role: "user", content: text }),

    async complete({ system, messages, tools }): Promise<CompletionResult> {
      const anthropic = await getClient();
      const response = await anthropic.beta.messages.create({
        model,
        max_tokens: 16000,
        // A safety decline is retried on another model inside the same call
        // instead of dead-ending the conversation.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.input_schema as Anthropic.Beta.Messages.BetaTool.InputSchema,
        })),
        tool_choice: { type: "auto" },
        messages: messages as BetaMessageParam[],
      });

      const toolCalls: ToolCall[] = [];
      let text = "";
      for (const block of response.content) {
        if (block.type === "text") text += block.text;
        if (block.type === "tool_use") {
          const input = block.input;
          toolCalls.push(
            input && typeof input === "object" && !Array.isArray(input)
              ? { id: block.id, name: block.name, input: input as Record<string, unknown> }
              : { id: block.id, name: block.name, input: null, inputError: "Tool arguments must be a JSON object." }
          );
        }
      }

      const finish: Finish =
        response.stop_reason === "refusal"
          ? "refused"
          : response.stop_reason === "max_tokens"
            ? "truncated"
            : response.stop_reason === "pause_turn"
              ? "continue"
              : toolCalls.length > 0
                ? "tool_calls"
                : "done";

      // Appended unchanged: thinking blocks must be replayed exactly as returned.
      return { assistantMessage: { role: "assistant", content: response.content }, text, toolCalls, finish };
    },

    // All results of one turn go back in a single user message.
    toolResultMessages: (results) => [
      {
        role: "user",
        content: results.map((r) => ({
          type: "tool_result" as const,
          tool_use_id: r.id,
          content: r.content,
          is_error: r.isError,
        })),
      } satisfies BetaMessageParam,
    ],
  };
}
