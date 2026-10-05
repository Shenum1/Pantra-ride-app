import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { defineReadTool, defineWriteTool, pick, type WriteTool } from "../types";
import {
  cancellationFeeFields,
  commissionFields,
  createTrafficRule,
  createTrafficRuleInput,
  deleteTrafficRule,
  deleteTrafficRuleInput,
  getPricingConfig,
  getSingleRowConfig,
  priorityFeeFields,
  SINGLE_ROW_PRICING_TABLES,
  type SingleRowPricingTable,
  surgeFields,
  tierRateFields,
  updateCancellationFee,
  updateCommissionRate,
  updatePriorityFee,
  updatePricingTier,
  updatePricingTierInput,
  updateSurgeConfig,
  updateTrafficRule,
  updateTrafficRuleInput,
  updateWaitingCharge,
  waitingChargeFields,
} from "../../services/admin/pricing";

const LIVE_IMPACT =
  "Platform-wide and takes effect for every rider the moment it is approved. REQUIRES HUMAN APPROVAL: returns 202 with an actionId; the admin sees the current value next to your proposed value, and the change is refused if the live value changes before approval.";

const naira = (n: number) => `₦${n.toLocaleString()}`;

const TRAFFIC_RULE_FIELDS = ["label", "daysOfWeek", "startMinute", "endMinute", "startDate", "endDate", "multiplier", "isEnabled"];

export const getPricingConfigTool = defineReadTool({
  name: "get_pricing_config",
  description:
    "Get Pantra's entire live pricing configuration in one call: per-tier rates for standard/comfort/xl (base fare, per-km, per-minute, minimum fare, booking and service fees, all NGN), time-based traffic multiplier rules, the priority-matching fee, dynamic surge settings, the platform commission rate (a decimal fraction, 0.1 = 10%), the waiting charge, and the cancellation fee schedule. Always read this before proposing any pricing change. Read-only.",
  inputSchema: z.object({}),
  run: (db) => getPricingConfig(db),
});

export const updatePricingTierTool = defineWriteTool({
  name: "update_pricing_tier",
  description: `Propose new fare rates for one ride tier (standard, comfort or xl). All six rate fields are required — send the current value for any you aren't changing (read get_pricing_config first). ${LIVE_IMPACT}`,
  inputSchema: updatePricingTierInput,
  summarize: (input) =>
    `Set ${input.id} tier: base ${naira(input.base)}, ${naira(input.perKm)}/km, ${naira(input.perMin)}/min, min ${naira(
      input.minFare
    )}, booking ${naira(input.bookingFee)}, service ${naira(input.serviceFee)}`,
  snapshot: async (db, input) => {
    const { data, error } = await db.from("pricing_tier_config").select("*").eq("id", input.id).single();
    if (error || !data) throw new Error(`Pricing tier '${input.id}' not found.`);
    return pick(data, Object.keys(tierRateFields.shape));
  },
  run: (db, input) => updatePricingTier(db, input),
});

export const createTrafficRuleTool = defineWriteTool({
  name: "create_traffic_rule",
  description: `Propose a new time-based fare multiplier rule (e.g. a rush-hour or public-holiday surcharge). It applies on the given days and daily window, optionally bounded by start/end dates. ${LIVE_IMPACT}`,
  inputSchema: createTrafficRuleInput,
  summarize: (input) => `Create traffic rule "${input.label}" at ×${input.multiplier}${input.isEnabled ? "" : " (disabled)"}`,
  run: (db, input) => createTrafficRule(db, input),
});

export const updateTrafficRuleTool = defineWriteTool({
  name: "update_traffic_rule",
  description: `Propose changes to an existing traffic multiplier rule; only the fields you send are changed. Use isEnabled=false to switch a rule off without deleting it. ${LIVE_IMPACT}`,
  inputSchema: updateTrafficRuleInput,
  summarize: (input) => {
    const { id, ...changes } = input;
    return `Update traffic rule ${id}: ${Object.keys(changes).join(", ") || "no fields"}`;
  },
  validate: (input) => (Object.keys(input).length <= 1 ? "Provide at least one field to change." : undefined),
  snapshot: async (db, input) => {
    const { data, error } = await db.from("traffic_multiplier_rules").select("*").eq("id", input.id).single();
    if (error || !data) throw new Error("Traffic rule not found.");
    return pick(data, Object.keys(input).filter((k) => k !== "id"));
  },
  run: (db, input) => updateTrafficRule(db, input),
});

