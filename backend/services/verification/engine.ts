import type { SupabaseClient } from '@supabase/supabase-js';
import { getConfiguredOcrProvider } from './ocr-provider';
import { getConfiguredAuthenticityProvider } from './authenticity-provider';
import type { DriverDocumentType } from './types';
import {
  resolveRequiredDocuments,
  type VerificationRequirementRow,
} from '@/lib/driver-verification-config';
import {
  aggregateFormatStatus,
  aggregateOcrStatus,
  aggregateAuthenticityStatus,
  decideNextStatus,
  demoteIfExpired,
  type VerificationStatus,
  type FormatCheckStatus,
  type OcrCheckStatus,
  type AuthenticityCheckStatus,
} from '@/lib/driver-verification-state-machine';

// This is the ONLY module permitted to write drivers.verificationStatus / isVerified /
// verificationStatusUpdatedAt / verificationProgress / rejectionReason — always via the
// service-role client (backend/lib/supabase-admin.ts), which the DB trigger
// protect_driver_verification_columns() requires for those columns regardless of RLS.
//
// Env vars this module reads (all server-only, none of the EXPO_PUBLIC_* client
// bundle):
//   OCR_PROVIDER, OCR_PROVIDER_API_KEY           — unset in this pass, see ocr-provider.ts
//   AUTHENTICITY_PROVIDER, AUTHENTICITY_PROVIDER_API_KEY — unset in this pass, see authenticity-provider.ts
//   AUTO_APPROVE_ON_PROVIDER_VERIFIED            — bool, default false. With no real
//     authenticity provider configured, this has no practical effect today: every
//     driver who completes the checklist lands in MANUAL_REVIEW and needs an explicit
//     admin.driverVerification.decide call to reach VERIFIED.

const LICENSE_DOCUMENT_TYPES: DriverDocumentType[] = ['drivers_license_front', 'drivers_license_back'];
const VEHICLE_AUTHENTICITY_DOCUMENT_TYPES: DriverDocumentType[] = ['vehicle_registration'];

function isAutoApproveEnabled(): boolean {
  return process.env.AUTO_APPROVE_ON_PROVIDER_VERIFIED === 'true';
}

