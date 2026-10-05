import { z } from "zod";
import type { AgentTool } from "./types";
import { getOperationsOverviewTool, listTripsTool } from "./tools/operations";
import {
  getSupportTicketTool,
  listSupportTicketsTool,
  replyToSupportTicketTool,
  updateSupportTicketStatusTool,
} from "./tools/support";
import {
  decideDriverVerificationTool,
  getDriverVerificationDetailTool,
  listDriversPendingVerificationTool,
  listPendingDocumentsTool,
  reviewDriverDocumentTool,
} from "./tools/driver-verification";
import {
  completePayoutManuallyTool,
  failPayoutManuallyTool,
  listPayoutsTool,
  movePayoutToManualReviewTool,
} from "./tools/payouts";
import {
  createTrafficRuleTool,
  deleteTrafficRuleTool,
  getPricingConfigTool,
  updateCancellationFeeTool,
  updateCommissionRateTool,
  updatePriorityFeeTool,
  updatePricingTierTool,
  updateSurgeConfigTool,
  updateTrafficRuleTool,
  updateWaitingChargeTool,
} from "./tools/pricing";
import { createPromotionTool, getPromotionUsageTool, listPromotionsTool, updatePromotionTool } from "./tools/promotions";
import { createAppVideoTool, deleteAppVideoTool, listAppVideosTool, updateAppVideoTool } from "./tools/app-videos";

// The complete, explicit allowlist of what the agent can do. Anything not in
// this list is unreachable through /api/v1/agent-admin. To add an ability:
// define it in tools/ and add one line here.
export const AGENT_TOOLS: AgentTool[] = [
  // Read-only — execute immediately
  getOperationsOverviewTool,
  listTripsTool,
  listSupportTicketsTool,
  getSupportTicketTool,
  listDriversPendingVerificationTool,
  getDriverVerificationDetailTool,
  listPendingDocumentsTool,
  listPayoutsTool,
  getPricingConfigTool,
  listPromotionsTool,
  getPromotionUsageTool,
  listAppVideosTool,

  // Writes — queued for human approval
  replyToSupportTicketTool,
  updateSupportTicketStatusTool,
  decideDriverVerificationTool,
  reviewDriverDocumentTool,
  movePayoutToManualReviewTool,
  completePayoutManuallyTool,
  failPayoutManuallyTool,
  updatePricingTierTool,
  createTrafficRuleTool,
  updateTrafficRuleTool,
  deleteTrafficRuleTool,
  updatePriorityFeeTool,
  updateSurgeConfigTool,
  updateCommissionRateTool,
  updateWaitingChargeTool,
  updateCancellationFeeTool,
  createPromotionTool,
  updatePromotionTool,
  createAppVideoTool,
  updateAppVideoTool,
  deleteAppVideoTool,
];

export type ToolRegistry = ReadonlyMap<string, AgentTool>;

export function createToolRegistry(tools: AgentTool[]): ToolRegistry {
  const map = new Map<string, AgentTool>();
  for (const tool of tools) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(tool.name)) {
      throw new Error(`Invalid agent tool name '${tool.name}' (must match ^[a-zA-Z0-9_-]{1,64}$).`);
    }
    if (map.has(tool.name)) throw new Error(`Duplicate agent tool name '${tool.name}'.`);
    map.set(tool.name, tool);
  }
  return map;
}

export const defaultToolRegistry = createToolRegistry(AGENT_TOOLS);

export const RATIONALE_FIELD = "rationale";

const rationaleSchema = z
  .string()
  .min(10)
  .max(2000)
  .describe(
    "Your justification for this action, shown to the human admin who must approve it. State what you observed (cite ticket/driver/payout ids and current values) and why this action is the right one."
  );

// The schema the agent's request body is validated against: strict (unknown
// keys are rejected rather than silently dropped), and for write tools,
// extended with the required rationale.
export function agentInputSchema(tool: AgentTool): z.ZodObject<any> {
  const base = tool.kind === "write" ? tool.inputSchema.extend({ [RATIONALE_FIELD]: rationaleSchema }) : tool.inputSchema;
  return base.strict();
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  requires_approval: boolean;
}

// Anthropic tool-use format ({name, description, input_schema}); for OpenAI
// function calling, map input_schema -> parameters.
export function getToolDefinitions(registry: ToolRegistry = defaultToolRegistry): ToolDefinition[] {
  return [...registry.values()].map((tool) => {
    const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(agentInputSchema(tool), { io: "input" }) as Record<string, unknown>;
    return {
      name: tool.name,
      description: tool.description,
      input_schema: jsonSchema,
      requires_approval: tool.kind === "write",
    };
  });
}
