import React, { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View, Text, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { CheckCircle, XCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Button from '@/components/Button';
import { PaystackService } from '@/lib/paystack-service';
import { FlutterwaveService } from '@/lib/flutterwave-service';
import { useAuth } from '@/hooks/useAuthStore';
import { trpcClient } from '@/lib/trpc';
import { CheckoutSession } from '@/lib/checkout-session';
import { DriverWalletService } from '@/lib/driver-wallet-service';
import { useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

// 'closed': the checkout sheet was closed and a few quiet checks didn't
// find a payment yet — the user may still have paid (e.g. a bank transfer
// that settles later), so they're offered "Check payment" or "Try again"
// rather than an error.
type PaymentStatus = 'initializing' | 'ready' | 'processing' | 'closed' | 'success' | 'failed';

// Where the provider sends the user when checkout finishes.
// - Web: this site's own /payment-callback page, which confirms the payment.
// - Native: nothing from the app — the server's default, Pantra's web
//   /payment-callback page, which (opened inside the checkout sheet) just
//   tells the rider to close the window. The app deliberately does NOT ask
//   to be sent back via an app link (pantra:// / exp://): in Expo Go that
//   link reopened the project from scratch, landing the rider on the login
//   screen without ever confirming the payment. Instead the app confirms the
//   payment itself when the sheet is closed (see onCheckoutClosed).
const checkoutReturnUrl = () => (Platform.OS === 'web' ? Linking.createURL('payment-callback') : undefined);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function PaymentInitializeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const gateway = params.gateway as string;
  // 'wallet_funding' — a rider topping up (amount chosen on the previous
  // screen). 'commission_settlement' — a driver paying the cash commission
  // they owe (amount decided by the server from their current balance).
  const purpose = params.purpose as string;
  const isCommissionPayment = purpose === 'commission_settlement';
  const paymentMethodId = (params.paymentMethodId as string) || gateway;
  const [amount, setAmount] = useState<number>(parseFloat(params.amount as string) || 0);

  const [status, setStatus] = useState<PaymentStatus>('initializing');
  const [message, setMessage] = useState('Initializing payment...');
  const [paymentUrl, setPaymentUrl] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  // True while the checkout sheet is open and its outcome hasn't been handled.
  const awaitingCheckoutRef = useRef(false);
  // Android: set once the app has actually gone to the background behind the
  // sheet, so its return to the foreground means the sheet was closed.
  const leftAppRef = useRef(false);
  const checkoutClosedRef = useRef<() => void>(() => {});

  useEffect(() => {
    initializePayment();
  }, []);

  // Android's checkout sheet can't report being closed (openBrowserAsync
  // resolves immediately), so its closing is detected by Pantra coming back
  // to the foreground. iOS reports closing directly (handled in
  // handleOpenPayment); the awaiting flag makes sure it's handled only once.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (!awaitingCheckoutRef.current) return;
      if (next === 'background' || next === 'inactive') {
        leftAppRef.current = true;
        return;
      }
      if (next === 'active' && leftAppRef.current) {
        checkoutClosedRef.current();
      }
    });
    return () => subscription.remove();
  }, []);

  // Stop claiming this checkout once the screen goes away, so a later
  // provider redirect is handled by /payment-callback itself.
  useEffect(() => {
    if (!reference) return;
    return () => CheckoutSession.release(reference);
  }, [reference]);

  const initializePayment = async () => {
    try {
      setStatus('initializing');
      setMessage('Setting up payment...');

      // The server works out what's owed and uses the driver's own profile
      // email, so none of the rider-account details below are needed.
      if (isCommissionPayment) {
        const result = await DriverWalletService.startCommissionPayment(checkoutReturnUrl());
        if (result.status === 'success') {
          setPaymentUrl(result.data.link);
          setReference(result.data.tx_ref);
          setAmount(result.data.amount);
          setStatus('ready');
          setMessage('Commission payment ready. Tap below to continue.');
        } else {
          setStatus('failed');
          setMessage(result.message);
        }
        return;
      }

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
          setMessage('Payment ready. Tap below to continue.');
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
          redirect_url: checkoutReturnUrl(),
          meta: {
            purpose,
            userId: user.id,
          },
        });

        if (result.status === 'success' && result.data) {
          setPaymentUrl(result.data.link);
          setReference(result.data.tx_ref || '');
          setStatus('ready');
          setMessage('Payment ready. Tap below to continue.');
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

    // Web: checkout replaces this page in the same tab, and the provider
    // returns to this site's /payment-callback, which confirms the payment.
    if (Platform.OS === 'web') {
      window.location.assign(paymentUrl);
      return;
    }

    // Native: checkout opens in a secure browser sheet over the app (Safari
    // View / Chrome Custom Tab) — never a hand-off to the phone's browser.
    // createTask: false (Android) keeps the sheet inside Pantra's own task;
    // the default opened it as a separate task, so closing it dropped the
    // user on the home screen instead of back in the app.
    setStatus('processing');
    setMessage('Complete your payment in the secure checkout, then close it to return here.');
    CheckoutSession.claim(reference);
    awaitingCheckoutRef.current = true;
    leftAppRef.current = false;

    try {
      const result = await WebBrowser.openBrowserAsync(paymentUrl, { createTask: false });
      // iOS resolves when the rider closes the sheet; Android resolves at
      // once with 'opened', and the AppState listener above takes over.
      if (result.type !== 'opened') {
        await onCheckoutClosed();
      }
    } catch (error) {
      awaitingCheckoutRef.current = false;
      console.error('Error opening checkout:', error);
      setStatus('failed');
      setMessage('Could not open the secure checkout. Please try again.');
    }
  };

  // The rider closed the checkout sheet. Flutterwave marks a payment
  // successful the moment it completes, but give it a few seconds in case
  // it's still settling before showing "Check payment / Try again".
  const onCheckoutClosed = async () => {
    if (!awaitingCheckoutRef.current) return;
    awaitingCheckoutRef.current = false;

    for (let attempt = 0; attempt < 3; attempt++) {
      if (await handleVerifyPayment({ quiet: true })) return;
      if (attempt < 2) await sleep(2000);
    }
    setStatus('closed');
    setMessage('Checkout closed. If you completed the payment, tap "Check payment". Otherwise, you can try again.');
  };
  checkoutClosedRef.current = () => {
    void onCheckoutClosed();
  };

  const confirmPaymentWithServer = async (gatewayName: 'paystack' | 'flutterwave') => {
    // Recording happens server-side: the backend re-verifies this exact
    // reference with the provider itself, uses the provider's confirmed
    // amount (never `amount` on this screen), and decides from its own
    // record whether it's a wallet top-up or a commission payment — see
    // backend/trpc/routes/payments/wallet/credit/route.ts.
    const result = await trpcClient.payments.wallet.credit.mutate({
      gateway: gatewayName,
      reference,
      paymentMethodId,
    });
    if (!result.status) {
      throw new Error(result.message || 'Payment verified but could not be recorded. Please contact support.');
    }
    if (!isCommissionPayment) {
      await queryClient.invalidateQueries({ queryKey: ['walletData'] });
    }
  };

  // quiet: an automatic check after the sheet was closed — a "not paid yet"
  // answer is not an error then, so the caller decides what to show.
  // Returns true once the payment is confirmed (and the wallet credited).
  const handleVerifyPayment = async ({ quiet = false }: { quiet?: boolean } = {}): Promise<boolean> => {
    try {
      setStatus('processing');
      setMessage('Confirming your payment...');

      const paid =
        gateway === 'paystack'
          ? (await PaystackService.verifyTransaction(reference)).status === true
          : (await FlutterwaveService.verifyTransaction(reference)).status === 'success';

      if (!paid) {
        if (!quiet) {
          setStatus('failed');
          setMessage(
            isCommissionPayment
              ? "We couldn't confirm this payment yet. If money left your account, it will be applied to what you owe once Flutterwave confirms it."
              : "We couldn't confirm this payment yet. If money left your account, it will be added to your wallet once Flutterwave confirms it."
          );
        }
        return false;
      }

      if (purpose === 'wallet_funding' || isCommissionPayment) {
        await confirmPaymentWithServer(gateway === 'paystack' ? 'paystack' : 'flutterwave');
      }
      setStatus('success');
      setMessage(
        isCommissionPayment
          ? 'Commission paid. Thank you!'
          : purpose === 'wallet_funding'
            ? 'Wallet funded successfully!'
            : 'Payment successful!'
      );
      setTimeout(() => {
        if (isCommissionPayment) {
          // Back to wherever the driver tapped "Pay now"; that screen
          // re-checks their commission status as it comes back into focus.
          router.back();
          return;
        }
        router.replace(purpose === 'wallet_funding' ? ('/wallet' as any) : ('/(tabs)/home' as any));
      }, 2000);
      return true;
    } catch (error) {
      console.error('Payment verification error:', error);
      setStatus('failed');
      setMessage(error instanceof Error ? error.message : 'Failed to verify payment');
      return false;
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle size={64} color="#4CAF50" />;
      case 'failed':
        return <XCircle size={64} color="#F44336" />;
      case 'closed':
        return null;
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

        {status === 'failed' && !paymentUrl && (
          <View style={styles.buttonContainer}>
            <Button title="Try Again" onPress={initializePayment} />
            <Button
              title="Cancel"
              onPress={() => router.back()}
              variant="outline"
            />
          </View>
        )}

        {/* Once a checkout exists, never start a fresh one from here — the
            user may already have paid on this one. */}
        {status === 'failed' && !!paymentUrl && (
          <View style={styles.buttonContainer}>
            <Button title="Check payment" onPress={() => handleVerifyPayment()} />
            <Button title="Open checkout again" onPress={handleOpenPayment} variant="outline" />
            <Button title="Cancel" onPress={() => router.back()} variant="outline" />
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

        {status === 'closed' && (
          <View style={styles.buttonContainer}>
            <Button title="Check payment" onPress={() => handleVerifyPayment()} />
            <Button title="Try again" onPress={handleOpenPayment} variant="outline" />
          </View>
        )}

        {status === 'success' && (
          <View style={styles.successInfo}>
            <Text style={styles.successInfoText}>
              {isCommissionPayment ? 'Taking you back...' : 'Taking you back to your wallet...'}
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
