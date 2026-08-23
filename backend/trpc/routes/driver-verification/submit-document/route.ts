import { z } from "zod";
import { driverProcedure } from "../../../create-context";
import { runDocumentChecks, recomputeDriverVerificationStatus } from "@/backend/services/verification/engine";

// Kept as a literal list (not imported from lib/driver-verification-config's
// RequiredDocumentType[]) because zod's enum needs a fixed tuple type at compile
// time — mirror ALL_DOCUMENT_TYPES there if this list ever changes.
const inputSchema = z.object({
  type: z.enum([
    "drivers_license_front",
    "drivers_license_back",
    "driver_selfie",
    "vehicle_registration",
    "proof_of_ownership",
    "insurance",
    "roadworthiness",
  ]),
  storagePath: z.string().min(1),
  expiryDate: z.string().optional(),
});

export default driverProcedure.input(inputSchema).mutation(async ({ ctx, input }) => {
  const db = ctx.supabaseAdmin;

  // The file itself is already uploaded client-side to the private "documents"
  // Storage bucket under drivers/<driverId>/... (Storage RLS already scopes drivers
  // to their own folder — see database/schemas/supabase-schema-driver-documents.sql).
  // This procedure only ever writes the row via the service-role client, so the
  // insert + the checks it triggers happen atomically from the caller's point of view.
  const { data: document, error: insertError } = await db
    .from("driver_documents")
    .insert({
      driverId: ctx.driverId,
      type: input.type,
      documentUrl: input.storagePath,
      status: "pending",
      uploadedAt: new Date().toISOString(),
      expiryDate: input.expiryDate ?? null,
    })
    .select("id")
    .single();

  if (insertError || !document) throw new Error(insertError?.message ?? "Failed to record document.");

  await db.from("driver_verification_audit_log").insert({
    driverId: ctx.driverId,
    actorType: "driver",
    actorId: ctx.driverUserId,
    eventType: "DOCUMENT_SUBMITTED",
    documentId: document.id,
    metadata: { type: input.type },
  });

  await runDocumentChecks(db, document.id);
  await recomputeDriverVerificationStatus(db, ctx.driverId);

  const { data: updated } = await db
    .from("drivers")
    .select("verificationStatus")
    .eq("id", ctx.driverId)
    .single();

  return { success: true, documentId: document.id, verificationStatus: updated?.verificationStatus ?? "PENDING" };
});
