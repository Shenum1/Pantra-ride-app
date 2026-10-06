import AsyncStorage from '@react-native-async-storage/async-storage';

// The checkout the app opened but hasn't confirmed yet, saved to storage
// before the checkout sheet opens. Android often shuts the app down in the
// background while the sheet is open, and the payment screen's progress is
// lost when it restarts — so on start-up the app finishes confirming any
// payment saved here (components/PendingCheckoutResumer.tsx).

export interface PendingCheckout {
  reference: string;
  gateway: 'paystack' | 'flutterwave';
  purpose: string;
  amount: number;
  startedAt: number;
}

const KEY = 'pantra.pendingCheckout';

// A checkout older than this is abandoned — stop trying to confirm it. The
// server-side webhook still credits any real payment regardless.
export const PENDING_CHECKOUT_MAX_AGE_MS = 60 * 60 * 1000;

export const PendingCheckoutStore = {
  async save(checkout: PendingCheckout): Promise<void> {
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(checkout));
    } catch (error) {
      console.error('Could not save pending checkout:', error);
    }
  },

  async load(): Promise<PendingCheckout | null> {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PendingCheckout;
      if (!parsed?.reference || Date.now() - parsed.startedAt > PENDING_CHECKOUT_MAX_AGE_MS) {
        await AsyncStorage.removeItem(KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  },

  // Only clears if it's still the same checkout, so finishing an old one
  // never wipes a newer one.
  async clear(reference: string): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw && (JSON.parse(raw) as PendingCheckout).reference === reference) {
        await AsyncStorage.removeItem(KEY);
      }
    } catch {
      // nothing to clear
    }
  },
};
