import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

// Single-row config tables (one live row each, see the pricing/fee/surge/
// commission schemas). The tRPC routes address these by id because admin-web
// already has the row; the agent tools look the row up instead.
export const SINGLE_ROW_PRICING_TABLES = {
  priority: "pricing_priority_config",
  surge: "surge_config",
  commission: "platform_commission_config",
  waitingCharge: "waiting_charge_config",
  cancellationFee: "cancellation_fee_config",
} as const;

export type SingleRowPricingTable = (typeof SINGLE_ROW_PRICING_TABLES)[keyof typeof SINGLE_ROW_PRICING_TABLES];

export async function getSingleRowConfig(db: SupabaseClient, table: SingleRowPricingTable) {
  const { data, error } = await db.from(table).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listPricingTiers(db: SupabaseClient) {
  const { data, error } = await db.from("pricing_tier_config").select("*").order("id");
  if (error) throw new Error(error.message);
  return { tiers: data ?? [] };
}

export async function listTrafficRules(db: SupabaseClient) {
  const { data, error } = await db.from("traffic_multiplier_rules").select("*").order("label");
  if (error) throw new Error(error.message);
  return { rules: data ?? [] };
}

export async function getPricingConfig(db: SupabaseClient) {
  const [tiers, rules, priority, surge, commission, waitingCharge, cancellationFee] = await Promise.all([
    listPricingTiers(db),
    listTrafficRules(db),
    getSingleRowConfig(db, SINGLE_ROW_PRICING_TABLES.priority),
    getSingleRowConfig(db, SINGLE_ROW_PRICING_TABLES.surge),
    getSingleRowConfig(db, SINGLE_ROW_PRICING_TABLES.commission),
    getSingleRowConfig(db, SINGLE_ROW_PRICING_TABLES.waitingCharge),
    getSingleRowConfig(db, SINGLE_ROW_PRICING_TABLES.cancellationFee),
  ]);
  return {
    tiers: tiers.tiers,
    trafficRules: rules.rules,
    priorityFee: priority,
    surge,
    commission,
    waitingCharge,
    cancellationFee,
  };
}

async function updateById(db: SupabaseClient, table: string, id: string, updates: Record<string, unknown>) {
  const { error } = await db
    .from(table)
    .update({ ...updates, updatedAt: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { success: true };
}

// --- Tier rates -------------------------------------------------------------

export const tierRateFields = z.object({
  base: z.number().min(0).describe("Flat base fare in NGN charged at the start of every trip on this tier."),
  perKm: z.number().min(0).describe("Fare in NGN per kilometre travelled."),
  perMin: z.number().min(0).describe("Fare in NGN per minute of trip duration."),
  minFare: z.number().min(0).describe("Minimum metered fare in NGN for this tier."),
  bookingFee: z.number().min(0).describe("Flat platform-owned booking fee in NGN (never surged or discounted)."),
  serviceFee: z.number().min(0).describe("Flat platform-owned service fee in NGN (never surged or discounted)."),
});

export const updatePricingTierInput = tierRateFields.extend({
  id: z.enum(["standard", "comfort", "xl"]).describe("Which ride tier to update."),
});

export function updatePricingTier(db: SupabaseClient, input: z.infer<typeof updatePricingTierInput>) {
  const { id, ...updates } = input;
  return updateById(db, "pricing_tier_config", id, updates);
}

// --- Traffic multiplier rules -----------------------------------------------

export const createTrafficRuleInput = z.object({
  label: z.string().min(1).describe("Human-readable name for the rule, e.g. 'Weekday morning rush'."),
  daysOfWeek: z
    .array(z.number().int().min(0).max(6))
    .optional()
    .describe("Days the rule applies, 0=Sunday through 6=Saturday. Omit or empty for every day."),
  startMinute: z.number().int().min(0).max(1439).optional().describe("Start of the daily window, in minutes after midnight (e.g. 420 = 07:00). Omit for all day."),
  endMinute: z.number().int().min(0).max(1439).optional().describe("End of the daily window, in minutes after midnight. Omit for all day."),
  startDate: z.string().optional().describe("Optional first date the rule is active, ISO 8601 date (YYYY-MM-DD)."),
  endDate: z.string().optional().describe("Optional last date the rule is active, ISO 8601 date (YYYY-MM-DD)."),
  multiplier: z.number().min(0.1).max(10).describe("Fare multiplier applied while the rule is active, e.g. 1.2 = +20%."),
  isEnabled: z.boolean().default(true).describe("Whether the rule is active immediately."),
});

export async function createTrafficRule(db: SupabaseClient, input: z.infer<typeof createTrafficRuleInput>) {
  const { error } = await db.from("traffic_multiplier_rules").insert({
    label: input.label,
    daysOfWeek: input.daysOfWeek ?? null,
    startMinute: input.startMinute ?? null,
    endMinute: input.endMinute ?? null,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    multiplier: input.multiplier,
    isEnabled: input.isEnabled,
  });
  if (error) throw new Error(error.message);
  return { success: true };
}

export const updateTrafficRuleInput = z.object({
  id: z.string().uuid().describe("UUID of the traffic multiplier rule to update."),
  label: z.string().min(1).optional().describe("New name for the rule."),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).nullable().optional().describe("New days, 0=Sunday through 6=Saturday; null for every day."),
  startMinute: z.number().int().min(0).max(1439).nullable().optional().describe("New window start in minutes after midnight; null for all day."),
  endMinute: z.number().int().min(0).max(1439).nullable().optional().describe("New window end in minutes after midnight; null for all day."),
  startDate: z.string().nullable().optional().describe("New first active date (YYYY-MM-DD); null to remove."),
  endDate: z.string().nullable().optional().describe("New last active date (YYYY-MM-DD); null to remove."),
  multiplier: z.number().min(0.1).max(10).optional().describe("New fare multiplier, e.g. 1.2 = +20%."),
  isEnabled: z.boolean().optional().describe("Enable or disable the rule."),
});

export function updateTrafficRule(db: SupabaseClient, input: z.infer<typeof updateTrafficRuleInput>) {
  const { id, ...updates } = input;
  return updateById(db, "traffic_multiplier_rules", id, updates);
}

export const deleteTrafficRuleInput = z.object({
  id: z.string().uuid().describe("UUID of the traffic multiplier rule to permanently delete."),
});

export async function deleteTrafficRule(db: SupabaseClient, input: z.infer<typeof deleteTrafficRuleInput>) {
  const { error } = await db.from("traffic_multiplier_rules").delete().eq("id", input.id);
  if (error) throw new Error(error.message);
  return { success: true };
}

// --- Single-row configs -----------------------------------------------------

export const priorityFeeFields = z.object({
  fee: z.number().min(0).describe("Flat NGN fee a rider pays to request priority matching."),
  isEnabled: z.boolean().describe("Whether riders can choose priority matching at all."),
});
export const updatePriorityFeeInput = priorityFeeFields.extend({ id: z.string().uuid() });

export function updatePriorityFee(db: SupabaseClient, input: z.infer<typeof updatePriorityFeeInput>) {
  return updateById(db, SINGLE_ROW_PRICING_TABLES.priority, input.id, { fee: input.fee, isEnabled: input.isEnabled });
}

export const surgeFields = z.object({
  minMultiplier: z.number().min(1).describe("Lowest surge multiplier ever applied (1 = no surge)."),
  maxMultiplier: z.number().min(1).describe("Highest surge multiplier ever applied."),
  highDemandRatio: z.number().min(0).describe("Pending-requests-to-online-drivers ratio at or above which surge reaches its maximum."),
  lowDemandRatio: z.number().min(0).describe("Ratio at or below which no surge is applied."),
  lowAcceptanceThreshold: z.number().min(0).max(1).describe("Driver acceptance rate (0-1) below which the low-acceptance bonus is added."),
  lowAcceptanceBonus: z.number().min(0).describe("Extra multiplier added to surge when acceptance falls below the threshold."),
  acceptanceLookbackMinutes: z.number().min(1).describe("How many minutes of history the acceptance rate is computed over."),
  isEnabled: z.boolean().describe("Whether dynamic surge pricing is active at all."),
});
export const updateSurgeConfigInput = surgeFields.extend({ id: z.string().uuid() });

export function updateSurgeConfig(db: SupabaseClient, input: z.infer<typeof updateSurgeConfigInput>) {
  const { id, ...updates } = input;
  return updateById(db, SINGLE_ROW_PRICING_TABLES.surge, id, updates);
}

export const commissionFields = z.object({
  rate: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "Platform commission as a DECIMAL fraction of each ride's metered fare (0.1 = 10%, NOT 10). Applies to rides settled after the change; already-settled rides keep their rate."
    ),
});
export const updateCommissionRateInput = commissionFields.extend({ id: z.string().uuid() });

export function updateCommissionRate(db: SupabaseClient, input: z.infer<typeof updateCommissionRateInput>) {
  return updateById(db, SINGLE_ROW_PRICING_TABLES.commission, input.id, { rate: input.rate });
}

export const waitingChargeFields = z.object({
  graceMinutes: z.number().min(0).describe("Free waiting minutes after the driver arrives before charging starts."),
  perMinuteRate: z.number().min(0).describe("NGN charged per minute of waiting beyond the grace period."),
});
export const updateWaitingChargeInput = waitingChargeFields.extend({ id: z.string().uuid() });

export function updateWaitingCharge(db: SupabaseClient, input: z.infer<typeof updateWaitingChargeInput>) {
  const { id, ...updates } = input;
  return updateById(db, SINGLE_ROW_PRICING_TABLES.waitingCharge, id, updates);
}

export const cancellationFeeFields = z.object({
  freeWindowSeconds: z.number().min(0).describe("Seconds after a driver accepts during which a rider can cancel for free."),
  afterAcceptFee: z.number().min(0).describe("NGN fee when a rider cancels after the free window, before the driver arrives."),
  afterArrivalFee: z.number().min(0).describe("NGN fee when a rider cancels after the driver has arrived."),
});
export const updateCancellationFeeInput = cancellationFeeFields.extend({ id: z.string().uuid() });

export function updateCancellationFee(db: SupabaseClient, input: z.infer<typeof updateCancellationFeeInput>) {
  const { id, ...updates } = input;
  return updateById(db, SINGLE_ROW_PRICING_TABLES.cancellationFee, id, updates);
}
