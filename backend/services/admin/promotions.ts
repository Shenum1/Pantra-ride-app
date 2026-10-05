import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

export const listPromotionsInput = z.object({
  activeOnly: z.boolean().optional().describe("If true, only return promo codes that are currently switched on."),
  limit: z.number().int().min(1).max(100).default(50).describe("Maximum number of promo codes to return (1-100)."),
  offset: z.number().int().min(0).default(0).describe("Number of promo codes to skip, for pagination."),
});

export async function listPromotions(db: SupabaseClient, input: z.infer<typeof listPromotionsInput> | undefined) {
  const limit = input?.limit ?? 50;
  const offset = input?.offset ?? 0;

  let query = db
    .from("promotions")
    .select("*", { count: "exact" })
    .order("createdAt", { ascending: false })
    .range(offset, offset + limit - 1);

  if (input?.activeOnly) {
    query = query.eq("isActive", true);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { promotions: data ?? [], total: count ?? 0 };
}

export const createPromotionInput = z.object({
  code: z.string().min(3).max(20).describe("The code riders type in, 3-20 characters. Stored uppercase."),
  description: z.string().min(1).describe("Rider-facing description of the offer."),
  discountPercentage: z.number().min(0).max(100).describe("Percentage off the fare, 0-100 (e.g. 15 = 15% off)."),
  maxDiscountNGN: z.number().min(0).optional().describe("Optional cap on the discount per ride, in NGN. Omit for uncapped."),
  maxUses: z.number().int().min(1).optional().describe("Optional total redemption limit across all riders. Omit for unlimited."),
  validFrom: z.string().optional().describe("Optional start of validity, ISO 8601 timestamp. Omit to start immediately."),
  validUntil: z.string().describe("End of validity, ISO 8601 date or timestamp."),
  isActive: z.boolean().default(true).describe("Whether the code can be redeemed as soon as it's created."),
});

export async function createPromotion(db: SupabaseClient, input: z.infer<typeof createPromotionInput>) {
  const { error } = await db.from("promotions").insert({
    code: input.code.toUpperCase(),
    description: input.description,
    discountPercentage: input.discountPercentage,
    maxDiscountNGN: input.maxDiscountNGN ?? null,
    maxUses: input.maxUses ?? null,
    validFrom: input.validFrom,
    validUntil: input.validUntil,
    isActive: input.isActive,
  });
  if (error) throw new Error(error.message);
  return { success: true };
}

export const updatePromotionInput = z.object({
  id: z.string().uuid().describe("UUID of the promo code to update. The code text itself can't be changed."),
  description: z.string().min(1).optional().describe("New rider-facing description."),
  discountPercentage: z.number().min(0).max(100).optional().describe("New percentage off, 0-100."),
  maxDiscountNGN: z.number().min(0).nullable().optional().describe("New per-ride cap in NGN; null removes the cap."),
  maxUses: z.number().int().min(1).nullable().optional().describe("New total redemption limit; null makes it unlimited."),
  validUntil: z.string().optional().describe("New end of validity, ISO 8601 date or timestamp."),
  isActive: z
    .boolean()
    .optional()
    .describe("false deactivates the code (promo codes are never deleted, so redemption history is kept); true reactivates it."),
});

export async function updatePromotion(db: SupabaseClient, input: z.infer<typeof updatePromotionInput>) {
  const { id, ...updates } = input;
  const { error } = await db.from("promotions").update(updates).eq("id", id);
  if (error) throw new Error(error.message);
  return { success: true };
}

export const getPromotionUsageInput = z.object({
  promoId: z.string().uuid().describe("UUID of the promo code."),
  limit: z.number().int().min(1).max(100).default(50).describe("Maximum number of redemptions to return (1-100)."),
  offset: z.number().int().min(0).default(0).describe("Number of redemptions to skip, for pagination."),
});

export async function getPromotionUsage(db: SupabaseClient, input: z.infer<typeof getPromotionUsageInput>) {
  const { data, count, error } = await db
    .from("user_promo_uses")
    .select("id, userId, rideId, usedAt", { count: "exact" })
    .eq("promoId", input.promoId)
    .order("usedAt", { ascending: false })
    .range(input.offset, input.offset + input.limit - 1);

  if (error) throw new Error(error.message);

  const userIds = [...new Set((data ?? []).map((u) => u.userId).filter(Boolean))];
  const usersRes = userIds.length
    ? await db.from("users").select("uid, displayName, email").in("uid", userIds)
    : { data: [] as { uid: string; displayName: string | null; email: string | null }[] };
  const userMap = new Map((usersRes.data ?? []).map((u) => [u.uid, u.displayName || u.email || u.uid]));

  const uses = (data ?? []).map((u) => ({ ...u, userName: userMap.get(u.userId) ?? u.userId }));

  return { uses, total: count ?? 0 };
}
