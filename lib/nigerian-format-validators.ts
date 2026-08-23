// Pure, framework-free format validators for driver registration/verification.
//
// IMPORTANT: these check STRUCTURE only (length, charset, date ordering, checksum
// where a real public standard exists) — they are NOT proof that a document is
// genuine. A well-formatted license number is not evidence of authenticity; that is
// a deliberately separate concern handled by the authenticity provider in
// backend/services/verification/authenticity-provider.ts. Keeping these two checks
// architecturally separate (different DB rows, different failure semantics) is a
// hard requirement of the verification rebuild.
//
// Every function is a pure function: no I/O, no Supabase, no React Native — directly
// unit-testable the same way lib/fare-calculator.ts is (see testing/unit/).

export interface FormatValidationResult {
  valid: boolean;
  errors: string[];
}

function ok(): FormatValidationResult {
  return { valid: true, errors: [] };
}

function fail(...errors: string[]): FormatValidationResult {
  return { valid: false, errors };
}

// Minimum age to hold a Nigerian commercial driver's license. This is a placeholder
// default, not a sourced regulatory figure — actual minimums can vary by state and
// license category and should be confirmed before relying on this in production.
export const MIN_DRIVER_AGE_YEARS = 18;

// No ceiling is enforced by default (0 disables the check) — commercial-vehicle-age
// rules (e.g. Lagos's rules for registered taxis/ride-hailing vehicles) are
// state-specific and not invented here. Set per-deployment once sourced.
export const MAX_VEHICLE_AGE_YEARS = 0;

const VIN_TRANSLITERATION: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
};

const VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * Validates a 17-character VIN/chassis number against the ISO 3779 check-digit
 * algorithm (the same one the US NHTSA uses) — a real, precisely-specified
 * international standard, safe to implement exactly. VINs never contain I, O, or Q
 * (reserved to avoid confusion with 1/0).
 */
export function validateVIN(value: string): FormatValidationResult {
  const vin = (value ?? '').trim().toUpperCase();

  if (vin.length !== 17) {
    return fail('VIN must be exactly 17 characters.');
  }
  if (/[IOQ]/.test(vin)) {
    return fail('VIN must not contain the letters I, O, or Q.');
  }
  if (!/^[A-Z0-9]{17}$/.test(vin)) {
    return fail('VIN must contain only letters and digits.');
  }

  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const value_ = VIN_TRANSLITERATION[vin[i]];
    if (value_ === undefined) {
      return fail('VIN contains an invalid character.');
    }
    sum += value_ * VIN_WEIGHTS[i];
  }

  const remainder = sum % 11;
  const expectedCheckChar = remainder === 10 ? 'X' : String(remainder);
  const actualCheckChar = vin[8];

  if (expectedCheckChar !== actualCheckChar) {
    return fail('VIN check digit is invalid — the VIN does not pass the standard checksum.');
  }

  return ok();
}

/**
 * Structural check only, for the current-generation Nigerian plate format
 * (3 letters, 3 digits, 2 letters — e.g. "ABC-123-DE"). This deliberately does NOT
 * cover legacy, diplomatic, or government plate formats, which follow different
 * conventions — confirm full coverage requirements before relying on this to reject
 * otherwise-valid plates.
 */
export function validatePlateNumber(value: string): FormatValidationResult {
  const plate = (value ?? '').trim().toUpperCase().replace(/[\s-]/g, '');

  if (!/^[A-Z]{3}\d{3}[A-Z]{2}$/.test(plate)) {
    return fail('Plate number must match the current Nigerian format (e.g. ABC-123-DE).');
  }

  return ok();
}

/**
 * Structural-only check (length + charset). FRSC does not publish a single public
 * regex for driver's license numbers that this codebase can rely on — deliberately
 * NOT hardened into a fake-precise pattern. Source the exact FRSC spec before
 * tightening this further.
 */
export function validateDriverLicenseNumber(value: string): FormatValidationResult {
  const license = (value ?? '').trim().toUpperCase();

  if (license.length < 6 || license.length > 20) {
    return fail('License number must be between 6 and 20 characters.');
  }
  if (!/^[A-Z0-9-]+$/.test(license)) {
    return fail('License number must contain only letters, digits, and hyphens.');
  }

  return ok();
}

/**
 * Intentionally loose — engine numbers are manufacturer-specific with no single
 * national standard.
 */
