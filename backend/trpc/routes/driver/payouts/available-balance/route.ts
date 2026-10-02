import { driverProcedure } from "../../../../create-context";

// The driver's withdrawable balance, computed by the same database function
// that gates payout requests (get_driver_available_balance — earnings + tips
// + cash-commission ledger − every payout still reserving money). The driver
// app displays this number instead of re-deriving it client-side: a
// client-side copy of this math is exactly what drifted before (it ignored
// payouts in manual_review and cash-commission debt), showing drivers money
// the server would then refuse to pay out.
export default driverProcedure.query(async ({ ctx }) => {
  const { data, error } = await ctx.supabaseAdmin.rpc("get_driver_available_balance", {
    driver_id: ctx.driverId,
  });
  if (error) throw new Error(error.message);
  return { availableBalance: Number(data ?? 0) };
});
