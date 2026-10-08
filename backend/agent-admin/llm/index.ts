import { createAnthropicProvider } from "./anthropic";
import { createGroqProvider } from "./groq";
import type { LlmProvider } from "./types";

export type { LlmProvider } from "./types";

// AGENT_PROVIDER=groq (default) | anthropic. Each SDK is imported lazily on
// first use, so the provider you're not using never needs a key.
export function getProvider(name: string | undefined = process.env.AGENT_PROVIDER): LlmProvider {
  switch ((name ?? "groq").trim().toLowerCase()) {
    case "groq":
      return createGroqProvider();
    case "anthropic":
    case "claude":
      return createAnthropicProvider();
    default:
      throw new Error(`Unknown AGENT_PROVIDER '${name}'. Use 'groq' or 'anthropic'.`);
  }
}