export function validateEngineNumber(value: string): FormatValidationResult {
  const engineNumber = (value ?? '').trim().toUpperCase();

  if (engineNumber.length < 5 || engineNumber.length > 20) {
    return fail('Engine number must be between 5 and 20 characters.');
  }
  if (!/^[A-Z0-9-]+$/.test(engineNumber)) {
    return fail('Engine number must contain only letters, digits, and hyphens.');
  }

  return ok();
}

/**
 * License dates must be internally consistent: issue date not in the future, expiry
 * after issue, and not already expired.
 */
export function validateLicenseDates(
  issueDate: Date,
  expiryDate: Date,
  today: Date = new Date()
): FormatValidationResult {
  const errors: string[] = [];

  if (issueDate.getTime() > today.getTime()) {
    errors.push('License issue date cannot be in the future.');
  }
  if (expiryDate.getTime() <= issueDate.getTime()) {
    errors.push('License expiry date must be after the issue date.');
  }
  if (expiryDate.getTime() < today.getTime()) {
    errors.push('License has already expired.');
  }

  return errors.length > 0 ? fail(...errors) : ok();
}

function ageInYears(dob: Date, today: Date): number {
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export function validateDateOfBirth(
  dob: Date,
  today: Date = new Date(),
  minAgeYears: number = MIN_DRIVER_AGE_YEARS
): FormatValidationResult {
  if (dob.getTime() > today.getTime()) {
    return fail('Date of birth cannot be in the future.');
  }

  const age = ageInYears(dob, today);
  if (age < minAgeYears) {
    return fail(`Driver must be at least ${minAgeYears} years old.`);
  }
  // Reject obviously-impossible ages (data entry error), not a real regulatory limit.
  if (age > 100) {
    return fail('Date of birth is not valid.');
  }

  return ok();
}

export function validateVehicleYear(
  year: number,
  currentYear: number = new Date().getFullYear(),
  maxAgeYears: number = MAX_VEHICLE_AGE_YEARS
): FormatValidationResult {
  if (!Number.isInteger(year) || year < 1980 || year > currentYear + 1) {
    return fail('Vehicle year is not valid.');
  }
  if (maxAgeYears > 0 && currentYear - year > maxAgeYears) {
    return fail(`Vehicle must not be older than ${maxAgeYears} years.`);
  }

  return ok();
}

export function validateFullLegalName(value: string): FormatValidationResult {
  const name = (value ?? '').trim();
  if (name.length < 3) {
    return fail('Full legal name must be at least 3 characters.');
  }
  if (!/^[a-zA-Z][a-zA-Z\s'.-]*$/.test(name)) {
    return fail('Full legal name contains invalid characters.');
  }
  if (name.trim().split(/\s+/).length < 2) {
    return fail('Full legal name must include at least a first and last name.');
  }
  return ok();
}

export interface DriverProfileFormatInput {
  fullLegalName: string;
  dateOfBirth: Date;
  operatingState: string;
  licenseNumber: string;
  licenseIssueDate: Date;
  licenseExpiryDate: Date;
  vehiclePlateNumber: string;
  vehicleYear: number;
  vehicleVin: string;
  vehicleEngineNumber: string;
  today?: Date;
}

/**
 * Composes every field-level validator for a driver-profile submission into one
 * result. Used both server-side (authoritative, in the submitProfile tRPC
 * procedure) and client-side (for instant UX feedback before submission) — the same
 * function, not two implementations that could drift apart.
 */
export function validateDriverProfileFormat(
  input: DriverProfileFormatInput
): { valid: boolean; fieldErrors: Record<string, string[]> } {
  const today = input.today ?? new Date();
  const fieldErrors: Record<string, string[]> = {};

  const checks: [string, FormatValidationResult][] = [
    ['fullLegalName', validateFullLegalName(input.fullLegalName)],
    ['dateOfBirth', validateDateOfBirth(input.dateOfBirth, today)],
    ['operatingState', input.operatingState?.trim() ? ok() : fail('Operating state is required.')],
    ['licenseNumber', validateDriverLicenseNumber(input.licenseNumber)],
    ['licenseDates', validateLicenseDates(input.licenseIssueDate, input.licenseExpiryDate, today)],
    ['vehiclePlateNumber', validatePlateNumber(input.vehiclePlateNumber)],
    ['vehicleYear', validateVehicleYear(input.vehicleYear, today.getFullYear())],
    ['vehicleVin', validateVIN(input.vehicleVin)],
    ['vehicleEngineNumber', validateEngineNumber(input.vehicleEngineNumber)],
  ];

  for (const [field, result] of checks) {
    if (!result.valid) {
      fieldErrors[field] = result.errors;
    }
  }

  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors };
}
