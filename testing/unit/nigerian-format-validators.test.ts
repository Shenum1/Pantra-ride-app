import { describe, expect, it } from 'vitest';
import {
  validateVIN,
  validatePlateNumber,
  validateDriverLicenseNumber,
  validateEngineNumber,
  validateLicenseDates,
  validateDateOfBirth,
  validateVehicleYear,
  validateFullLegalName,
  validateDriverProfileFormat,
  MIN_DRIVER_AGE_YEARS,
} from '@/lib/nigerian-format-validators';

describe('validateVIN — ISO 3779 check-digit algorithm', () => {
  it('accepts a real, valid 17-character VIN', () => {
    expect(validateVIN('1M8GDM9AXKP042788').valid).toBe(true);
    expect(validateVIN('1HGCM82633A004352').valid).toBe(true);
  });

  it('is case-insensitive and tolerant of surrounding whitespace', () => {
    expect(validateVIN(' 1m8gdm9axkp042788 ').valid).toBe(true);
  });

  it('rejects a VIN with a tampered check digit', () => {
    // Same VIN as above but with the check digit (position 9) changed from X to 0.
    const tampered = '1M8GDM9A0KP042788';
    expect(validateVIN(tampered).valid).toBe(false);
  });

  it('rejects a VIN that is not exactly 17 characters', () => {
    expect(validateVIN('1M8GDM9AXKP04278').valid).toBe(false); // 16 chars
    expect(validateVIN('1M8GDM9AXKP0427888').valid).toBe(false); // 18 chars
    expect(validateVIN('').valid).toBe(false);
  });

  it('rejects a VIN containing I, O, or Q', () => {
    expect(validateVIN('1M8GDM9AIKP042788').valid).toBe(false);
    expect(validateVIN('1M8GDM9AOKP042788').valid).toBe(false);
    expect(validateVIN('1M8GDM9AQKP042788').valid).toBe(false);
  });

  it('rejects a VIN with non-alphanumeric characters', () => {
    expect(validateVIN('1M8GDM9A-KP042788').valid).toBe(false);
  });
});

describe('validatePlateNumber — current-generation Nigerian format', () => {
  it('accepts the standard 3-letter/3-digit/2-letter format', () => {
    expect(validatePlateNumber('ABC123DE').valid).toBe(true);
  });

  it('accepts common hyphen/space-separated presentations of the same plate', () => {
    expect(validatePlateNumber('ABC-123-DE').valid).toBe(true);
    expect(validatePlateNumber('ABC 123 DE').valid).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(validatePlateNumber('abc-123-de').valid).toBe(true);
  });

  it('rejects the wrong letter/digit arrangement', () => {
    expect(validatePlateNumber('AB1234CD').valid).toBe(false);
    expect(validatePlateNumber('ABCD123E').valid).toBe(false);
    expect(validatePlateNumber('123ABCDE').valid).toBe(false);
  });

  it('rejects an empty value', () => {
    expect(validatePlateNumber('').valid).toBe(false);
  });
});

describe('validateDriverLicenseNumber — structural only, no fabricated FRSC pattern', () => {
  it('accepts a plausible alphanumeric license number within the length range', () => {
    expect(validateDriverLicenseNumber('ABC1234567').valid).toBe(true);
  });

  it('rejects too-short or too-long values', () => {
    expect(validateDriverLicenseNumber('AB123').valid).toBe(false); // 5 chars
    expect(validateDriverLicenseNumber('A'.repeat(21)).valid).toBe(false);
  });

  it('rejects values with disallowed characters', () => {
    expect(validateDriverLicenseNumber('ABC 123 456').valid).toBe(false); // spaces
    expect(validateDriverLicenseNumber('ABC#123456').valid).toBe(false);
  });

  it('allows hyphens', () => {
    expect(validateDriverLicenseNumber('ABC-123-456').valid).toBe(true);
  });
});

describe('validateEngineNumber — intentionally loose, manufacturer-specific', () => {
  it('accepts a plausible alphanumeric engine number', () => {
    expect(validateEngineNumber('4G15-ABCDE').valid).toBe(true);
  });

  it('rejects too-short values', () => {
    expect(validateEngineNumber('AB1').valid).toBe(false);
  });

  it('rejects values with disallowed characters', () => {
    expect(validateEngineNumber('4G15 ABCDE').valid).toBe(false);
  });
});

