import { driverProcedure } from "../../../create-context";
import { checkExpiry } from "@/backend/services/verification/engine";

// Called opportunistically (app open / before going online) since this stack has no
// cron/scheduler for a background expiry sweep — see engine.ts's checkExpiry.
export default driverProcedure.mutation(async ({ ctx }) => {
  await checkExpiry(ctx.supabaseAdmin, ctx.driverId);

  const { data: driver } = await ctx.supabaseAdmin
    .from("drivers")
    .select("verificationStatus")
    .eq("id", ctx.driverId)
    .single();

  return { success: true, verificationStatus: driver?.verificationStatus ?? "PENDING" };
});
