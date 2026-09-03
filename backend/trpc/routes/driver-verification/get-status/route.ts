import { driverProcedure } from "../../../create-context";
import {
  resolveRequiredDocuments,
  type VerificationRequirementRow,
} from "@/lib/driver-verification-config";

export default driverProcedure.query(async ({ ctx }) => {
  const db = ctx.supabaseAdmin;

  const { data: driver, error: driverError } = await db
    .from("drivers")
    .select(
      "id, verificationStatus, verificationProgress, rejectionReason, operatingState, vehicleCategory, emailVerifiedAt, fullLegalName, dateOfBirth, licenseNumber, licenseCategory, licenseIssueDate, licenseExpiryDate, vehiclePlateNumber, vehicleVin, vehicleEngineNumber"
    )
    .eq("id", ctx.driverId)
    .single();

  if (driverError || !driver) throw new Error("Driver profile not found.");

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

  interface DocumentRow {
    id: string;
    type: string;
    status: string;
    rejectionReason: string | null;
    expiryDate: string | null;
    uploadedAt: string;
  }

  const { data: documents } = await db
    .from("driver_documents")
    .select("id, type, status, rejectionReason, expiryDate, uploadedAt")
    .eq("driverId", ctx.driverId)
    .order("uploadedAt", { ascending: false })
    .returns<DocumentRow[]>();

  const latestDocumentByType = new Map<string, DocumentRow>();
  for (const doc of documents ?? []) {
    if (!latestDocumentByType.has(doc.type)) {
      latestDocumentByType.set(doc.type, doc);
    }
  }

  const { data: checks } = await db
    .from("driver_document_verification_checks")
    .select("documentId, checkType, status, checkedAt")
    .eq("driverId", ctx.driverId)
    .order("checkedAt", { ascending: false });

  const latestCheckByDocAndType = new Map<string, string>();
  for (const check of checks ?? []) {
    const key = `${check.documentId}:${check.checkType}`;
    if (!latestCheckByDocAndType.has(key)) {
      latestCheckByDocAndType.set(key, check.status);
    }
  }

  const requiredDocumentDetails = requiredDocuments.map((type) => {
    const doc = latestDocumentByType.get(type);
    return {
      type,
      isSubmitted: !!doc,
      documentStatus: doc?.status ?? null,
      rejectionReason: doc?.rejectionReason ?? null,
      expiryDate: doc?.expiryDate ?? null,
      checks: doc
        ? {
            format: latestCheckByDocAndType.get(`${doc.id}:format`) ?? "pending",
            ocrConsistency: latestCheckByDocAndType.get(`${doc.id}:ocr_consistency`) ?? "pending",
            authenticity: latestCheckByDocAndType.get(`${doc.id}:authenticity`) ?? null,
          }
        : null,
    };
  });

  return {
    verificationStatus: driver.verificationStatus,
    verificationProgress: driver.verificationProgress,
    rejectionReason: driver.rejectionReason,
    operatingState: driver.operatingState,
    vehicleCategory: driver.vehicleCategory,
    emailVerifiedAt: driver.emailVerifiedAt,
    profile: {
      fullLegalName: driver.fullLegalName,
      dateOfBirth: driver.dateOfBirth,
      licenseNumber: driver.licenseNumber,
      licenseCategory: driver.licenseCategory,
      licenseIssueDate: driver.licenseIssueDate,
      licenseExpiryDate: driver.licenseExpiryDate,
      vehiclePlateNumber: driver.vehiclePlateNumber,
      vehicleVin: driver.vehicleVin,
      vehicleEngineNumber: driver.vehicleEngineNumber,
    },
    requiredDocuments: requiredDocumentDetails,
  };
});