export const deleteTrafficRuleTool = defineWriteTool({
  name: "delete_traffic_rule",
  description: `Propose PERMANENTLY deleting a traffic multiplier rule. This cannot be undone — prefer update_traffic_rule with isEnabled=false to pause a rule. ${LIVE_IMPACT}`,
  inputSchema: deleteTrafficRuleInput,
  irreversible: true,
  summarize: (input) => `Permanently delete traffic rule ${input.id}`,
  snapshot: async (db, input) => {
    const { data, error } = await db.from("traffic_multiplier_rules").select("*").eq("id", input.id).single();
    if (error || !data) throw new Error("Traffic rule not found.");
    return pick(data, TRAFFIC_RULE_FIELDS);
  },
  run: (db, input) => deleteTrafficRule(db, input),
});

// Single-row configs: the agent never needs (or sees) the row id — the tool
// looks up the one live row itself.
function singleRowConfigTool<S extends z.ZodObject<any>>(opts: {
  name: string;
  description: string;
  table: SingleRowPricingTable;
  fields: S;
  summarize: (input: z.infer<S>) => string;
  validate?: (input: z.infer<S>) => string | undefined;
  update: (db: SupabaseClient, input: z.infer<S> & { id: string }) => Promise<unknown>;
}): WriteTool<S> {
  return defineWriteTool({
    name: opts.name,
    description: `${opts.description} ${LIVE_IMPACT}`,
    inputSchema: opts.fields,
    summarize: opts.summarize,
    validate: opts.validate,
    snapshot: async (db, input) => pick(await getSingleRowConfig(db, opts.table), Object.keys(input)),
    run: async (db, input) => {
      const row = await getSingleRowConfig(db, opts.table);
      return opts.update(db, { ...input, id: row.id });
    },
  });
}

export const updatePriorityFeeTool = singleRowConfigTool({
  name: "update_priority_fee",
  description: "Propose a new flat fee for priority matching (riders pay it to be matched first), and whether the option is offered at all.",
  table: SINGLE_ROW_PRICING_TABLES.priority,
  fields: priorityFeeFields,
  summarize: (input) => `Set priority fee to ${naira(input.fee)}${input.isEnabled ? "" : " (disabled)"}`,
  update: updatePriorityFee,
});

export const updateSurgeConfigTool = singleRowConfigTool({
  name: "update_surge_config",
  description:
    "Propose new dynamic surge pricing settings. All fields are required — send the current value for any you aren't changing (read get_pricing_config first). maxMultiplier must be at least minMultiplier.",
  table: SINGLE_ROW_PRICING_TABLES.surge,
  fields: surgeFields,
  summarize: (input) =>
    `Set surge ×${input.minMultiplier}–×${input.maxMultiplier}, demand ratios ${input.lowDemandRatio}–${input.highDemandRatio}${
      input.isEnabled ? "" : " (disabled)"
    }`,
  validate: (input) => (input.maxMultiplier < input.minMultiplier ? "maxMultiplier must be at least minMultiplier." : undefined),
  update: updateSurgeConfig,
});

export const updateCommissionRateTool = singleRowConfigTool({
  name: "update_commission_rate",
  description:
    "Propose a new platform commission rate — the share of each ride's metered fare Pantra keeps; the driver earns the rest. It is a DECIMAL FRACTION (0.12 = 12%). Applies only to rides settled after approval. This directly changes every driver's earnings — explain the impact in your rationale.",
  table: SINGLE_ROW_PRICING_TABLES.commission,
  fields: commissionFields,
  summarize: (input) => `Set platform commission to ${(input.rate * 100).toFixed(1)}%`,
  update: updateCommissionRate,
});

export const updateWaitingChargeTool = singleRowConfigTool({
  name: "update_waiting_charge",
  description: "Propose a new waiting charge: free minutes after the driver arrives, then a per-minute rate for any extra wait.",
  table: SINGLE_ROW_PRICING_TABLES.waitingCharge,
  fields: waitingChargeFields,
  summarize: (input) => `Set waiting charge: ${input.graceMinutes} free min, then ${naira(input.perMinuteRate)}/min`,
  update: updateWaitingCharge,
});

export const updateCancellationFeeTool = singleRowConfigTool({
  name: "update_cancellation_fee",
  description: "Propose a new rider cancellation fee schedule: a free window after the driver accepts, then a fee before arrival and a fee after arrival.",
  table: SINGLE_ROW_PRICING_TABLES.cancellationFee,
  fields: cancellationFeeFields,
  summarize: (input) =>
    `Set cancellation fees: free for ${input.freeWindowSeconds}s, ${naira(input.afterAcceptFee)} after accept, ${naira(
      input.afterArrivalFee
    )} after arrival`,
  update: updateCancellationFee,
});
