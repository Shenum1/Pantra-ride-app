import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuthStore';
import { useDriverAuth } from '@/hooks/useDriverAuthStore';
import { trpcClient } from '@/lib/trpc';
import { PendingCheckoutStore } from '@/lib/pending-checkout';
import { CheckoutSession } from '@/lib/checkout-session';

// Finishes confirming a checkout the app started but never got to confirm —
// usually because Android shut the app down in the background while the
// Flutterwave sheet was open, so it restarted from scratch afterwards. Runs
// once signed in, and again whenever the app comes back to the foreground.
// The confirmation is idempotent: if the webhook already credited the
// payment, the server just reports it as done, so this never double-credits.
export function PendingCheckoutResumer() {
  const { user, isLoading: userLoading } = useAuth();
  const { driver, isLoading: driverLoading } = useDriverAuth();
  const queryClient = useQueryClient();
  const runningRef = useRef(false);

  const signedIn = !!user?.id || !!driver?.id;

  useEffect(() => {
    if (Platform.OS === 'web' || userLoading || driverLoading || !signedIn) return;

    const resume = async () => {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        const pending = await PendingCheckoutStore.load();
        // Still open on the payment screen (the app wasn't shut down) — that
        // screen confirms it and shows the result itself.
        if (!pending || CheckoutSession.owns(pending.reference)) return;

        const result = await trpcClient.payments.wallet.credit.mutate({
          gateway: pending.gateway,
          reference: pending.reference,
          paymentMethodId: pending.gateway,
        });

        // Not paid (yet) — leave it saved; a later start-up or the webhook
        // will settle it, and it expires on its own.
        if (!result.status) return;

        await PendingCheckoutStore.clear(pending.reference);
        const isCommission = result.purpose === 'commission_settlement';
        if (!isCommission) {
          await queryClient.invalidateQueries({ queryKey: ['walletData'] });
        }
        Toast.show({
          type: 'success',
          text1: isCommission ? 'Commission paid' : 'Wallet funded',
          text2: `₦${pending.amount.toLocaleString()} ${isCommission ? 'payment received. Thank you!' : 'has been added to your wallet.'}`,
          position: 'top',
          visibilityTime: 4000,
        });
      } catch (error) {
        console.error('Could not resume pending checkout:', error);
      } finally {
        runningRef.current = false;
      }
    };

    void resume();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void resume();
    });
    return () => subscription.remove();
  }, [signedIn, userLoading, driverLoading, queryClient]);

  return null;
}
