import { z } from "zod";
import { adminProcedure } from "../../../../create-context";
import { resolveRequiredDocuments, type VerificationRequirementRow } from "@/lib/driver-verification-config";

const DOCUMENTS_BUCKET = "documents";

export default adminProcedure
  .input(z.object({ driverId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    const db = ctx.supabaseAdmin;

    const { data: driver, error: driverError } = await db
      .from("drivers")
      .select(
        "id, name, email, phone, fullLegalName, dateOfBirth, operatingState, vehicleCategory, verificationStatus, verificationProgress, verificationStatusUpdatedAt, rejectionReason, emailVerifiedAt, licenseNumber, licenseCategory, licenseIssueDate, licenseExpiryDate, vehiclePlateNumber, vehicleVin, vehicleEngineNumber, vehicle"
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
        if (doc.documentUrl) {
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
  });
