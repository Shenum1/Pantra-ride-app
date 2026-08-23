import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { CheckCircle, XCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Button from '@/components/Button';
import { FlutterwaveService } from '@/lib/flutterwave-service';
import { trpcClient } from '@/lib/trpc';
import { useQueryClient } from '@tanstack/react-query';

export default function PaymentCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const queryClient = useQueryClient();

  const txRef = (params.tx_ref as string) || (params['tx-ref'] as string) || '';
  const purpose = (params.purpose as string) || '';
  const paymentMethodId = (params.payment_method_id as string) || 'flutterwave';

  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying');
  const [message, setMessage] = useState('Verifying your payment…');

  useEffect(() => {
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
        if (purpose === 'wallet_funding') {
          // The backend re-verifies txRef with Flutterwave itself and credits
          // the provider's confirmed amount — see
          // backend/trpc/routes/payments/wallet/credit/route.ts.
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
          await queryClient.invalidateQueries({ queryKey: ['walletData'] });
          setMessage('Wallet funded successfully!');
        } else {
          setMessage('Payment successful!');
        }
        setStatus('success');

        setTimeout(() => {
          router.replace(purpose === 'wallet_funding' ? ('/wallet' as any) : ('/(tabs)/home' as any));
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
        {status === 'failed' && <XCircle size={64} color="#F44336" />}

        <Text style={styles.message}>{message}</Text>

        {status === 'failed' && (
          <View style={styles.buttons}>
            <Button title="Try Again" onPress={verify} />
            <Button title="Go Home" onPress={() => router.replace('/(tabs)/home' as any)} variant="outline" />
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
