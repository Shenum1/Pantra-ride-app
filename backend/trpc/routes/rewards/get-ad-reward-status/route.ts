import { TRPCError } from "@trpc/server";
import { authedProcedure } from "../../../create-context";
import { AD_REWARD_POINTS, AD_REWARD_DAILY_CAP } from "../../../../../lib/ad-rewards-config";

function startOfTodayISO(): string {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

export default authedProcedure.query(async ({ ctx }) => {
  const { count, error } = await ctx.supabaseAdmin
    .from("points_transactions")
    .select("id", { count: "exact", head: true })
    .eq("userId", ctx.userId)
    .eq("type", "ad_reward")
    .gte("createdAt", startOfTodayISO());

  if (error) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
  }

  const countToday = count ?? 0;
  return {
    remainingToday: Math.max(0, AD_REWARD_DAILY_CAP - countToday),
    dailyCap: AD_REWARD_DAILY_CAP,
    pointsPerAd: AD_REWARD_POINTS,
  };
});
