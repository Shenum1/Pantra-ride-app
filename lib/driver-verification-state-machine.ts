// Pure state-machine logic for driver verification. Deliberately separated from
// backend/services/verification/engine.ts (which does the DB reads/writes) so the
// actual decision logic is directly unit-testable with zero mocking — same
// separation-of-concerns pattern as lib/surge-calculator.ts / lib/traffic-multiplier.ts
// being split from their Supabase-fetching callers in hooks/useRideStore.ts.

export type VerificationStatus =
  | 'PENDING'
  | 'DOCUMENTS_SUBMITTED'
  | 'VERIFYING'
  | 'VERIFIED'
  | 'REJECTED'
  | 'MANUAL_REVIEW';

export type FormatCheckStatus = 'pass' | 'fail';
export type OcrCheckStatus = 'pass' | 'mismatch' | 'not_configured';
export type AuthenticityCheckStatus = 'verified' | 'rejected' | 'manual_review' | 'not_configured';

export type AggregateFormatStatus = FormatCheckStatus | 'pending';
export type AggregateOcrStatus = OcrCheckStatus | 'pending';
export type AggregateAuthenticityStatus = AuthenticityCheckStatus | 'pending';

export interface CheckAggregate {
  format: AggregateFormatStatus;
  ocr: AggregateOcrStatus;
  authenticity: AggregateAuthenticityStatus;
}

export interface StatusDecision {
  status: VerificationStatus;
  reason: string;
}

/** Folds the format-check result of every required document/profile field into one status. */
export function aggregateFormatStatus(results: FormatCheckStatus[]): AggregateFormatStatus {
  if (results.length === 0) return 'pending';
  return results.every((r) => r === 'pass') ? 'pass' : 'fail';
}

/**
 * Folds OCR-consistency results across required documents. A single mismatch always
 * wins (never silently averaged away) — OCR disagreement routes to human review, not
 * an automatic rejection, since OCR itself can misread a genuine document.
 */
export function aggregateOcrStatus(results: OcrCheckStatus[]): AggregateOcrStatus {
  if (results.length === 0) return 'pending';
  if (results.some((r) => r === 'mismatch')) return 'mismatch';
  if (results.every((r) => r === 'not_configured')) return 'not_configured';
  return 'pass';
}

/**
 * Folds authenticity-provider results across required documents. A single 'rejected'
 * wins over 'manual_review', which wins over 'not_configured' — the most cautious
 * signal always determines the aggregate.
 */
export function aggregateAuthenticityStatus(
  results: AuthenticityCheckStatus[]
): AggregateAuthenticityStatus {
  if (results.length === 0) return 'pending';
  if (results.some((r) => r === 'rejected')) return 'rejected';
  if (results.some((r) => r === 'manual_review')) return 'manual_review';
  if (results.some((r) => r === 'not_configured')) return 'not_configured';
  return 'verified';
}

/**
 * The core transition function: given whether the driver's profile + required
 * documents are complete, and the aggregated check results, decides the next
 * verificationStatus. Stateless/pure — recomputed fresh on every call, so a driver
 * resubmitting after REJECTED/MANUAL_REVIEW naturally re-enters the pipeline without
 * any special-cased transition code.
 *
 * `currentStatus` is accepted for context/logging but does not gate the decision —
 * the aggregate check state alone determines the target status. The one exception
 * (admin override reaching VERIFIED/REJECTED) is NOT modeled here — that's a
 * separate, explicit action in admin.driverVerification.decide, never derived.
 */
export function decideNextStatus(
  currentStatus: VerificationStatus,
  documentsComplete: boolean,
  checks: CheckAggregate,
  autoApproveEnabled: boolean
): StatusDecision {
  if (!documentsComplete) {
    return {
      status: 'PENDING',
      reason: 'Profile or required documents are incomplete.',
    };
  }

  if (checks.format === 'pending') {
    return { status: 'DOCUMENTS_SUBMITTED', reason: 'Documents submitted; format validation pending.' };
  }

  if (checks.format === 'fail') {
    return {
      status: 'REJECTED',
      reason: 'One or more submitted fields or documents failed format validation. Correct and resubmit.',
    };
  }

  // format === 'pass' from here on.
  if (checks.ocr === 'mismatch') {
    return {
      status: 'MANUAL_REVIEW',
      reason: 'Extracted document data does not match the submitted profile information.',
    };
  }

  if (checks.authenticity === 'not_configured') {
    return {
      status: 'MANUAL_REVIEW',
      reason: 'No authorized government verification API is configured for this deployment; human review required.',
    };
  }

  if (checks.authenticity === 'rejected' || checks.authenticity === 'manual_review') {
    return {
      status: 'MANUAL_REVIEW',
      reason: 'Authenticity check flagged this driver for manual review.',
    };
  }

  if (checks.authenticity === 'pending') {
    return { status: 'VERIFYING', reason: 'Authenticity checks in progress.' };
  }

  // checks.authenticity === 'verified' and format passed and ocr did not mismatch.
  if (autoApproveEnabled) {
    return { status: 'VERIFIED', reason: 'All automated checks passed.' };
  }

  return {
    status: 'MANUAL_REVIEW',
    reason: 'Automated checks passed; awaiting final human sign-off.',
  };
}

/**
 * Demotes a VERIFIED driver back to MANUAL_REVIEW if a required document or license
 * has expired. Deliberately never demotes to REJECTED — expiry is a "needs renewal"
 * signal, not evidence of a bad-faith submission.
 */
export function demoteIfExpired(
  currentStatus: VerificationStatus,
  hasExpiredRequiredCredential: boolean
): StatusDecision | null {
  if (currentStatus !== 'VERIFIED' || !hasExpiredRequiredCredential) {
    return null;
  }
  return {
    status: 'MANUAL_REVIEW',
    reason: 'A required document or license has expired.',
  };
}
