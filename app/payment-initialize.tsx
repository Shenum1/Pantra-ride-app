import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { CheckCircle, XCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Button from '@/components/Button';
import { PaystackService } from '@/lib/paystack-service';
import { FlutterwaveService } from '@/lib/flutterwave-service';
import { useAuth } from '@/hooks/useAuthStore';
import { useWallet } from '@/hooks/useWalletStore';
import * as Linking from 'expo-linking';

type PaymentStatus = 'initializing' | 'ready' | 'processing' | 'success' | 'failed';

export default function PaymentInitializeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { addMoneyAsync } = useWallet();
  
  const gateway = params.gateway as string;
  const amount = parseFloat(params.amount as string);
  const purpose = params.purpose as string;
  const paymentMethodId = (params.paymentMethodId as string) || gateway;
  
  const [status, setStatus] = useState<PaymentStatus>('initializing');
  const [message, setMessage] = useState('Initializing payment...');
  const [paymentUrl, setPaymentUrl] = useState<string>('');
  const [reference, setReference] = useState<string>('');

  useEffect(() => {
    initializePayment();
  }, []);

  const initializePayment = async () => {
    try {
      setStatus('initializing');
      setMessage('Setting up payment...');

      if (!user?.email) {
        setStatus('failed');
        setMessage('User email is required for payment');
        return;
      }

      if (gateway === 'paystack') {
        const result = await PaystackService.initializeTransaction({
          amount,
          email: user.email,
          metadata: {
            purpose,
            userId: user.id,
          },
        });

        if (result.status && result.data) {
          setPaymentUrl(result.data.authorization_url);
          setReference(result.data.reference);
          setStatus('ready');
          setMessage('Payment ready. Click below to proceed.');
        } else {
          setStatus('failed');
          setMessage(result.message);
        }
      } else if (gateway === 'flutterwave') {
        const result = await FlutterwaveService.initializePayment({
          amount,
          email: user.email,
          name: user.name || 'Customer',
          phone_number: user.phone,
          meta: {
            purpose,
            userId: user.id,
          },
        });

        if (result.status === 'success' && result.data) {
          setPaymentUrl(result.data.link);
          setReference(result.data.tx_ref || '');
          setStatus('ready');
          setMessage('Payment ready. Click below to proceed.');
        } else {
          setStatus('failed');
          setMessage(result.message);
        }
      }
    } catch (error) {
      console.error('Payment initialization error:', error);
      setStatus('failed');
      setMessage('Failed to initialize payment. Please try again.');
    }
  };

  const handleOpenPayment = async () => {
    if (!paymentUrl) return;

    try {
      setStatus('processing');
      setMessage('Opening payment page...');

      const canOpen = await Linking.canOpenURL(paymentUrl);
      if (canOpen) {
        await Linking.openURL(paymentUrl);
        
        Alert.alert(
          'Complete Payment',
          'After completing payment in the browser, return to the app and click "Verify Payment".',
          [
            { text: 'Verify Payment', onPress: handleVerifyPayment },
            { text: 'Cancel', style: 'cancel', onPress: () => setStatus('ready') },
          ]
        );
      } else {
        setStatus('failed');
        setMessage('Unable to open payment page');
      }
    } catch (error) {
      console.error('Error opening payment URL:', error);
      setStatus('failed');
      setMessage('Failed to open payment page');
    }
  };

  const handleVerifyPayment = async () => {
    try {
      setStatus('processing');
      setMessage('Verifying payment...');

      if (gateway === 'paystack') {
        const result = await PaystackService.verifyTransaction(reference);
        if (result.status) {
          setStatus('success');
          setMessage('Payment successful!');
          setTimeout(() => {
            router.replace('/(tabs)/home' as any);
          }, 2000);
        } else {
          setStatus('failed');
          setMessage('Payment verification failed');
        }
      } else if (gateway === 'flutterwave') {
        const result = await FlutterwaveService.verifyTransaction(reference);
        if (result.status === 'success') {
          if (purpose === 'wallet_funding') {
            await addMoneyAsync({ amount, paymentMethodId });
          }
          setStatus('success');
          setMessage(purpose === 'wallet_funding' ? 'Wallet funded successfully!' : 'Payment successful!');
          setTimeout(() => {
            router.replace(purpose === 'wallet_funding' ? ('/wallet' as any) : ('/(tabs)/home' as any));
          }, 2000);
        } else {
          setStatus('failed');
          setMessage('Payment verification failed');
        }
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      setStatus('failed');
      setMessage('Failed to verify payment');
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle size={64} color="#4CAF50" />;
      case 'failed':
        return <XCircle size={64} color="#F44336" />;
      default:
        return <ActivityIndicator size={64} color={Colors.light.primary} />;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Payment',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: Colors.light.background },
        }}
      />

      <View style={styles.content}>
        <View style={styles.statusContainer}>
          {getStatusIcon()}
          <Text style={styles.statusText}>{message}</Text>
          
          {status === 'ready' && (
            <Text style={styles.amountText}>₦{amount.toFixed(0)}</Text>
          )}
        </View>

        {status === 'failed' && (
          <View style={styles.buttonContainer}>
            <Button title="Try Again" onPress={initializePayment} />
            <Button
              title="Cancel"
              onPress={() => router.back()}
              variant="outline"
            />
          </View>
        )}

        {status === 'ready' && (
          <View style={styles.buttonContainer}>
            <Button title="Proceed to Payment" onPress={handleOpenPayment} />
            <Button
              title="Cancel"
              onPress={() => router.back()}
              variant="outline"
            />
          </View>
        )}

        {status === 'processing' && (
          <View style={styles.buttonContainer}>
            <Button
              title="Verify Payment"
              onPress={handleVerifyPayment}
            />
          </View>
        )}

        {status === 'success' && (
          <View style={styles.successInfo}>
            <Text style={styles.successInfoText}>
              Redirecting to home...
            </Text>
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
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
    marginTop: 24,
  },
  amountText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.light.primary,
    marginTop: 16,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  successInfo: {
    padding: 16,
    backgroundColor: Colors.light.lightGray,
    borderRadius: 12,
    marginTop: 24,
  },
  successInfoText: {
    fontSize: 14,
    color: Colors.light.text,
    textAlign: 'center',
  },
});
