import { describe, expect, it } from 'vitest';
import {
  compareVersions,
  CURRENT_POLICY_VERSIONS,
  isPolicyUpdate,
  latestAcceptedVersions,
  pendingAcceptanceMatches,
  policiesNeedingAcceptance,
  PolicyAcceptanceRecord,
  requiredPolicies,
  unrecordedVersions,
} from '@/lib/policy-acceptance';
import { LEGAL_VERSIONS } from '@/constants/legal-versions';

const rec = (policyType: PolicyAcceptanceRecord['policyType'], policyVersion: string): PolicyAcceptanceRecord => ({
  policyType,
  policyVersion,
});

const current = { terms: '1.1', privacy: '1.0', driver_terms: '2.0' };

describe('compareVersions', () => {
  it('compares numerically, part by part', () => {
    expect(compareVersions('1.10', '1.9')).toBeGreaterThan(0);
    expect(compareVersions('1.0', '1.1')).toBeLessThan(0);
    expect(compareVersions('2', '2.0')).toBe(0);
    expect(compareVersions('2.0.1', '2.0')).toBeGreaterThan(0);
  });

  it('never lets a malformed stored version outrank a real one', () => {
    expect(compareVersions('abc', '1.0')).toBeLessThan(0);
  });
});

describe('policy versions', () => {
  it('maps the constants to policy types', () => {
    expect(CURRENT_POLICY_VERSIONS).toEqual({
      terms: LEGAL_VERSIONS.terms,
      privacy: LEGAL_VERSIONS.privacy,
      driver_terms: LEGAL_VERSIONS.driverTerms,
    });
  });

  it('requires driver terms only for drivers', () => {
    expect(requiredPolicies(false)).toEqual(['terms', 'privacy']);
    expect(requiredPolicies(true)).toEqual(['terms', 'privacy', 'driver_terms']);
  });

  it('takes the highest accepted version of each policy', () => {
    expect(latestAcceptedVersions([rec('terms', '1.0'), rec('terms', '1.10'), rec('terms', '1.9')])).toEqual({ terms: '1.10' });
  });
});

describe('policiesNeedingAcceptance', () => {
  it('asks a user with no records to accept everything their role needs', () => {
    expect(policiesNeedingAcceptance([], false, current)).toEqual(['terms', 'privacy']);
    expect(policiesNeedingAcceptance([], true, current)).toEqual(['terms', 'privacy', 'driver_terms']);
  });

  it('asks again only for policies whose latest acceptance is older than current', () => {
    const records = [rec('terms', '1.0'), rec('privacy', '1.0')];
    expect(policiesNeedingAcceptance(records, false, current)).toEqual(['terms']);
  });

  it('is satisfied by the current (or a newer) version', () => {
    const records = [rec('terms', '1.0'), rec('terms', '1.1'), rec('privacy', '1.0')];
    expect(policiesNeedingAcceptance(records, false, current)).toEqual([]);
    expect(policiesNeedingAcceptance([rec('terms', '1.2'), rec('privacy', '1.0')], false, current)).toEqual([]);
  });

  it('asks a rider who became a driver for the driver terms only', () => {
    const records = [rec('terms', '1.1'), rec('privacy', '1.0')];
    expect(policiesNeedingAcceptance(records, true, current)).toEqual(['driver_terms']);
    expect(policiesNeedingAcceptance([...records, rec('driver_terms', '1.0')], true, current)).toEqual(['driver_terms']);
  });

  it('defaults to the real current versions', () => {
    const all = [
      rec('terms', LEGAL_VERSIONS.terms),
      rec('privacy', LEGAL_VERSIONS.privacy),
      rec('driver_terms', LEGAL_VERSIONS.driverTerms),
    ];
    expect(policiesNeedingAcceptance(all, true)).toEqual([]);
  });
});

describe('isPolicyUpdate', () => {
  it('is an update when every outstanding policy was accepted before at an older version', () => {
    expect(isPolicyUpdate([rec('terms', '1.0')], ['terms'])).toBe(true);
    expect(isPolicyUpdate([rec('terms', '1.0')], ['terms', 'privacy'])).toBe(false);
    expect(isPolicyUpdate([], ['terms'])).toBe(false);
    expect(isPolicyUpdate([rec('terms', '1.0')], [])).toBe(false);
  });
});

describe('local cache sync', () => {
  it('only writes versions the server does not already have', () => {
    const records = [rec('terms', '1.0')];
    expect(unrecordedVersions({ terms: '1.0', privacy: '1.0' }, records)).toEqual({ privacy: '1.0' });
    expect(unrecordedVersions({ terms: '1.0' }, records)).toEqual({});
    expect(unrecordedVersions({ terms: '1.1' }, records)).toEqual({ terms: '1.1' });
  });

  it('applies an email-signup acceptance only to that account', () => {
    expect(pendingAcceptanceMatches('ada@example.com', 'Ada@Example.com ')).toBe(true);
    expect(pendingAcceptanceMatches('ada@example.com', 'someone@else.com')).toBe(false);
    expect(pendingAcceptanceMatches('ada@example.com', null)).toBe(false);
    // Google signup: the account isn't known when the box is ticked.
    expect(pendingAcceptanceMatches(undefined, 'anyone@example.com')).toBe(true);
  });
});
