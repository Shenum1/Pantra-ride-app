// Reviewer-facing labels for driver_documents.type. Includes the legacy types so old
// rows still read properly.
export const DOC_LABELS: Record<string, string> = {
  license: "Driver's License",
  insurance: 'Vehicle Insurance',
  registration: 'Vehicle Registration',
  background_check: 'Background Check',
  vehicle_inspection: 'Vehicle Inspection',
  drivers_license_front: "Driver's License",
  drivers_license_back: "Driver's License (back)",
  driver_selfie: 'Profile Photo',
  national_id: 'Government ID (NIN)',
  vehicle_registration: 'Vehicle License Certificate',
  proof_of_ownership: 'Proof of Ownership',
  roadworthiness: 'Roadworthiness Certificate',
  vehicle_exterior: 'Vehicle Exterior (plate visible)',
  vehicle_interior_front: 'Interior: Front',
  vehicle_interior_rear: 'Interior: Back',
};

export function docLabel(type: string): string {
  return DOC_LABELS[type] ?? type.replace(/_/g, ' ');
}
