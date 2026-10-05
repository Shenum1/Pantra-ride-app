import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyDriverOfVerificationDecision } from "../../trpc/lib/push-notify";
import { recomputeDriverVerificationStatus } from "../verification/engine";
import { resolveRequiredDocuments, type VerificationRequirementRow } from "@/lib/driver-verification-config";

const DOCUMENTS_BUCKET = "documents";

export const listDriversForVerificationInput = z.object({
  status: z
    .enum(["DOCUMENTS_SUBMITTED", "VERIFYING", "MANUAL_REVIEW", "all"])
    .optional()
    .describe(
      "Verification status to filter by. Defaults to MANUAL_REVIEW, the queue of drivers waiting on an admin decision. 'all' returns every driver who has started verification."
    ),
});

export async function listDriversForVerification(db: SupabaseClient, input: z.infer<typeof listDriversForVerificationInput> | undefined) {
  const statusFilter = input?.status ?? "MANUAL_REVIEW";

  let query = db
    .from("drivers")
    .select(
      "id, name, email, fullLegalName, operatingState, vehicleCategory, verificationStatus, verificationProgress, verificationStatusUpdatedAt, rejectionReason"
    )
    .order("verificationStatusUpdatedAt", { ascending: false })
    .limit(100);

  if (statusFilter === "all") {
    query = query.in("verificationStatus", ["DOCUMENTS_SUBMITTED", "VERIFYING", "MANUAL_REVIEW", "REJECTED", "VERIFIED"]);
  } else {
    query = query.eq("verificationStatus", statusFilter);
  }

  const { data: drivers, error } = await query;
  if (error) throw new Error(error.message);

  return { drivers: drivers ?? [] };
}

export const getDriverVerificationDetailInput = z.object({
  driverId: z.string().uuid().describe("UUID of the driver (drivers.id, not the auth user id)."),
});

export async function getDriverVerificationDetail(
  db: SupabaseClient,
  input: z.infer<typeof getDriverVerificationDetailInput>,
  opts: { includeSignedUrls?: boolean } = {}
) {
  const includeSignedUrls = opts.includeSignedUrls ?? true;

  const { data: driver, error: driverError } = await db
    .from("drivers")
    .select(
      "id, name, email, phone, operatingState, vehicleCategory, verificationStatus, verificationProgress, verificationStatusUpdatedAt, rejectionReason, emailVerifiedAt, vehiclePlateNumber, profileImage, vehicle"
    )
    .eq("id", input.driverId)
    .single();

  if (driverError || !driver) throw new Error("Driver not found.");

  let requiredDocuments: string[] = [];
  if (driver.operatingState && driver.vehicleCategory) {
    const { data: requirementRows } = await db
      .from("driver_verification_requirements")
      .select("state, vehicleCategory, documentType, isRequired, isActive")
      .eq("state", driver.operatingState)
      .eq("vehicleCategory", driver.vehicleCategory);

    requiredDocuments = resolveRequiredDocuments(
      driver.operatingState,
      driver.vehicleCategory,
      (requirementRows ?? []) as VerificationRequirementRow[]
    );
  }

  const { data: documents } = await db
    .from("driver_documents")
    .select("id, type, documentUrl, status, uploadedAt, reviewedAt, rejectionReason, expiryDate")
    .eq("driverId", input.driverId)
    .order("uploadedAt", { ascending: false });

  const documentsWithSignedUrls = await Promise.all(
    (documents ?? []).map(async (doc) => {
      let signedUrl: string | null = null;
      if (includeSignedUrls && doc.documentUrl) {
        const { data: signed } = await db.storage.from(DOCUMENTS_BUCKET).createSignedUrl(doc.documentUrl, 3600);
        signedUrl = signed?.signedUrl ?? null;
      }
      return { ...doc, signedUrl };
    })
  );

  const { data: checks } = await db
    .from("driver_document_verification_checks")
    .select("id, documentId, checkType, status, provider, providerReferenceId, resultDetails, checkedAt")
    .eq("driverId", input.driverId)
    .order("checkedAt", { ascending: false });

  const { data: auditLog } = await db
    .from("driver_verification_audit_log")
    .select("id, actorType, actorId, eventType, fromStatus, toStatus, documentId, reason, createdAt")
    .eq("driverId", input.driverId)
    .order("createdAt", { ascending: false })
    .limit(100);

  return {
    driver,
    requiredDocuments,
    documents: documentsWithSignedUrls,
    checks: checks ?? [],
    auditLog: auditLog ?? [],
  };
}

export const decideDriverVerificationInput = z.object({
  driverId: z.string().uuid().describe("UUID of the driver (drivers.id) the decision applies to."),
  decision: z
    .enum(["VERIFIED", "REJECTED", "MANUAL_REVIEW"])
    .describe(
      "VERIFIED lets the driver go online and accept trips. REJECTED blocks them (they are notified with the reason). MANUAL_REVIEW flags them for further human review."
    ),
  reason: z
    .string()
    .optional()
    .describe("Reason shown to the driver. Expected for REJECTED and MANUAL_REVIEW; ignored for VERIFIED."),
});

