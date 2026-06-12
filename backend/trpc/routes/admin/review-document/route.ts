import { z } from "zod";
import { adminProcedure } from "../../../create-context";

const REQUIRED_DOCUMENT_TYPES = ["license", "insurance", "registration", "background_check", "vehicle_inspection"];

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

    const { data: allDocs } = await db
      .from("driver_documents")
      .select("type, status")
      .eq("driverId", doc.driverId);

    const approvedTypes = new Set((allDocs ?? []).filter((d) => d.status === "approved").map((d) => d.type));
    const completed = REQUIRED_DOCUMENT_TYPES.filter((t) => approvedTypes.has(t)).length;
    const verificationProgress = (completed / REQUIRED_DOCUMENT_TYPES.length) * 100;
    const isVerified = completed === REQUIRED_DOCUMENT_TYPES.length;

    await db.from("drivers").update({ isVerified, verificationProgress }).eq("id", doc.driverId);

    return { success: true, isVerified, verificationProgress };
  });
