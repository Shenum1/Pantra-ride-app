import { z } from "zod";
import { authedProcedure } from "../../../../create-context";
import { TIP_CONFIG, isTipAmountValid } from "../../../../../../lib/pricing-config";
import { notifyDriverOfTip } from "../../../../lib/push-notify";

// The only path allowed to create a tip. Never trusts the client beyond
// "which ride/driver are you claiming this is for" — create_tip()
// (database/schemas/supabase-schema-tips.sql) re-resolves and re-verifies
// ride ownership, driver match, ride status/paymentStatus, and the tip
// window entirely server-side before ever touching the wallet.
export default authedProcedure
  .input(
    z.object({
      rideId: z.string().uuid(),
      driverId: z.string().uuid(),
      amount: z.number(),
      idempotencyKey: z.string().uuid(),
      paymentMethod: z.literal("wallet").default("wallet"),
    })
  )
  .mutation(async ({ ctx, input }) => {
    if (!isTipAmountValid(input.amount, TIP_CONFIG)) {
      return {
        status: false as const,
        message: `Tip must be a whole amount between ₦${TIP_CONFIG.minAmount} and ₦${TIP_CONFIG.maxAmount}.`,
      };
    }

    const { data, error } = await ctx.supabaseAdmin.rpc("create_tip", {
      p_rider_id: ctx.userId,
      p_ride_id: input.rideId,
      p_driver_id: input.driverId,
      p_amount: input.amount,
      p_payment_method: input.paymentMethod,
      p_idempotency_key: input.idempotencyKey,
    });

    if (error) {
      console.error("create_tip failed:", error.message);

      const message = /insufficient balance/i.test(error.message)
        ? "Insufficient wallet balance. Please add funds or choose another payment method."
        : /tip window has closed/i.test(error.message)
          ? "Tipping has closed for this ride."
          : /ride is not completed|ride payment is not settled|does not belong|does not match|driver not found|ride not found/i.test(error.message)
            ? "This ride is not eligible for a tip."
            : /invalid tip amount/i.test(error.message)
              ? `Tip must be a whole amount between ₦${TIP_CONFIG.minAmount} and ₦${TIP_CONFIG.maxAmount}.`
              : "Could not send tip. Please try again.";

      return { status: false as const, message };
    }

    const row = Array.isArray(data) ? data[0] : data;

    void notifyDriverOfTip(ctx.supabaseAdmin, row.driverId, row.amount, row.rideId).catch((e: unknown) =>
      console.error("Tip push notification failed:", e)
    );

    return { status: true as const, message: "Tip sent", tip: row };
  });
