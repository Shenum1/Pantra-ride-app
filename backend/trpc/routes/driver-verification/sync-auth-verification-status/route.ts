import { driverProcedure } from "../../../create-context";
import { recomputeDriverVerificationStatus } from "@/backend/services/verification/engine";

// Re-reads the caller's OWN Supabase Auth record server-side (never trusts a
// client-asserted "I verified my phone/email" claim) and mirrors phone_confirmed_at /
// email_confirmed_at onto drivers.phoneVerifiedAt / emailVerifiedAt. Call this right
// after the existing rider-pattern OTP flow (supabase.auth.verifyOtp) succeeds, and
// opportunistically on driver app bootstrap.
export default driverProcedure.mutation(async ({ ctx }) => {
  const db = ctx.supabaseAdmin;

  const { data: userData, error: userError } = await db.auth.getUser(ctx.authToken);
  if (userError || !userData.user) throw new Error("Could not read auth session.");

  const phoneVerifiedAt = userData.user.phone_confirmed_at ?? null;
  const emailVerifiedAt = userData.user.email_confirmed_at ?? null;

  const { data: before } = await db
    .from("drivers")
    .select("phoneVerifiedAt, emailVerifiedAt")
    .eq("id", ctx.driverId)
    .single();

  const { error: updateError } = await db
    .from("drivers")
    .update({ phoneVerifiedAt, emailVerifiedAt })
    .eq("id", ctx.driverId);
  if (updateError) throw new Error(updateError.message);

  if (phoneVerifiedAt && !before?.phoneVerifiedAt) {
    await db.from("driver_verification_audit_log").insert({
      driverId: ctx.driverId,
      actorType: "system",
      eventType: "PHONE_VERIFIED",
    });
  }
  if (emailVerifiedAt && !before?.emailVerifiedAt) {
    await db.from("driver_verification_audit_log").insert({
      driverId: ctx.driverId,
      actorType: "system",
      eventType: "EMAIL_VERIFIED",
    });
  }

  await recomputeDriverVerificationStatus(db, ctx.driverId);

  return { success: true, phoneVerifiedAt, emailVerifiedAt };
});
