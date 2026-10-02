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
import { useQueryClient } from '@tanstack/react-query';

// Where Flutterwave returns the user after checkout (see
// resolveCheckoutReturnUrl in the flutterwave initialize route). Reached
// three ways: on web as a full page load; on Android as a deep link while
// the in-app checkout screen is still open underneath (it handles the
// payment — this screen just steps back); and on a cold start if the app
// was closed mid-payment (this screen confirms the payment itself).
export default function PaymentCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const queryClient = useQueryClient();

  const txRef = (params.tx_ref as string) || (params['tx-ref'] as string) || '';
  const providerStatus = (params.status as string) || '';
  const paymentMethodId = (params.payment_method_id as string) || 'flutterwave';

  const [status, setStatus] = useState<'verifying' | 'success' | 'failed' | 'cancelled'>('verifying');
  const [message, setMessage] = useState('Verifying your payment…');

  useEffect(() => {
    if (CheckoutSession.owns(txRef) && router.canGoBack()) {
      router.back();
      return;
    }
    if (providerStatus === 'cancelled') {
      setStatus('cancelled');
      setMessage('Payment cancelled. No money was taken.');
      return;
    }
    if (!txRef) {
      setStatus('failed');
      setMessage('No transaction reference found. Please verify manually.');
      return;
    }
    verify();
  }, [txRef]);

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
        {status === 'success' && <CheckCircle size={64} color="#4CAF50" />}
        {(status === 'failed' || status === 'cancelled') && <XCircle size={64} color={status === 'failed' ? '#F44336' : Colors.light.gray} />}

        <Text style={styles.message}>{message}</Text>

        {status === 'failed' && (
          <View style={styles.buttons}>
            <Button title="Try Again" onPress={verify} />
            <Button title="Go Home" onPress={() => router.replace('/(tabs)/home' as any)} variant="outline" />
          </View>
        )}

        {status === 'cancelled' && (
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
