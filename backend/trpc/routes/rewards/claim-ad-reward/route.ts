import { TRPCError } from "@trpc/server";
import { authedProcedure } from "../../../create-context";
import { AD_REWARD_POINTS, AD_REWARD_DAILY_CAP, canClaimAdReward } from "../../../../../lib/ad-rewards-config";

const POINTS_EXPIRY_DAYS = 90;

function startOfTodayISO(): string {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

// The only path allowed to credit points for a watched rewarded ad. The
// points amount and the daily cap are both resolved and enforced here,
// server-side, using ctx.userId (from the caller's verified session token) —
// never a client-supplied amount or count. See lib/ad-rewards-config.ts and
// the security note in the driver-verification-bright-piglet plan for why
// this route exists instead of a direct client insert like the existing
// task-reward claim path.
export default authedProcedure.mutation(async ({ ctx }) => {
  const { count, error: countError } = await ctx.supabaseAdmin
    .from("points_transactions")
    .select("id", { count: "exact", head: true })
    .eq("userId", ctx.userId)
    .eq("type", "ad_reward")
    .gte("createdAt", startOfTodayISO());

  if (countError) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: countError.message });
  }

  const countToday = count ?? 0;
  if (!canClaimAdReward(countToday)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You've reached today's limit of ${AD_REWARD_DAILY_CAP} ad rewards. Come back tomorrow.`,
    });
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + POINTS_EXPIRY_DAYS);

  const { error: insertError } = await ctx.supabaseAdmin.from("points_transactions").insert({
    userId: ctx.userId,
    amount: AD_REWARD_POINTS,
    type: "ad_reward",
    referenceId: null,
    description: `Watched a rewarded ad — ${AD_REWARD_POINTS} points`,
    expiresAt: expiresAt.toISOString(),
  });

  if (insertError) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: insertError.message });
  }

  return {
    pointsEarned: AD_REWARD_POINTS,
    remainingToday: AD_REWARD_DAILY_CAP - (countToday + 1),
  };
});
