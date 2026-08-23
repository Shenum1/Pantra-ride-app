import React, { createContext, useContext, useMemo, useState } from 'react';
import type { RequiredDocumentType } from '@/lib/driver-verification-config';

// Purely a local, in-memory draft while the driver moves between wizard steps —
// nothing here is persisted or trusted server-side. The actual writes happen in
// review-submit.tsx via trpc.driverVerification.submitProfile/submitDocument, which
// re-validates everything server-side (see lib/nigerian-format-validators.ts) before
// touching the database. Losing this draft on app close just means re-entering it —
// no partial/invalid state can ever reach the server from here.
export interface DriverVerificationDraft {
  fullLegalName: string;
  dateOfBirth: string; // 'YYYY-MM-DD'
  operatingState: string;
  vehicleCategory: 'standard' | 'comfort' | 'xl' | '';
  licenseNumber: string;
  licenseCategory: string;
  licenseIssueDate: string;
  licenseExpiryDate: string;
  vehiclePlateNumber: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleColor: string;
  vehicleVin: string;
  vehicleEngineNumber: string;
  documentUris: Partial<Record<RequiredDocumentType, string>>;
  documentExpiryDates: Partial<Record<RequiredDocumentType, string>>;
}

const EMPTY_DRAFT: DriverVerificationDraft = {
  fullLegalName: '',
  dateOfBirth: '',
  operatingState: '',
  vehicleCategory: '',
  licenseNumber: '',
  licenseCategory: '',
  licenseIssueDate: '',
  licenseExpiryDate: '',
  vehiclePlateNumber: '',
  vehicleMake: '',
  vehicleModel: '',
  vehicleYear: '',
  vehicleColor: '',
  vehicleVin: '',
  vehicleEngineNumber: '',
  documentUris: {},
  documentExpiryDates: {},
};

interface WizardContextValue {
  draft: DriverVerificationDraft;
  updateDraft: (patch: Partial<DriverVerificationDraft>) => void;
  setDocumentUri: (type: RequiredDocumentType, uri: string) => void;
  setDocumentExpiryDate: (type: RequiredDocumentType, date: string) => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function DriverVerificationWizardProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<DriverVerificationDraft>(EMPTY_DRAFT);

  const value = useMemo<WizardContextValue>(
    () => ({
      draft,
      updateDraft: (patch) => setDraft((prev) => ({ ...prev, ...patch })),
      setDocumentUri: (type, uri) =>
        setDraft((prev) => ({ ...prev, documentUris: { ...prev.documentUris, [type]: uri } })),
      setDocumentExpiryDate: (type, date) =>
        setDraft((prev) => ({ ...prev, documentExpiryDates: { ...prev.documentExpiryDates, [type]: date } })),
    }),
    [draft]
  );

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

export function useDriverVerificationWizard(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) {
    throw new Error('useDriverVerificationWizard must be used within DriverVerificationWizardProvider');
  }
  return ctx;
}
