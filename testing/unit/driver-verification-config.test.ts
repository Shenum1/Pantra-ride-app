import { describe, expect, it } from 'vitest';
import {
  resolveRequiredDocuments,
  DEFAULT_VERIFICATION_REQUIREMENTS,
  type VerificationRequirementRow,
} from '@/lib/driver-verification-config';

describe('resolveRequiredDocuments — fallback-only (no live rows)', () => {
  it('returns the seeded fallback list for a known state', () => {
    const result = resolveRequiredDocuments('Lagos', 'standard');
    expect(result).toEqual(DEFAULT_VERIFICATION_REQUIREMENTS.Lagos);
  });

  it('requires the same 8 registration documents in every state', () => {
    const expected = [
      'driver_selfie',
      'drivers_license_front',
      'national_id',
      'vehicle_exterior',
      'vehicle_registration',
      'roadworthiness',
      'vehicle_interior_front',
      'vehicle_interior_rear',
    ];
    expect(resolveRequiredDocuments('Lagos', 'standard')).toEqual(expected);
    expect(resolveRequiredDocuments('Rivers', 'xl')).toEqual(expected);
  });

  it('no longer requires the license back, insurance or proof of ownership', () => {
    const result = resolveRequiredDocuments('Lagos', 'standard');
    expect(result).not.toContain('drivers_license_back');
    expect(result).not.toContain('insurance');
    expect(result).not.toContain('proof_of_ownership');
  });

  it('falls back to the baseline checklist for an unknown/unseeded state', () => {
    const result = resolveRequiredDocuments('Unknown State', 'standard');
    expect(result).toEqual(DEFAULT_VERIFICATION_REQUIREMENTS.Rivers); // same baseline shape
    expect(result).toContain('roadworthiness');
  });

  it('returns the same fallback when liveRows is explicitly empty', () => {
    expect(resolveRequiredDocuments('Lagos', 'standard', [])).toEqual(
      DEFAULT_VERIFICATION_REQUIREMENTS.Lagos
    );
  });
});

describe('resolveRequiredDocuments — live rows merged over fallback', () => {
  it('uses live rows instead of the fallback when rows exist for the state+category', () => {
    const liveRows: VerificationRequirementRow[] = [
      { state: 'Lagos', vehicleCategory: 'standard', documentType: 'driver_selfie', isRequired: true, isActive: true },
      { state: 'Lagos', vehicleCategory: 'standard', documentType: 'insurance', isRequired: true, isActive: true },
    ];
    const result = resolveRequiredDocuments('Lagos', 'standard', liveRows);
    expect(result).toEqual(['driver_selfie', 'insurance']);
  });

  it('excludes rows where isActive is false', () => {
    const liveRows: VerificationRequirementRow[] = [
      { state: 'Lagos', vehicleCategory: 'standard', documentType: 'driver_selfie', isRequired: true, isActive: true },
      { state: 'Lagos', vehicleCategory: 'standard', documentType: 'roadworthiness', isRequired: true, isActive: false },
    ];
    const result = resolveRequiredDocuments('Lagos', 'standard', liveRows);
    expect(result).toEqual(['driver_selfie']);
  });

  it('excludes rows where isRequired is false', () => {
    const liveRows: VerificationRequirementRow[] = [
      { state: 'Lagos', vehicleCategory: 'standard', documentType: 'driver_selfie', isRequired: true, isActive: true },
      { state: 'Lagos', vehicleCategory: 'standard', documentType: 'roadworthiness', isRequired: false, isActive: true },
    ];
    const result = resolveRequiredDocuments('Lagos', 'standard', liveRows);
    expect(result).toEqual(['driver_selfie']);
  });

  it('falls back when live rows exist but none match this state+category (partial table)', () => {
    const liveRows: VerificationRequirementRow[] = [
      { state: 'Kano', vehicleCategory: 'standard', documentType: 'driver_selfie', isRequired: true, isActive: true },
    ];
    const result = resolveRequiredDocuments('Lagos', 'standard', liveRows);
    expect(result).toEqual(DEFAULT_VERIFICATION_REQUIREMENTS.Lagos);
  });

  it('scopes rows by vehicleCategory, not just state', () => {
    const liveRows: VerificationRequirementRow[] = [
      { state: 'Lagos', vehicleCategory: 'xl', documentType: 'driver_selfie', isRequired: true, isActive: true },
    ];
    // No rows for 'standard' category -> falls back
    const result = resolveRequiredDocuments('Lagos', 'standard', liveRows);
    expect(result).toEqual(DEFAULT_VERIFICATION_REQUIREMENTS.Lagos);
  });

  it('ignores unrecognized document type strings from the live table', () => {
    const liveRows: VerificationRequirementRow[] = [
      { state: 'Lagos', vehicleCategory: 'standard', documentType: 'driver_selfie', isRequired: true, isActive: true },
      { state: 'Lagos', vehicleCategory: 'standard', documentType: 'some_future_doc_type', isRequired: true, isActive: true },
    ];
    const result = resolveRequiredDocuments('Lagos', 'standard', liveRows);
    expect(result).toEqual(['driver_selfie']);
  });
});
