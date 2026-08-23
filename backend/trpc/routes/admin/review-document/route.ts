import { z } from "zod";
import { adminProcedure } from "../../../create-context";
import { recomputeDriverVerificationStatus } from "@/backend/services/verification/engine";

export default adminProcedure
  .input(
    z.object({
      documentId: z.string(),
      action: z.enum(["approve", "reject"]),
      rejectionReason: z.string().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;

    const { data: doc, error: docError } = await db
      .from("driver_documents")
      .select("id, driverId")
      .eq("id", input.documentId)
      .single();

    if (docError || !doc) throw new Error("Document not found.");

    const updates: Record<string, unknown> = {
      status: input.action === "approve" ? "approved" : "rejected",
      reviewedAt: new Date().toISOString(),
      reviewedBy: ctx.adminUserId,
    };
    if (input.action === "reject") {
      updates.rejectionReason = input.rejectionReason || "Document rejected";
    } else {
      updates.rejectionReason = null;
    }

    const { error: updateError } = await db.from("driver_documents").update(updates).eq("id", input.documentId);
    if (updateError) throw new Error(updateError.message);

    // Driver-level status is entirely owned by the verification engine — this route
    // only ever mutates the single driver_documents row above, then delegates the
    // recompute (including whatever effect an admin rejection should have on the
    // driver's overall verificationStatus) to the same single source of truth used
    // by every other event in the pipeline (see engine.ts).
    await recomputeDriverVerificationStatus(db, doc.driverId);

    const { data: driver } = await db
      .from("drivers")
      .select("isVerified, verificationProgress, verificationStatus")
      .eq("id", doc.driverId)
      .single();

    return {
      success: true,
      isVerified: driver?.isVerified ?? false,
      verificationProgress: driver?.verificationProgress ?? 0,
      verificationStatus: driver?.verificationStatus ?? "PENDING",
    };
  });
