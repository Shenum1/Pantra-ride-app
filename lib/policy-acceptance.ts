import { LEGAL_VERSIONS } from '@/constants/legal-versions';

// Pure version logic for policy acceptance (no I/O) — the gate in
// components/PolicyAcceptanceGate.tsx and the signup screens build on this;
// lib/policy-acceptance-service.ts does the reads/writes.

export type PolicyType = 'terms' | 'privacy' | 'driver_terms';

export type PolicyVersions = Record<PolicyType, string>;

export interface PolicyAcceptanceRecord {
  policyType: PolicyType;
  policyVersion: string;
}

export const CURRENT_POLICY_VERSIONS: PolicyVersions = {
  terms: LEGAL_VERSIONS.terms,
  privacy: LEGAL_VERSIONS.privacy,
  driver_terms: LEGAL_VERSIONS.driverTerms,
};

// Riders agree to the Terms + Privacy Policy; drivers additionally to the
// driver terms.
export function requiredPolicies(isDriver: boolean): PolicyType[] {
  return isDriver ? ['terms', 'privacy', 'driver_terms'] : ['terms', 'privacy'];
}

// Numeric, part-by-part comparison ('1.10' > '1.9', '2' == '2.0').
// Non-numeric parts count as 0, so a malformed stored version never
// outranks a real one. Returns <0, 0 or >0.
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((p) => parseInt(p, 10) || 0);
  const pb = b.split('.').map((p) => parseInt(p, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// Highest accepted version per policy.
export function latestAcceptedVersions(records: PolicyAcceptanceRecord[]): Partial<PolicyVersions> {
  const latest: Partial<PolicyVersions> = {};
  for (const r of records) {
    const current = latest[r.policyType];
    if (current == null || compareVersions(r.policyVersion, current) > 0) latest[r.policyType] = r.policyVersion;
  }
  return latest;
}

// Required policies the user has never accepted, or only accepted an older
// version of. Empty = nothing to ask.
export function policiesNeedingAcceptance(
  records: PolicyAcceptanceRecord[],
  isDriver: boolean,
  current: PolicyVersions = CURRENT_POLICY_VERSIONS
): PolicyType[] {
  const latest = latestAcceptedVersions(records);
  return requiredPolicies(isDriver).filter((policy) => {
    const accepted = latest[policy];
    return accepted == null || compareVersions(accepted, current[policy]) < 0;
  });
}

// The subset of locally-cached accepted versions not yet on the server —
// what still needs writing.
export function unrecordedVersions(
  versions: Partial<PolicyVersions>,
  records: PolicyAcceptanceRecord[]
): Partial<PolicyVersions> {
  const missing: Partial<PolicyVersions> = {};
  for (const [policy, version] of Object.entries(versions) as [PolicyType, string][]) {
    const recorded = records.some((r) => r.policyType === policy && compareVersions(r.policyVersion, version) === 0);
    if (!recorded) missing[policy] = version;
  }
  return missing;
}

// Whether a locally-cached acceptance belongs to the signed-in account: one
// made at email signup is tied to that email; one without an email (Google
// signup) applies to whoever signs in next.
export function pendingAcceptanceMatches(pendingEmail: string | undefined, accountEmail: string | null | undefined): boolean {
  if (!pendingEmail) return true;
  return !!accountEmail && accountEmail.trim().toLowerCase() === pendingEmail.trim().toLowerCase();
}

// True when the user has accepted some earlier version of every outstanding
// policy — i.e. this is an update, not a first-time acceptance. Only changes
// the prompt's wording.
export function isPolicyUpdate(records: PolicyAcceptanceRecord[], outstanding: PolicyType[]): boolean {
  const latest = latestAcceptedVersions(records);
  return outstanding.length > 0 && outstanding.every((policy) => latest[policy] != null);
}
