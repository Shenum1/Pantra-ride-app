// Shared types for the pluggable verification-provider architecture. Server-only —
// never imported from app/, hooks/, or any file bundled to the React Native client.

export type DriverDocumentType =
  | 'drivers_license_front'
  | 'drivers_license_back'
  | 'driver_selfie'
  | 'vehicle_registration'
  | 'proof_of_ownership'
  | 'insurance'
  | 'roadworthiness';

export interface OcrExtractionResult {
  status: 'ok' | 'not_configured' | 'error';
  extractedFields: Record<string, string>;
  provider: string;
  providerReferenceId?: string;
  confidence?: number;
  errorMessage?: string;
}

export interface AuthenticityResult {
  status: 'verified' | 'rejected' | 'manual_review' | 'not_configured' | 'error';
  provider: string;
  providerReferenceId?: string;
  reason?: string;
}

export interface AuthenticityDriverLicenseInput {
  licenseNumber: string;
  fullLegalName: string;
  dateOfBirth: string; // ISO date
  licenseCategory: string;
}

export interface AuthenticityVehicleRegistrationInput {
  plateNumber: string;
  vin: string;
  ownerFullLegalName: string;
}