// The only path (besides the disabled-by-default auto-approve path in
// backend/services/verification/engine.ts) that can move a driver to VERIFIED.
// Given no live authenticity provider is configured in this deployment, every
// driver who completes the checklist lands in MANUAL_REVIEW and requires this
// explicit admin action to reach VERIFIED.
export async function decideDriverVerification(
  db: SupabaseClient,
  actorAdminId: string,
  input: z.infer<typeof decideDriverVerificationInput>
) {
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
    actorId: actorAdminId,
    eventType: "ADMIN_DECISION",
    fromStatus: before.verificationStatus,
    toStatus: input.decision,
    reason: input.reason ?? null,
  });

  // Fire-and-forget: a failed push must never fail the decision itself —
  // the DB update and audit log above are already committed by this point.
  if (input.decision === "VERIFIED" || input.decision === "REJECTED") {
    void notifyDriverOfVerificationDecision(db, input.driverId, input.decision, input.reason).catch((e: unknown) =>
      console.error("Driver verification push notification failed:", e)
    );
  }

  return { success: true, verificationStatus: input.decision };
}

export const listDriverDocumentsInput = z.object({
  status: z
    .enum(["pending", "approved", "rejected", "all"])
    .optional()
    .describe("Document review status to filter by. Defaults to pending (the documents awaiting review)."),
});

export async function listDriverDocuments(
  db: SupabaseClient,
  input: z.infer<typeof listDriverDocumentsInput> | undefined,
  opts: { includeSignedUrls?: boolean } = {}
) {
  const includeSignedUrls = opts.includeSignedUrls ?? true;
  const statusFilter = input?.status ?? "pending";

  let query = db
    .from("driver_documents")
    .select("id, driverId, type, documentUrl, status, uploadedAt, reviewedAt, rejectionReason, expiryDate")
    .order("uploadedAt", { ascending: false })
    .limit(100);

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data: docs, error } = await query;
  if (error) throw new Error(error.message);

  const driverIds = Array.from(new Set((docs ?? []).map((d) => d.driverId).filter(Boolean)));

  const driversRes = driverIds.length
    ? await db.from("drivers").select("id, name, email").in("id", driverIds)
    : { data: [] as { id: string; name: string | null; email: string | null }[] };

  const driverMap = new Map((driversRes.data ?? []).map((d) => [d.id, d]));

  const documents = await Promise.all(
    (docs ?? []).map(async (doc) => {
      const driver = driverMap.get(doc.driverId);
      let signedUrl: string | null = null;

      if (includeSignedUrls && doc.documentUrl && doc.documentUrl !== "system_generated") {
        const { data: signed } = await db.storage.from(DOCUMENTS_BUCKET).createSignedUrl(doc.documentUrl, 3600);
        signedUrl = signed?.signedUrl ?? null;
      }

      return {
        id: doc.id,
        driverId: doc.driverId,
        driverName: driver?.name || driver?.email || doc.driverId,
        driverEmail: driver?.email ?? "",
        type: doc.type,
        status: doc.status,
        uploadedAt: doc.uploadedAt,
        reviewedAt: doc.reviewedAt,
        rejectionReason: doc.rejectionReason,
        expiryDate: doc.expiryDate,
        signedUrl,
      };
    })
  );

  return { documents };
}

export const reviewDriverDocumentInput = z.object({
  documentId: z.string().describe("ID of the driver_documents row being reviewed."),
  action: z.enum(["approve", "reject"]).describe("approve accepts the document; reject marks it invalid so the driver must re-upload."),
  rejectionReason: z.string().optional().describe("Reason shown to the driver when action is reject."),
});

export async function reviewDriverDocument(
  db: SupabaseClient,
  actorAdminId: string,
  input: z.infer<typeof reviewDriverDocumentInput>
) {
  const { data: doc, error: docError } = await db
    .from("driver_documents")
    .select("id, driverId")
    .eq("id", input.documentId)
    .single();

  if (docError || !doc) throw new Error("Document not found.");

  const updates: Record<string, unknown> = {
    status: input.action === "approve" ? "approved" : "rejected",
    reviewedAt: new Date().toISOString(),
    reviewedBy: actorAdminId,
  };
  if (input.action === "reject") {
    updates.rejectionReason = input.rejectionReason || "Document rejected";
  } else {
    updates.rejectionReason = null;
  }

  const { error: updateError } = await db.from("driver_documents").update(updates).eq("id", input.documentId);
  if (updateError) throw new Error(updateError.message);

  // Driver-level status is entirely owned by the verification engine — this
  // only ever mutates the single driver_documents row above, then delegates
  // the recompute to the same single source of truth used by every other
  // event in the pipeline (see engine.ts).
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
}
