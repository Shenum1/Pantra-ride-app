import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { CheckCircle, XCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Button from '@/components/Button';
import { FlutterwaveService } from '@/lib/flutterwave-service';
import { trpcClient } from '@/lib/trpc';
import { CheckoutSession } from '@/lib/checkout-session';
import { useAuth } from '@/hooks/useAuthStore';
import { useQueryClient } from '@tanstack/react-query';

// Where Flutterwave returns the user after checkout (see
// resolveCheckoutReturnUrl in backend/lib/flutterwave-checkout.ts).
// - Web, signed in: confirms the payment and credits the wallet.
// - Inside the phone app's checkout sheet: this is Pantra's WEBSITE, where
//   the rider isn't signed in — so it doesn't try to confirm anything, it
//   just tells them to close the window. The app confirms the payment
//   itself as soon as the sheet closes (app/payment-initialize.tsx).
// - Legacy: an app link from an older build lands here inside the app.
export default function PaymentCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const queryClient = useQueryClient();

  const txRef = (params.tx_ref as string) || (params['tx-ref'] as string) || '';
  const providerStatus = (params.status as string) || '';
  const paymentMethodId = (params.payment_method_id as string) || 'flutterwave';

  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [status, setStatus] = useState<'verifying' | 'success' | 'failed' | 'cancelled' | 'return_to_app'>('verifying');
  const [message, setMessage] = useState('Verifying your payment…');

  useEffect(() => {
    if (authLoading) return;
    if (CheckoutSession.owns(txRef) && router.canGoBack()) {
      router.back();
      return;
    }
    if (providerStatus === 'cancelled') {
      setStatus('cancelled');
      setMessage(isAuthenticated ? 'Payment cancelled. No money was taken.' : 'Payment cancelled. No money was taken. You can close this window.');
      return;
    }
    // Not signed in here = this page opened inside the phone app's checkout
    // sheet. Never claim success from the URL alone; the app confirms with
    // the server when the sheet closes.
    if (!isAuthenticated) {
      setStatus('return_to_app');
      setMessage('All done here. Close this window to return to Pantra — the app will confirm your payment.');
      return;
    }
    if (!txRef) {
      setStatus('failed');
      setMessage('No transaction reference found. Please verify manually.');
      return;
    }
    verify();
  }, [txRef, authLoading, isAuthenticated]);

  const verify = async () => {
    try {
      setStatus('verifying');
      setMessage('Verifying your payment…');

      const result = await FlutterwaveService.verifyTransaction(txRef);

      if (result.status === 'success') {
        // Always confirm with the backend — never rely on a purpose flag
        // surviving the provider's redirect. The backend re-verifies txRef
        // with Flutterwave itself, records the provider's confirmed amount
        // (a wallet top-up, or a driver's commission payment — it knows
        // which from its own record), and is idempotent if the webhook
        // already recorded it — see backend/trpc/routes/payments/wallet/credit/route.ts.
        const credit = await trpcClient.payments.wallet.credit.mutate({
          gateway: 'flutterwave',
          reference: txRef,
          paymentMethodId,
        });
        if (!credit.status) {
          setStatus('failed');
          setMessage(credit.message || 'Payment could not be verified. Please contact support if funds were deducted.');
          return;
        }
        const isCommissionPayment = credit.purpose === 'commission_settlement';
        if (!isCommissionPayment) {
          await queryClient.invalidateQueries({ queryKey: ['walletData'] });
        }
        setMessage(isCommissionPayment ? 'Commission paid. Thank you!' : 'Wallet funded successfully!');
        setStatus('success');

        setTimeout(() => {
          router.replace((isCommissionPayment ? '/(driver-tabs)/wallet' : '/wallet') as any);
        }, 2000);
      } else {
        setStatus('failed');
        setMessage('Payment could not be verified. Please contact support if funds were deducted.');
      }
    } catch {
      setStatus('failed');
      setMessage('Verification failed. Please contact support if funds were deducted.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Payment Verification',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: Colors.light.background },
        }}
      />

      <View style={styles.content}>
        {status === 'verifying' && <ActivityIndicator size={64} color={Colors.light.primary} />}
        {(status === 'success' || status === 'return_to_app') && <CheckCircle size={64} color="#4CAF50" />}
        {(status === 'failed' || status === 'cancelled') && <XCircle size={64} color={status === 'failed' ? '#F44336' : Colors.light.gray} />}

        <Text style={styles.message}>{message}</Text>

        {status === 'failed' && (
          <View style={styles.buttons}>
            <Button title="Try Again" onPress={verify} />
            <Button title="Go Home" onPress={() => router.replace('/(tabs)/home' as any)} variant="outline" />
          </View>
        )}

        {status === 'cancelled' && isAuthenticated && (
          <View style={styles.buttons}>
            <Button title="Back to wallet" onPress={() => router.replace('/wallet' as any)} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 24,
  },
  message: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  buttons: {
    width: '100%',
    gap: 12,
  },
});
