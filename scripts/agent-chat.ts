// Terminal chat with the Pantra admin agent — the simplest "interface" for
// runAgentConversation. Run: bun scripts/agent-chat.ts
// Needs in .env: AGENT_ADMIN_SECRET_KEY, plus GROQ_API_KEY (default provider)
// or AGENT_PROVIDER=anthropic + ANTHROPIC_API_KEY.
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { runAgentConversation } from "../backend/agent-admin/orchestrator";

const rl = createInterface({ input: stdin, output: stdout });
let waitingForInput = false;
let inputClosed = false;
// Input closed (Ctrl+D / end of piped input). Exit at once if we're waiting
// on a question (it would otherwise hang forever); if an answer is still being
// generated, let it finish first.
rl.on("close", () => {
  inputClosed = true;
  if (waitingForInput) process.exit(0);
});

let history: unknown[] = [];
console.log(`Pantra admin agent (${process.env.AGENT_PROVIDER ?? "groq"}). Type a request, "/new" to reset, or "exit".\n`);

while (!inputClosed) {
  waitingForInput = true;
  const prompt = (await rl.question("you > ")).trim();
  waitingForInput = false;

  if (!prompt) continue;
  if (prompt === "exit" || prompt === "quit") break;
  if (prompt === "/new") {
    history = [];
    console.log("(new conversation)\n");
    continue;
  }

  const result = await runAgentConversation(prompt, history);
  history = result.history;
  if (result.toolExecutionResult) console.log(`\n[tools]\n${result.toolExecutionResult}`);
  console.log(`\nagent > ${result.agentResponse}\n`);
}

rl.close();
process.exit(0);
