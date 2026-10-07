import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CURRENT_POLICY_VERSIONS, PolicyType, PolicyVersions } from '@/lib/policy-acceptance';

// Local cache of terms acceptance. The record that counts is server-side
// (public.policy_acceptances); this holds an acceptance until it can be
// written there. A checkbox ticked at signup happens before any Supabase
// session exists (email signups wait for the verification code), so the
// versions accepted are kept here as "pending" and
// components/PolicyAcceptanceGate.tsx writes them for the first signed-in
// account, retrying on every app start until that succeeds.
const PENDING_KEY = 'policy_acceptance_pending';

export interface PendingPolicyAcceptance {
  versions: Partial<PolicyVersions>;
  acceptedAt: string;
  // Email signups know who's signing up — the gate only applies the
  // acceptance to that account, so a failed signup followed by a login to a
  // different account doesn't carry it over. Absent for Google signups (the
  // account isn't known until after the Google prompt).
  email?: string;
}

interface TermsState {
  hasAcceptedTerms: boolean;
  termsAcceptedDate: string | null;
  privacyAcceptedDate: string | null;
  pendingAcceptance: PendingPolicyAcceptance | null;
  isLoading: boolean;
  acceptTerms: (policies?: PolicyType[], email?: string) => Promise<void>;
  checkTermsAcceptance: () => Promise<void>;
  loadPendingAcceptance: () => Promise<PendingPolicyAcceptance | null>;
  clearPendingAcceptance: () => Promise<void>;
  clearTermsAcceptance: () => Promise<void>;
}

const readPending = async (): Promise<PendingPolicyAcceptance | null> => {
  const raw = await AsyncStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingPolicyAcceptance;
  } catch {
    return null;
  }
};

export const useTermsStore = create<TermsState>((set) => ({
  hasAcceptedTerms: false,
  termsAcceptedDate: null,
  privacyAcceptedDate: null,
  pendingAcceptance: null,
  isLoading: false,

  // Records that the user just accepted these policies at their current
  // versions. Defaults to the rider set; driver signup passes driver_terms too.
  acceptTerms: async (policies: PolicyType[] = ['terms', 'privacy'], email?: string) => {
    try {
      set({ isLoading: true });
      const currentDate = new Date().toISOString();
      const versions: Partial<PolicyVersions> = {};
      for (const policy of policies) versions[policy] = CURRENT_POLICY_VERSIONS[policy];
      const pendingAcceptance: PendingPolicyAcceptance = {
        versions,
        acceptedAt: currentDate,
        ...(email ? { email: email.trim().toLowerCase() } : {}),
      };

      await AsyncStorage.setItem('terms_accepted', 'true');
      await AsyncStorage.setItem('terms_accepted_date', currentDate);
      await AsyncStorage.setItem('privacy_accepted_date', currentDate);
      await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pendingAcceptance));

      set({
        hasAcceptedTerms: true,
        termsAcceptedDate: currentDate,
        privacyAcceptedDate: currentDate,
        pendingAcceptance,
        isLoading: false,
      });

      console.log('Terms: accepted', versions);
    } catch (error) {
      console.error('Terms: Error accepting terms:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  checkTermsAcceptance: async () => {
    try {
      set({ isLoading: true });
      const accepted = await AsyncStorage.getItem('terms_accepted');
      const termsDate = await AsyncStorage.getItem('terms_accepted_date');
      const privacyDate = await AsyncStorage.getItem('privacy_accepted_date');
      const pendingAcceptance = await readPending();

      set({
        hasAcceptedTerms: accepted === 'true',
        termsAcceptedDate: termsDate,
        privacyAcceptedDate: privacyDate,
        pendingAcceptance,
        isLoading: false,
      });

      console.log('Terms: Checked acceptance status:', accepted === 'true');
    } catch (error) {
      console.error('Terms: Error checking terms acceptance:', error);
      set({ isLoading: false });
    }
  },

  loadPendingAcceptance: async () => {
    try {
      const pendingAcceptance = await readPending();
      set({ pendingAcceptance });
      return pendingAcceptance;
    } catch {
      return null;
    }
  },

  // Called once the pending acceptance is safely stored server-side.
  clearPendingAcceptance: async () => {
    await AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
    set({ pendingAcceptance: null });
  },

  clearTermsAcceptance: async () => {
    try {
      await AsyncStorage.removeItem('terms_accepted');
      await AsyncStorage.removeItem('terms_accepted_date');
      await AsyncStorage.removeItem('privacy_accepted_date');
      await AsyncStorage.removeItem(PENDING_KEY);

      set({
        hasAcceptedTerms: false,
        termsAcceptedDate: null,
        privacyAcceptedDate: null,
        pendingAcceptance: null,
      });

      console.log('Terms: Terms acceptance cleared');
    } catch (error) {
      console.error('Terms: Error clearing terms acceptance:', error);
      throw error;
    }
  },
}));
