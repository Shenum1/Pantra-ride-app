// Current version of each legal policy — the single source of truth.
//
// Bump a version whenever the matching document changes in a way users must
// agree to again (app/terms-and-conditions.tsx, app/privacy-policy.tsx).
// On next app start every signed-in user whose latest recorded acceptance
// (public.policy_acceptances) is older sees a blocking "accept the updated
// terms" prompt — see components/PolicyAcceptanceGate.tsx. Versions are
// compared numerically per dot-separated part, so '1.10' is newer than '1.9'.
export const LEGAL_VERSIONS = {
  terms: '1.0',
  privacy: '1.0',
  driverTerms: '1.0',
} as const;
