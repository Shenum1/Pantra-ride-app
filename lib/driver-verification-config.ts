// Per-state, per-vehicle-category required-document configuration.
//
// Follows the exact "defaults-only fallback + live table merge" pattern already
// established by lib/pricing-config.ts / pricing_tier_config: the constants below
// are the fallback used before the live `driver_verification_requirements` fetch
// resolves (or if the table is empty/unreachable) — the live table (see
// database/schemas/supabase-schema-driver-verification-v2.sql) is the actual source
// of truth and can be retuned per Nigerian state without an app release.
import type { TierId } from './pricing-config';

export type VehicleCategory = TierId; // reuses the existing ride tiers — no new taxonomy

export type RequiredDocumentType =
  | 'drivers_license_front'
  | 'drivers_license_back'
  | 'driver_selfie'
  | 'vehicle_registration'
  | 'proof_of_ownership'
  | 'insurance'
  | 'roadworthiness';

export const ALL_DOCUMENT_TYPES: RequiredDocumentType[] = [
  'drivers_license_front',
  'drivers_license_back',
  'driver_selfie',
  'vehicle_registration',
  'proof_of_ownership',
  'insurance',
  'roadworthiness',
];

// Baseline checklist applied to every seeded state/category as a fallback. This is a
// PLACEHOLDER, not a researched national requirement — mirrors the seed data in
// supabase-schema-driver-verification-v2.sql. Real per-state variance should live in
// the `driver_verification_requirements` table, not here.
const BASELINE_REQUIRED_DOCUMENTS: RequiredDocumentType[] = [
  'drivers_license_front',
  'drivers_license_back',
  'driver_selfie',
  'vehicle_registration',
  'insurance',
  'proof_of_ownership',
];

// Covers all 36 states + FCT (constants/nigerian-states.ts). Lagos and Abuja (FCT)
// carry the illustrative roadworthiness example (see the matching seed in
// supabase-schema-driver-verification-v2.sql); every other state uses the baseline
// checklist until a real per-state regulatory pass replaces this placeholder.
export const DEFAULT_VERIFICATION_REQUIREMENTS: Record<string, RequiredDocumentType[]> = {
  Abia: BASELINE_REQUIRED_DOCUMENTS,
  'Abuja (FCT)': [...BASELINE_REQUIRED_DOCUMENTS, 'roadworthiness'],
  Adamawa: BASELINE_REQUIRED_DOCUMENTS,
  'Akwa Ibom': BASELINE_REQUIRED_DOCUMENTS,
  Anambra: BASELINE_REQUIRED_DOCUMENTS,
  Bauchi: BASELINE_REQUIRED_DOCUMENTS,
  Bayelsa: BASELINE_REQUIRED_DOCUMENTS,
  Benue: BASELINE_REQUIRED_DOCUMENTS,
  Borno: BASELINE_REQUIRED_DOCUMENTS,
  'Cross River': BASELINE_REQUIRED_DOCUMENTS,
  Delta: BASELINE_REQUIRED_DOCUMENTS,
  Ebonyi: BASELINE_REQUIRED_DOCUMENTS,
  Edo: BASELINE_REQUIRED_DOCUMENTS,
  Ekiti: BASELINE_REQUIRED_DOCUMENTS,
  Enugu: BASELINE_REQUIRED_DOCUMENTS,
  Gombe: BASELINE_REQUIRED_DOCUMENTS,
  Imo: BASELINE_REQUIRED_DOCUMENTS,
  Jigawa: BASELINE_REQUIRED_DOCUMENTS,
  Kaduna: BASELINE_REQUIRED_DOCUMENTS,
  Kano: BASELINE_REQUIRED_DOCUMENTS,
  Katsina: BASELINE_REQUIRED_DOCUMENTS,
  Kebbi: BASELINE_REQUIRED_DOCUMENTS,
  Kogi: BASELINE_REQUIRED_DOCUMENTS,
  Kwara: BASELINE_REQUIRED_DOCUMENTS,
  Lagos: [...BASELINE_REQUIRED_DOCUMENTS, 'roadworthiness'],
  Nasarawa: BASELINE_REQUIRED_DOCUMENTS,
  Niger: BASELINE_REQUIRED_DOCUMENTS,
  Ogun: BASELINE_REQUIRED_DOCUMENTS,
  Ondo: BASELINE_REQUIRED_DOCUMENTS,
  Osun: BASELINE_REQUIRED_DOCUMENTS,
  Oyo: BASELINE_REQUIRED_DOCUMENTS,
  Plateau: BASELINE_REQUIRED_DOCUMENTS,
  Rivers: BASELINE_REQUIRED_DOCUMENTS,
  Sokoto: BASELINE_REQUIRED_DOCUMENTS,
  Taraba: BASELINE_REQUIRED_DOCUMENTS,
  Yobe: BASELINE_REQUIRED_DOCUMENTS,
  Zamfara: BASELINE_REQUIRED_DOCUMENTS,
};

export interface VerificationRequirementRow {
  state: string;
  vehicleCategory: string;
  documentType: string;
  isRequired: boolean;
  isActive: boolean;
}

/**
 * Resolves the list of required document types for a given operating state +
 * vehicle category. Merges live Supabase rows (if provided) over the hardcoded
 * fallback — a partially-populated or empty table still resolves sensibly, same
 * merge behavior as useRideStore's pricing-config tier-rate merge.
 */
export function resolveRequiredDocuments(
  state: string,
  vehicleCategory: VehicleCategory,
  liveRows?: VerificationRequirementRow[]
): RequiredDocumentType[] {
  const fallback = DEFAULT_VERIFICATION_REQUIREMENTS[state] ?? BASELINE_REQUIRED_DOCUMENTS;

  if (!liveRows || liveRows.length === 0) {
    return fallback;
  }

  const rowsForStateAndCategory = liveRows.filter(
    (row) => row.state === state && row.vehicleCategory === vehicleCategory
  );

  if (rowsForStateAndCategory.length === 0) {
    return fallback;
  }

  return rowsForStateAndCategory
    .filter((row) => row.isActive && row.isRequired)
    .map((row) => row.documentType as RequiredDocumentType)
    .filter((type): type is RequiredDocumentType => ALL_DOCUMENT_TYPES.includes(type));
}
