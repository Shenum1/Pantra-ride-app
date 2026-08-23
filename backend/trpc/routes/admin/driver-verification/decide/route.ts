import { z } from "zod";
import { adminProcedure } from "../../../../create-context";

// The only path (besides the disabled-by-default auto-approve path in
// backend/services/verification/engine.ts) that can move a driver to VERIFIED.
// Given no live authenticity provider is configured in this deployment, every
// driver who completes the checklist lands in MANUAL_REVIEW and requires this
// explicit admin action to reach VERIFIED.
export default adminProcedure
  .input(
    z.object({
      driverId: z.string().uuid(),
      decision: z.enum(["VERIFIED", "REJECTED", "MANUAL_REVIEW"]),
      reason: z.string().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;

    const { data: before, error: beforeError } = await db
      .from("drivers")
      .select("verificationStatus")
      .eq("id", input.driverId)
      .single();

    if (beforeError || !before) throw new Error("Driver not found.");

    const { error: updateError } = await db
      .from("drivers")
      .update({
        verificationStatus: input.decision,
        isVerified: input.decision === "VERIFIED",
        verificationStatusUpdatedAt: new Date().toISOString(),
        rejectionReason: input.decision === "REJECTED" || input.decision === "MANUAL_REVIEW" ? (input.reason ?? null) : null,
      })
      .eq("id", input.driverId);

    if (updateError) throw new Error(updateError.message);

    await db.from("driver_verification_audit_log").insert({
      driverId: input.driverId,
      actorType: "admin",
      actorId: ctx.adminUserId,
      eventType: "ADMIN_DECISION",
      fromStatus: before.verificationStatus,
      toStatus: input.decision,
      reason: input.reason ?? null,
    });

    return { success: true, verificationStatus: input.decision };
  });
