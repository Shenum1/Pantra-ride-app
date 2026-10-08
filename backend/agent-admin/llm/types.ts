// Provider-neutral contract between the orchestrator and an LLM. Message
// arrays stay in each provider's NATIVE shape (they're replayed verbatim to
// that provider next turn); only tools, tool calls and tool results are
// neutral. Switching provider therefore means starting a new conversation.

export interface NeutralTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  // null when the model produced arguments that aren't a JSON object;
  // inputError then says why, and the call is reported back as an error.
  input: Record<string, unknown> | null;
  inputError?: string;
}

export interface ToolResult {
  id: string;
  name: string;
  content: string;
  isError: boolean;
}

// done: final answer. tool_calls: run the calls and continue. continue: the
// provider paused mid-turn and wants the same request re-sent. truncated:
// output hit the token limit. refused: the provider declined.
export type Finish = "done" | "tool_calls" | "continue" | "truncated" | "refused";

export interface CompletionResult {
  assistantMessage: unknown;
  text: string;
  toolCalls: ToolCall[];
  finish: Finish;
}

export interface LlmProvider {
  name: string;
  // Returns a human-readable reason when the provider can't be used (e.g. its
  // API key is missing), or undefined when it's ready.
  configError(): string | undefined;
  userMessage(text: string): unknown;
  complete(args: { system: string; messages: unknown[]; tools: NeutralTool[] }): Promise<CompletionResult>;
  toolResultMessages(results: ToolResult[]): unknown[];
}
