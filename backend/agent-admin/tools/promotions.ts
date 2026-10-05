import { defineReadTool, defineWriteTool, pick } from "../types";
import {
  createPromotion,
  createPromotionInput,
  getPromotionUsage,
  getPromotionUsageInput,
  listPromotions,
  listPromotionsInput,
  updatePromotion,
  updatePromotionInput,
} from "../../services/admin/promotions";

const APPROVAL =
  "REQUIRES HUMAN APPROVAL: returns 202 with an actionId; nothing changes until an admin approves.";

export const listPromotionsTool = defineReadTool({
  name: "list_promotions",
  description:
    "List promo codes, newest first: code, description, discount percentage, optional NGN cap per ride, redemptions used vs. max allowed, validity window and whether it's active. Returns {promotions, total}. Read-only.",
  inputSchema: listPromotionsInput,
  run: (db, input) => listPromotions(db, input),
});

export const getPromotionUsageTool = defineReadTool({
  name: "get_promotion_usage",
  description:
    "List who redeemed a promo code and when (rider name, ride id, timestamp), newest first. Returns {uses, total}. Read-only.",
  inputSchema: getPromotionUsageInput,
  run: (db, input) => getPromotionUsage(db, input),
});

export const createPromotionTool = defineWriteTool({
  name: "create_promotion",
  description: `Propose a new promo code riders can apply for a percentage discount on their fare. Codes are unique and stored uppercase; promotions can later be deactivated but never deleted. ${APPROVAL}`,
  inputSchema: createPromotionInput,
  summarize: (input) =>
    `Create promo ${input.code.toUpperCase()}: ${input.discountPercentage}% off${
      input.maxDiscountNGN ? ` (max ₦${input.maxDiscountNGN.toLocaleString()})` : ""
    }, valid until ${input.validUntil}`,
  run: (db, input) => createPromotion(db, input),
});

export const updatePromotionTool = defineWriteTool({
  name: "update_promotion",
  description: `Propose changes to an existing promo code; only the fields you send are changed. Set isActive=false to deactivate a code (promotions are never deleted, so redemption history is kept). ${APPROVAL} The change is refused if the promotion changes again before approval.`,
  inputSchema: updatePromotionInput,
  summarize: (input) => {
    const { id, ...changes } = input;
    if (Object.keys(changes).length === 1 && changes.isActive !== undefined) {
      return `${changes.isActive ? "Reactivate" : "Deactivate"} promo ${id}`;
    }
    return `Update promo ${id}: ${Object.keys(changes).join(", ")}`;
  },
  validate: (input) => (Object.keys(input).length <= 1 ? "Provide at least one field to change." : undefined),
  snapshot: async (db, input) => {
    const { data, error } = await db.from("promotions").select("*").eq("id", input.id).single();
    if (error || !data) throw new Error("Promotion not found.");
    return pick(data, ["code", ...Object.keys(input).filter((k) => k !== "id")]);
  },
  run: (db, input) => updatePromotion(db, input),
});
