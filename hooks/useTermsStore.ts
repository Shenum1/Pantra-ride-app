import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface TermsState {
  hasAcceptedTerms: boolean;
  termsAcceptedDate: string | null;
  privacyAcceptedDate: string | null;
  isLoading: boolean;
  acceptTerms: () => Promise<void>;
  checkTermsAcceptance: () => Promise<void>;
  clearTermsAcceptance: () => Promise<void>;
}

export const useTermsStore = create<TermsState>((set) => ({
  hasAcceptedTerms: false,
  termsAcceptedDate: null,
  privacyAcceptedDate: null,
  isLoading: false,

  acceptTerms: async () => {
    try {
      set({ isLoading: true });
      const currentDate = new Date().toISOString();
      
      await AsyncStorage.setItem('terms_accepted', 'true');
      await AsyncStorage.setItem('terms_accepted_date', currentDate);
      await AsyncStorage.setItem('privacy_accepted_date', currentDate);
      
      set({
        hasAcceptedTerms: true,
        termsAcceptedDate: currentDate,
        privacyAcceptedDate: currentDate,
        isLoading: false,
      });
      
      console.log('Terms: Terms and Privacy Policy accepted');
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
      
      set({
        hasAcceptedTerms: accepted === 'true',
        termsAcceptedDate: termsDate,
        privacyAcceptedDate: privacyDate,
        isLoading: false,
      });
      
      console.log('Terms: Checked acceptance status:', accepted === 'true');
    } catch (error) {
      console.error('Terms: Error checking terms acceptance:', error);
      set({ isLoading: false });
    }
  },

  clearTermsAcceptance: async () => {
    try {
      await AsyncStorage.removeItem('terms_accepted');
      await AsyncStorage.removeItem('terms_accepted_date');
      await AsyncStorage.removeItem('privacy_accepted_date');
      
      set({
        hasAcceptedTerms: false,
        termsAcceptedDate: null,
        privacyAcceptedDate: null,
      });
      
      console.log('Terms: Terms acceptance cleared');
    } catch (error) {
      console.error('Terms: Error clearing terms acceptance:', error);
      throw error;
    }
  },
}));