describe('validateLicenseDates', () => {
  const today = new Date('2026-06-15T00:00:00Z');

  it('accepts a currently-valid license (issued in the past, expiring in the future)', () => {
    const result = validateLicenseDates(
      new Date('2023-01-01T00:00:00Z'),
      new Date('2028-01-01T00:00:00Z'),
      today
    );
    expect(result.valid).toBe(true);
  });

  it('rejects an issue date in the future', () => {
    const result = validateLicenseDates(
      new Date('2027-01-01T00:00:00Z'),
      new Date('2030-01-01T00:00:00Z'),
      today
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/future/i);
  });

  it('rejects an expiry date before or equal to the issue date', () => {
    const result = validateLicenseDates(
      new Date('2023-01-01T00:00:00Z'),
      new Date('2023-01-01T00:00:00Z'),
      today
    );
    expect(result.valid).toBe(false);
  });

  it('rejects an already-expired license', () => {
    const result = validateLicenseDates(
      new Date('2020-01-01T00:00:00Z'),
      new Date('2024-01-01T00:00:00Z'),
      today
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/expired/i);
  });
});

describe('validateDateOfBirth', () => {
  const today = new Date('2026-06-15T00:00:00Z');

  it('accepts a driver exactly at the minimum age boundary', () => {
    const dob = new Date(`${2026 - MIN_DRIVER_AGE_YEARS}-06-15T00:00:00Z`);
    expect(validateDateOfBirth(dob, today).valid).toBe(true);
  });

  it('rejects a driver one day short of the minimum age', () => {
    const dob = new Date(`${2026 - MIN_DRIVER_AGE_YEARS}-06-16T00:00:00Z`);
    expect(validateDateOfBirth(dob, today).valid).toBe(false);
  });

  it('rejects a date of birth in the future', () => {
    expect(validateDateOfBirth(new Date('2027-01-01T00:00:00Z'), today).valid).toBe(false);
  });

  it('rejects an implausibly old date of birth', () => {
    expect(validateDateOfBirth(new Date('1900-01-01T00:00:00Z'), today).valid).toBe(false);
  });
});

describe('validateVehicleYear', () => {
  it('accepts a reasonable model year', () => {
    expect(validateVehicleYear(2020, 2026).valid).toBe(true);
  });

  it('accepts next year (common for late-year releases)', () => {
    expect(validateVehicleYear(2027, 2026).valid).toBe(true);
  });

  it('rejects an implausibly old or future year', () => {
    expect(validateVehicleYear(1950, 2026).valid).toBe(false);
    expect(validateVehicleYear(2030, 2026).valid).toBe(false);
  });

  it('applies a max-age ceiling only when one is configured (non-zero)', () => {
    expect(validateVehicleYear(2010, 2026, 10).valid).toBe(false);
    expect(validateVehicleYear(2010, 2026, 0).valid).toBe(true); // ceiling disabled by default
  });
});

describe('validateFullLegalName', () => {
  it('accepts a plausible first + last name', () => {
    expect(validateFullLegalName('Chinedu Okafor').valid).toBe(true);
  });

  it('accepts names with hyphens and apostrophes', () => {
    expect(validateFullLegalName("Mary-Anne O'Brien").valid).toBe(true);
  });

  it('rejects a single-word name', () => {
    expect(validateFullLegalName('Chinedu').valid).toBe(false);
  });

  it('rejects names containing digits', () => {
    expect(validateFullLegalName('Chinedu 2 Okafor').valid).toBe(false);
  });
});

describe('validateDriverProfileFormat — composed field-level validation', () => {
  const validInput = {
    fullLegalName: 'Chinedu Okafor',
    dateOfBirth: new Date('1990-01-01T00:00:00Z'),
    operatingState: 'Lagos',
    licenseNumber: 'ABC1234567',
    licenseIssueDate: new Date('2023-01-01T00:00:00Z'),
    licenseExpiryDate: new Date('2028-01-01T00:00:00Z'),
    vehiclePlateNumber: 'ABC-123-DE',
    vehicleYear: 2020,
    vehicleVin: '1M8GDM9AXKP042788',
    vehicleEngineNumber: '4G15-ABCDE',
    today: new Date('2026-06-15T00:00:00Z'),
  };

  it('passes with no field errors when every field is valid', () => {
    const result = validateDriverProfileFormat(validInput);
    expect(result.valid).toBe(true);
    expect(result.fieldErrors).toEqual({});
  });

  it('reports a fieldErrors entry keyed by field name for each invalid field', () => {
    const result = validateDriverProfileFormat({
      ...validInput,
      vehicleVin: 'not-a-vin',
      vehiclePlateNumber: '123',
    });
    expect(result.valid).toBe(false);
    expect(result.fieldErrors.vehicleVin).toBeDefined();
    expect(result.fieldErrors.vehiclePlateNumber).toBeDefined();
    expect(result.fieldErrors.fullLegalName).toBeUndefined();
  });

  it('requires operatingState to be non-empty', () => {
    const result = validateDriverProfileFormat({ ...validInput, operatingState: '  ' });
    expect(result.valid).toBe(false);
    expect(result.fieldErrors.operatingState).toBeDefined();
  });
});
