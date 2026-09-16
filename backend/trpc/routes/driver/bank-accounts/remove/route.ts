import { z } from "zod";
import { driverProcedure } from "../../../../create-context";

// Ownership is verified explicitly (never trust RLS here — this table's RLS
// was revoked entirely, so a stray query with no .eq("driverId", ...) would
// happily delete any driver's bank account).
export default driverProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    // A bank account referenced by a payout that's still in flight can't be
    // removed — there is no "edit" route on this table at all (only
    // add/remove), so this is the one place a driver could otherwise pull
    // the destination out from under an already-processing automatic
    // transfer. Once a payout resolves (completed/failed/reversed) the
    // account is free to remove again.
    const { data: activePayouts, error: activePayoutsError } = await ctx.supabaseAdmin
      .from("driver_payouts")
      .select("id")
      .eq("bankAccountId", input.id)
      .in("status", ["pending", "processing", "manual_review"])
      .limit(1);
    if (activePayoutsError) throw new Error(activePayoutsError.message);
    if (activePayouts && activePayouts.length > 0) {
      throw new Error("This bank account has a payout in progress and cannot be removed until it completes.");
    }

    const { error } = await ctx.supabaseAdmin
      .from("driver_bank_accounts")
      .delete()
      .eq("id", input.id)
      .eq("driverId", ctx.driverId);

    if (error) throw new Error(error.message);
    return { success: true };
  });
