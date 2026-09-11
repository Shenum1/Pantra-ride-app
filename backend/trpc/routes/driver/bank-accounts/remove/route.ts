import { z } from "zod";
import { driverProcedure } from "../../../../create-context";

// Ownership is verified explicitly (never trust RLS here — this table's RLS
// was revoked entirely, so a stray query with no .eq("driverId", ...) would
// happily delete any driver's bank account).
export default driverProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const { error } = await ctx.supabaseAdmin
      .from("driver_bank_accounts")
      .delete()
      .eq("id", input.id)
      .eq("driverId", ctx.driverId);

    if (error) throw new Error(error.message);
    return { success: true };
  });
