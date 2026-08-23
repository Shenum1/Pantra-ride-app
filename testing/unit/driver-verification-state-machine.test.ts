import { describe, expect, it } from 'vitest';
import {
  aggregateFormatStatus,
  aggregateOcrStatus,
  aggregateAuthenticityStatus,
  decideNextStatus,
  demoteIfExpired,
  type CheckAggregate,
} from '@/lib/driver-verification-state-machine';

describe('aggregateFormatStatus', () => {
  it('is pending when there are no results yet', () => {
    expect(aggregateFormatStatus([])).toBe('pending');
  });

  it('is pass only when every result passes', () => {
    expect(aggregateFormatStatus(['pass', 'pass'])).toBe('pass');
  });

  it('is fail if any single result fails', () => {
    expect(aggregateFormatStatus(['pass', 'fail', 'pass'])).toBe('fail');
  });
});

describe('aggregateOcrStatus', () => {
  it('is pending when there are no results yet', () => {
    expect(aggregateOcrStatus([])).toBe('pending');
  });

  it('a single mismatch wins over everything else', () => {
    expect(aggregateOcrStatus(['pass', 'mismatch', 'not_configured'])).toBe('mismatch');
  });

  it('is not_configured only when every result is not_configured', () => {
    expect(aggregateOcrStatus(['not_configured', 'not_configured'])).toBe('not_configured');
  });

  it('is pass when everything passed and nothing mismatched', () => {
    expect(aggregateOcrStatus(['pass', 'pass'])).toBe('pass');
  });

  it('a mix of pass and not_configured (no mismatch) is treated as pass', () => {
    expect(aggregateOcrStatus(['pass', 'not_configured'])).toBe('pass');
  });
});

describe('aggregateAuthenticityStatus', () => {
  it('is pending when there are no results yet', () => {
    expect(aggregateAuthenticityStatus([])).toBe('pending');
  });

  it('rejected wins over everything else', () => {
    expect(aggregateAuthenticityStatus(['verified', 'rejected', 'manual_review'])).toBe('rejected');
  });

  it('manual_review wins over not_configured and verified', () => {
    expect(aggregateAuthenticityStatus(['verified', 'manual_review', 'not_configured'])).toBe('manual_review');
  });

  it('not_configured wins over verified', () => {
    expect(aggregateAuthenticityStatus(['verified', 'not_configured'])).toBe('not_configured');
  });

  it('is verified only when every result is verified', () => {
    expect(aggregateAuthenticityStatus(['verified', 'verified'])).toBe('verified');
  });
});

describe('decideNextStatus', () => {
  const pendingChecks: CheckAggregate = { format: 'pending', ocr: 'pending', authenticity: 'pending' };

  it('stays PENDING when documents/profile are incomplete, regardless of check state', () => {
    const result = decideNextStatus('PENDING', false, pendingChecks, false);
    expect(result.status).toBe('PENDING');
  });

  it('moves to DOCUMENTS_SUBMITTED once complete but before format checks have run', () => {
    const result = decideNextStatus('PENDING', true, pendingChecks, false);
    expect(result.status).toBe('DOCUMENTS_SUBMITTED');
  });

  it('moves to REJECTED when format validation fails, regardless of other checks', () => {
    const result = decideNextStatus('VERIFYING', true, { format: 'fail', ocr: 'pending', authenticity: 'pending' }, false);
    expect(result.status).toBe('REJECTED');
  });

  it('moves to MANUAL_REVIEW (never REJECTED) on an OCR mismatch', () => {
    const result = decideNextStatus('VERIFYING', true, { format: 'pass', ocr: 'mismatch', authenticity: 'pending' }, false);
    expect(result.status).toBe('MANUAL_REVIEW');
  });

  it('moves to MANUAL_REVIEW when the authenticity provider is not configured (the shipped default)', () => {
    const result = decideNextStatus('VERIFYING', true, { format: 'pass', ocr: 'pass', authenticity: 'not_configured' }, false);
    expect(result.status).toBe('MANUAL_REVIEW');
    expect(result.reason).toMatch(/no authorized government verification/i);
  });

  it('moves to MANUAL_REVIEW when authenticity is rejected or manual_review', () => {
    expect(decideNextStatus('VERIFYING', true, { format: 'pass', ocr: 'pass', authenticity: 'rejected' }, false).status).toBe('MANUAL_REVIEW');
    expect(decideNextStatus('VERIFYING', true, { format: 'pass', ocr: 'pass', authenticity: 'manual_review' }, false).status).toBe('MANUAL_REVIEW');
  });

  it('stays VERIFYING while authenticity checks are still pending after format/OCR pass', () => {
    const result = decideNextStatus('VERIFYING', true, { format: 'pass', ocr: 'pass', authenticity: 'pending' }, false);
    expect(result.status).toBe('VERIFYING');
  });

  it('never reaches VERIFIED when autoApprove is disabled, even with every check passing/verified', () => {
    const result = decideNextStatus('VERIFYING', true, { format: 'pass', ocr: 'pass', authenticity: 'verified' }, false);
    expect(result.status).toBe('MANUAL_REVIEW');
    expect(result.reason).toMatch(/awaiting final human sign-off/i);
  });

  it('reaches VERIFIED only when autoApprove is enabled AND every check passed/verified', () => {
    const result = decideNextStatus('VERIFYING', true, { format: 'pass', ocr: 'pass', authenticity: 'verified' }, true);
    expect(result.status).toBe('VERIFIED');
  });

  it('does not reach VERIFIED via autoApprove if OCR mismatched, even if authenticity says verified', () => {
    const result = decideNextStatus('VERIFYING', true, { format: 'pass', ocr: 'mismatch', authenticity: 'verified' }, true);
    expect(result.status).toBe('MANUAL_REVIEW');
  });

  it('is a pure recomputation: a driver resubmitting after REJECTED re-enters the pipeline with fresh checks', () => {
    const rejected = decideNextStatus('REJECTED', true, { format: 'fail', ocr: 'pending', authenticity: 'pending' }, false);
    expect(rejected.status).toBe('REJECTED');

    // After resubmission, format now passes -> recompute again from scratch.
    const resubmitted = decideNextStatus('REJECTED', true, { format: 'pass', ocr: 'pending', authenticity: 'pending' }, false);
    expect(resubmitted.status).toBe('VERIFYING');
  });
});

describe('demoteIfExpired', () => {
  it('demotes a VERIFIED driver to MANUAL_REVIEW when a required credential has expired', () => {
    const result = demoteIfExpired('VERIFIED', true);
    expect(result?.status).toBe('MANUAL_REVIEW');
  });

  it('does nothing when nothing has expired', () => {
    expect(demoteIfExpired('VERIFIED', false)).toBeNull();
  });

  it('does nothing for a driver who is not currently VERIFIED', () => {
    expect(demoteIfExpired('PENDING', true)).toBeNull();
    expect(demoteIfExpired('MANUAL_REVIEW', true)).toBeNull();
    expect(demoteIfExpired('REJECTED', true)).toBeNull();
  });

  it('never demotes to REJECTED', () => {
    const result = demoteIfExpired('VERIFIED', true);
    expect(result?.status).not.toBe('REJECTED');
  });
});
