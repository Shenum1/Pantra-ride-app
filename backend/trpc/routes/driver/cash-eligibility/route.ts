import { driverProcedure } from "../../../create-context";
import { getCashCommissionStatus } from "../../../../lib/cash-commission";

// The driver's cash-commission position: how much they owe Pantra, and
// whether that's over the limit (platform_commission_config.cashDebtLimit)
// that pauses cash rides. The app uses this to hide cash rides and show the
// "Pay now" prompt; the database enforces the same rule independently when
// a ride is accepted (rides_cash_dispatch_guard in
// supabase-schema-cash-commission-settlement.sql).
export default driverProcedure.query(async ({ ctx }) => {
  return getCashCommissionStatus(ctx.supabaseAdmin, ctx.driverId);
});
