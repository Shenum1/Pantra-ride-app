import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useDriverVerification } from '@/hooks/useDriverVerification';

// Local draft of the few typed fields registration collects (operating state and the
// vehicle details). Photos are not held here: each one uploads the moment it is taken
// (components/DocumentCaptureCard.tsx), so they survive closing the app. The typed
// fields are saved to the server at the end of each step via submitProfile, which
// re-validates them (lib/nigerian-format-validators.ts) — this draft is prefilled from
// what the server already has, so a returning driver doesn't retype them.
export interface DriverVerificationDraft {
  operatingState: string;
  vehicleCategory: 'standard' | 'comfort' | 'xl' | '';
  vehiclePlateNumber: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleColor: string;
}

const EMPTY_DRAFT: DriverVerificationDraft = {
  operatingState: '',
  vehicleCategory: '',
  vehiclePlateNumber: '',
  vehicleMake: '',
  vehicleModel: '',
  vehicleYear: '',
  vehicleColor: '',
};

interface WizardContextValue {
  draft: DriverVerificationDraft;
  updateDraft: (patch: Partial<DriverVerificationDraft>) => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function DriverVerificationWizardProvider({ children }: { children: React.ReactNode }) {
  const { status } = useDriverVerification();
  const [draft, setDraft] = useState<DriverVerificationDraft>(EMPTY_DRAFT);
  const hydrated = useRef(false);

  // Prefill once from the server's saved values, without overwriting anything the
  // driver has already typed this session.
  useEffect(() => {
    if (!status || hydrated.current) return;
    hydrated.current = true;
    const profile = status.profile;
    setDraft((prev) => ({
      operatingState: prev.operatingState || status.operatingState || '',
      vehicleCategory: prev.vehicleCategory || (status.vehicleCategory as DriverVerificationDraft['vehicleCategory']) || '',
      vehiclePlateNumber: prev.vehiclePlateNumber || profile?.vehiclePlateNumber || '',
      vehicleMake: prev.vehicleMake || profile?.vehicleMake || '',
      vehicleModel: prev.vehicleModel || profile?.vehicleModel || '',
      vehicleYear: prev.vehicleYear || (profile?.vehicleYear ? String(profile.vehicleYear) : ''),
      vehicleColor: prev.vehicleColor || profile?.vehicleColor || '',
    }));
  }, [status]);

  const value = useMemo<WizardContextValue>(
    () => ({
      draft,
      updateDraft: (patch) => setDraft((prev) => ({ ...prev, ...patch })),
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