async function writeAuditLog(
  db: SupabaseClient,
  entry: {
    driverId: string;
    actorType: 'system' | 'admin' | 'driver';
    actorId?: string | null;
    eventType:
      | 'STATUS_CHANGED'
      | 'DOCUMENT_SUBMITTED'
      | 'FORMAT_CHECK_RUN'
      | 'OCR_CHECK_RUN'
      | 'AUTHENTICITY_CHECK_RUN'
      | 'ADMIN_DECISION'
      | 'PHONE_VERIFIED'
      | 'EMAIL_VERIFIED';
    fromStatus?: string | null;
    toStatus?: string | null;
    documentId?: string | null;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await db.from('driver_verification_audit_log').insert({
    driverId: entry.driverId,
    actorType: entry.actorType,
    actorId: entry.actorId ?? null,
    eventType: entry.eventType,
    fromStatus: entry.fromStatus ?? null,
    toStatus: entry.toStatus ?? null,
    documentId: entry.documentId ?? null,
    reason: entry.reason ?? null,
    metadata: entry.metadata ?? null,
  });
  if (error) {
    // Audit logging must never block the verification pipeline itself, but it also
    // must never fail silently — surfacing it in server logs is the best available
    // option without a dedicated alerting pipeline in this stack.
    console.error('[driver-verification] failed to write audit log entry:', error.message);
  }
}

function isDateExpired(dateIso: string | null | undefined, today: Date): boolean {
  if (!dateIso) return false;
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return true; // unparsable date is treated as invalid/expired
  return date.getTime() < today.getTime();
}

/**
 * Runs the format + OCR-consistency + (where applicable) authenticity checks for a
 * single just-submitted document, and writes one row per check to
 * driver_document_verification_checks. Called synchronously from the submitDocument
 * tRPC procedure — this stack has no queue/cron infrastructure (Expo Router API
 * route, no separate server process), so the MVP engine is a synchronous call chain,
 * not a background job. This is a known scaling limitation, not an oversight.
 */
export async function runDocumentChecks(db: SupabaseClient, documentId: string): Promise<void> {
  const { data: document, error: documentError } = await db
    .from('driver_documents')
    .select('id, driverId, type, expiryDate')
    .eq('id', documentId)
    .single();

  if (documentError || !document) {
    throw new Error(`runDocumentChecks: document ${documentId} not found (${documentError?.message ?? 'no row'})`);
  }

  const { data: driver, error: driverError } = await db
    .from('drivers')
    .select('id, fullLegalName, dateOfBirth, licenseNumber, licenseCategory, vehiclePlateNumber, vehicleVin')
    .eq('id', document.driverId)
    .single();

  if (driverError || !driver) {
    throw new Error(`runDocumentChecks: driver ${document.driverId} not found (${driverError?.message ?? 'no row'})`);
  }

  const documentType = document.type as DriverDocumentType;
  const today = new Date();

  // 1. Format check — this document's own structured input (currently just
  // expiryDate, the only field submitDocument accepts besides the file itself).
  const formatStatus: FormatCheckStatus = isDateExpired(document.expiryDate, today) ? 'fail' : 'pass';
  await db.from('driver_document_verification_checks').insert({
    documentId,
    driverId: document.driverId,
    checkType: 'format',
    status: formatStatus,
    provider: 'internal-format-validator',
    resultDetails: { checkedExpiryDate: document.expiryDate ?? null },
  });
  await writeAuditLog(db, {
    driverId: document.driverId,
    actorType: 'system',
    eventType: 'FORMAT_CHECK_RUN',
    documentId,
    reason: formatStatus === 'fail' ? 'Document expiry date is invalid or already past.' : undefined,
  });

  // 2. OCR consistency check — always run (returns not_configured today, see
  // ocr-provider.ts), against whichever storage path the document points at.
  const ocrProvider = getConfiguredOcrProvider();
  const { data: storageRow } = await db
    .from('driver_documents')
    .select('documentUrl')
    .eq('id', documentId)
    .single();
  const ocrResult = await ocrProvider.extract(documentType, storageRow?.documentUrl ?? '');

  const ocrStatus: OcrCheckStatus = ocrResult.status === 'not_configured' ? 'not_configured' : 'pass';
  await db.from('driver_document_verification_checks').insert({
    documentId,
    driverId: document.driverId,
    checkType: 'ocr_consistency',
    status: ocrResult.status === 'not_configured' ? 'not_configured' : 'pass',
    provider: ocrResult.provider,
    providerReferenceId: ocrResult.providerReferenceId ?? null,
    resultDetails: { extractedFields: ocrResult.extractedFields, confidence: ocrResult.confidence ?? null },
  });
  await writeAuditLog(db, {
    driverId: document.driverId,
    actorType: 'system',
    eventType: 'OCR_CHECK_RUN',
    documentId,
    reason: ocrStatus === 'not_configured' ? 'No OCR provider configured.' : undefined,
  });

  // 3. Authenticity check — only for document types where a government-authoritative
  // check is meaningful (license, vehicle registration).
  if (LICENSE_DOCUMENT_TYPES.includes(documentType)) {
    const authenticityProvider = getConfiguredAuthenticityProvider();
    const result = await authenticityProvider.verifyDriverLicense({
      licenseNumber: driver.licenseNumber ?? '',
      fullLegalName: driver.fullLegalName ?? '',
      dateOfBirth: driver.dateOfBirth ?? '',
      licenseCategory: driver.licenseCategory ?? '',
    });
    await db.from('driver_document_verification_checks').insert({
      documentId,
      driverId: document.driverId,
      checkType: 'authenticity',
      status: result.status,
      provider: result.provider,
      providerReferenceId: result.providerReferenceId ?? null,
      resultDetails: { reason: result.reason ?? null },
    });
    await writeAuditLog(db, {
      driverId: document.driverId,
      actorType: 'system',
      eventType: 'AUTHENTICITY_CHECK_RUN',
      documentId,
      reason: result.reason,
    });
  } else if (VEHICLE_AUTHENTICITY_DOCUMENT_TYPES.includes(documentType)) {
    const authenticityProvider = getConfiguredAuthenticityProvider();
    const result = await authenticityProvider.verifyVehicleRegistration({
      plateNumber: driver.vehiclePlateNumber ?? '',
      vin: driver.vehicleVin ?? '',
      ownerFullLegalName: driver.fullLegalName ?? '',
    });
    await db.from('driver_document_verification_checks').insert({
      documentId,
      driverId: document.driverId,
      checkType: 'authenticity',
      status: result.status,
      provider: result.provider,
      providerReferenceId: result.providerReferenceId ?? null,
      resultDetails: { reason: result.reason ?? null },
    });
    await writeAuditLog(db, {
      driverId: document.driverId,
      actorType: 'system',
      eventType: 'AUTHENTICITY_CHECK_RUN',
      documentId,
      reason: result.reason,
    });
  }
}

/**
 * Runs the profile-level format check against the driver's already-persisted
 * profile fields. In practice submitProfile rejects invalid input before writing
 * anything (see backend/trpc/routes/driver-verification/submit-profile/route.ts), so
 * this almost always records 'pass' — it still exists so a profile-level format
 * check row is part of the audit trail, and so decideNextStatus has a real signal
 * rather than assuming validity.
 */
export async function runProfileFormatCheck(db: SupabaseClient, driverId: string): Promise<void> {
  const { data: driver, error } = await db
    .from('drivers')
    .select('fullLegalName, dateOfBirth, operatingState, licenseNumber, licenseIssueDate, licenseExpiryDate, vehiclePlateNumber, vehicle, vehicleVin, vehicleEngineNumber')
    .eq('id', driverId)
    .single();

  if (error || !driver) {
    throw new Error(`runProfileFormatCheck: driver ${driverId} not found (${error?.message ?? 'no row'})`);
  }

  const hasAllRequiredFields =
    !!driver.fullLegalName &&
    !!driver.dateOfBirth &&
    !!driver.operatingState &&
    !!driver.licenseNumber &&
    !!driver.licenseIssueDate &&
    !!driver.licenseExpiryDate &&
    !!driver.vehiclePlateNumber &&
    !!driver.vehicleVin &&
    !!driver.vehicleEngineNumber;

  // submitProfile already runs validateDriverProfileFormat() and rejects invalid
  // input with BAD_REQUEST before ever writing these columns — so by the time a row
  // exists here, its fields are known-valid. This check verifies presence (a driver
  // who never submitted a profile at all) rather than re-deriving format validity.
  const status: FormatCheckStatus = hasAllRequiredFields ? 'pass' : 'fail';

  await db.from('driver_document_verification_checks').insert({
    documentId: null,
    driverId,
    checkType: 'format',
    status,
    provider: 'internal-format-validator',
    resultDetails: { scope: 'profile' },
  });
  await writeAuditLog(db, {
    driverId,
    actorType: 'system',
    eventType: 'FORMAT_CHECK_RUN',
    reason: status === 'fail' ? 'Driver profile is missing required fields.' : undefined,
  });
}

/**
 * Recomputes and writes the driver's verificationStatus based on every check result
 * currently on file. This is the single function in the codebase permitted to write
 * drivers.verificationStatus / isVerified / verificationStatusUpdatedAt /
 * verificationProgress / rejectionReason — call it after every event that could
 * change the outcome (document submitted, profile submitted, document re-checked).
 */
export async function recomputeDriverVerificationStatus(db: SupabaseClient, driverId: string): Promise<void> {
  const { data: driver, error: driverError } = await db
    .from('drivers')
    .select('id, operatingState, vehicleCategory, verificationStatus, emailVerifiedAt')
    .eq('id', driverId)
    .single();

  if (driverError || !driver) {
    throw new Error(`recomputeDriverVerificationStatus: driver ${driverId} not found (${driverError?.message ?? 'no row'})`);
  }

  const currentStatus = (driver.verificationStatus ?? 'PENDING') as VerificationStatus;

  if (!driver.operatingState || !driver.vehicleCategory) {
    await applyDecision(db, driverId, currentStatus, { status: 'PENDING', reason: 'Profile not yet submitted.' }, 0);
    return;
  }

  const { data: requirementRows } = await db
    .from('driver_verification_requirements')
    .select('state, vehicleCategory, documentType, isRequired, isActive')
    .eq('state', driver.operatingState)
    .eq('vehicleCategory', driver.vehicleCategory);

  const requiredDocumentTypes = resolveRequiredDocuments(
    driver.operatingState,
    driver.vehicleCategory,
    (requirementRows ?? []) as VerificationRequirementRow[]
  );

  const { data: documents } = await db
    .from('driver_documents')
    .select('id, type, status, expiryDate, createdAt')
    .eq('driverId', driverId)
    .order('createdAt', { ascending: false });

  const submittedTypesWithLatestDoc = new Map<string, { id: string; status: string }>();
  for (const doc of documents ?? []) {
    if (!submittedTypesWithLatestDoc.has(doc.type)) {
      submittedTypesWithLatestDoc.set(doc.type, { id: doc.id, status: doc.status });
    }
  }

  // "Complete" requires every required document type submitted AND email
  // verification done — a driver cannot enter the checking pipeline without it.
  const documentsComplete =
    requiredDocumentTypes.every((type) => submittedTypesWithLatestDoc.has(type)) &&
    !!driver.emailVerifiedAt;
  const submittedRequiredCount = requiredDocumentTypes.filter((type) =>
    submittedTypesWithLatestDoc.has(type)
  ).length;
  const progress = requiredDocumentTypes.length > 0
    ? Math.round((submittedRequiredCount / requiredDocumentTypes.length) * 100)
    : 0;

  if (!documentsComplete) {
    await applyDecision(
      db,
      driverId,
      currentStatus,
      { status: 'PENDING', reason: 'Required documents are incomplete.' },
      progress
    );
    return;
  }

  // Latest check per (documentId, checkType), restricted to the currently-required
  // documents' latest submitted row (an older re-uploaded/replaced document's checks
  // are not counted).
  const requiredDocumentIds = requiredDocumentTypes
    .map((type) => submittedTypesWithLatestDoc.get(type)?.id)
    .filter((id): id is string => !!id);

  const { data: checks } = await db
    .from('driver_document_verification_checks')
    .select('documentId, checkType, status, checkedAt')
    .eq('driverId', driverId)
    .order('checkedAt', { ascending: false });

  const latestCheckFor = new Map<string, string>(); // key: `${documentId ?? 'profile'}:${checkType}` -> status
  for (const check of checks ?? []) {
    const key = `${check.documentId ?? 'profile'}:${check.checkType}`;
    if (!latestCheckFor.has(key)) {
      latestCheckFor.set(key, check.status);
    }
  }

  const profileFormatStatus = latestCheckFor.get('profile:format');
  const formatResults: FormatCheckStatus[] = [];
  if (profileFormatStatus) formatResults.push(profileFormatStatus as FormatCheckStatus);
  for (const documentId of requiredDocumentIds) {
    const status = latestCheckFor.get(`${documentId}:format`);
    if (status) formatResults.push(status as FormatCheckStatus);
  }
  // An admin explicitly rejecting a specific document (backend/trpc/routes/admin/
  // review-document/route.ts, driver_documents.status='rejected') is treated the
  // same as a hard format failure — it forces REJECTED so the driver must resubmit
  // that document, rather than silently waiting in MANUAL_REVIEW forever. An admin
  // *approving* a document does not, by itself, promote anything — VERIFIED still
  // requires the separate, explicit admin.driverVerification.decide call.
  for (const type of requiredDocumentTypes) {
    if (submittedTypesWithLatestDoc.get(type)?.status === 'rejected') {
      formatResults.push('fail');
    }
  }

  const ocrResults: OcrCheckStatus[] = [];
  for (const documentId of requiredDocumentIds) {
    const status = latestCheckFor.get(`${documentId}:ocr_consistency`);
    if (status) ocrResults.push(status as OcrCheckStatus);
  }

  const authenticityResults: AuthenticityCheckStatus[] = [];
  for (const documentId of requiredDocumentIds) {
    const status = latestCheckFor.get(`${documentId}:authenticity`);
    if (status) authenticityResults.push(status as AuthenticityCheckStatus);
  }

  const decision = decideNextStatus(
    currentStatus,
    documentsComplete,
    {
      format: aggregateFormatStatus(formatResults),
      ocr: aggregateOcrStatus(ocrResults),
      authenticity: aggregateAuthenticityStatus(authenticityResults),
    },
    isAutoApproveEnabled()
  );

  await applyDecision(db, driverId, currentStatus, decision, progress);
}

async function applyDecision(
  db: SupabaseClient,
  driverId: string,
  currentStatus: VerificationStatus,
  decision: { status: VerificationStatus; reason: string },
  progress: number
): Promise<void> {
  if (decision.status === currentStatus) {
    // Still write the progress figure even when the status itself hasn't changed —
    // this keeps the legacy verificationProgress column (read by some UI) fresh —
    // but skip the audit-log write, which is reserved for actual transitions.
    await db
      .from('drivers')
      .update({ verificationProgress: progress })
      .eq('id', driverId);
    return;
  }

  await db
    .from('drivers')
    .update({
      verificationStatus: decision.status,
      isVerified: decision.status === 'VERIFIED',
      verificationStatusUpdatedAt: new Date().toISOString(),
      verificationProgress: progress,
      rejectionReason: decision.status === 'REJECTED' || decision.status === 'MANUAL_REVIEW' ? decision.reason : null,
    })
    .eq('id', driverId);

  await writeAuditLog(db, {
    driverId,
    actorType: 'system',
    eventType: 'STATUS_CHANGED',
    fromStatus: currentStatus,
    toStatus: decision.status,
    reason: decision.reason,
  });
}

/**
 * Demotes a VERIFIED driver to MANUAL_REVIEW if any required document or the license
 * itself has expired. Called opportunistically (app open / before going online) —
 * this stack has no cron/scheduler, so there is no background sweep for expiry.
 */
export async function checkExpiry(db: SupabaseClient, driverId: string): Promise<void> {
  const { data: driver, error } = await db
    .from('drivers')
    .select('id, verificationStatus, licenseExpiryDate')
    .eq('id', driverId)
    .single();

  if (error || !driver) {
    throw new Error(`checkExpiry: driver ${driverId} not found (${error?.message ?? 'no row'})`);
  }

  const today = new Date();
  let hasExpired = isDateExpired(driver.licenseExpiryDate, today);

  if (!hasExpired) {
    const { data: documents } = await db
      .from('driver_documents')
      .select('expiryDate')
      .eq('driverId', driverId);
    hasExpired = (documents ?? []).some((doc) => isDateExpired(doc.expiryDate, today));
  }

  const decision = demoteIfExpired((driver.verificationStatus ?? 'PENDING') as VerificationStatus, hasExpired);
  if (!decision) return;

  await db
    .from('drivers')
    .update({
      verificationStatus: decision.status,
      isVerified: false,
      verificationStatusUpdatedAt: new Date().toISOString(),
      rejectionReason: decision.reason,
    })
    .eq('id', driverId);

  await writeAuditLog(db, {
    driverId,
    actorType: 'system',
    eventType: 'STATUS_CHANGED',
    fromStatus: 'VERIFIED',
    toStatus: decision.status,
    reason: decision.reason,
  });
}
