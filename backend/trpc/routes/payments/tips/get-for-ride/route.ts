import { z } from "zod";
import { authedProcedure } from "../../../../create-context";
import { TIP_CONFIG, isTipWindowOpen } from "../../../../../../lib/pricing-config";

// Single source of truth for tip eligibility, so no screen (post-completion,
// ride history, or any future entry point) has to re-derive the
// window/already-tipped logic itself.
export default authedProcedure
  .input(z.object({ rideId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    const { data: ride, error } = await ctx.supabaseAdmin
      .from("rides")
      .select("id, userId, driverId, status, paymentStatus, completedAt")
      .eq("id", input.rideId)
      .single();

    if (error || !ride) {
      return {
        eligible: false as const,
        alreadyTipped: false,
        windowExpired: false,
        driverId: null,
        existingTip: undefined,
        reason: "ride_not_found" as const,
      };
    }

    if (ride.userId !== ctx.userId) {
      return {
        eligible: false as const,
        alreadyTipped: false,
        windowExpired: false,
        driverId: ride.driverId as string | null,
        existingTip: undefined,
        reason: "not_owner" as const,
      };
    }

    const { data: existingTip } = await ctx.supabaseAdmin
      .from("tips")
      .select("id, amount, status, createdAt")
      .eq("rideId", input.rideId)
      .eq("riderId", ctx.userId)
      .eq("status", "successful")
      .order("createdAt", { ascending: false })
      .limit(1)
      .maybeSingle();

    const alreadyTipped = !!existingTip;
    const windowExpired = !isTipWindowOpen(ride.completedAt, new Date(), TIP_CONFIG);
    const settled = ride.status === "completed" && ride.paymentStatus === "paid";

    return {
      eligible: settled && !windowExpired && !alreadyTipped,
      alreadyTipped,
      windowExpired,
      driverId: ride.driverId as string | null,
      existingTip: existingTip ?? undefined,
      reason: !settled ? ("not_settled" as const) : undefined,
    };
  });
