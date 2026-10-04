import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { XCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Button from '@/components/Button';
import { GoogleAuthService } from '@/lib/google-auth-service';
import { useAuth } from '@/hooks/useAuthStore';
import { useDriverAuth } from '@/hooks/useDriverAuthStore';
import { trpc } from '@/lib/trpc';

// Where Supabase returns the browser after web Google sign-in (see
// lib/google-auth-service.web.ts). Finishes the same rider/driver setup the
// native flow does in login/signup/driver-login/driver-signup.
export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; error?: string; error_description?: string }>();
  const { completeGoogleSignIn: completeRider } = useAuth();
  const { completeGoogleSignIn: completeDriver } = useDriverAuth();
  const utils = trpc.useUtils();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // An auth code can only be exchanged once.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const finish = async () => {
      if (params.error) {
        throw new Error(params.error_description || 'Google sign-in was cancelled.');
      }
      if (!params.code) {
        throw new Error('Google sign-in did not return an authorization code.');
      }

      const { role, ...result } = await GoogleAuthService.completeRedirect(params.code);

      if (role === 'rider') {
        await completeRider(result);
        router.replace('/(tabs)/home');
        return;
      }

      const { isNewDriver } = await completeDriver(result);
      if (isNewDriver) {
        router.replace('/driver-verification/credentials' as any);
        return;
      }
      try {
        const status = await utils.driverVerification.getStatus.fetch();
        router.replace(
          status.verificationStatus === 'PENDING'
            ? ('/driver-verification/credentials' as any)
            : '/(driver-tabs)/dashboard'
        );
      } catch (error) {
        console.warn('Auth callback: could not read verification status, using the dashboard gate', error);
        router.replace('/(driver-tabs)/dashboard');
      }
    };

    finish().catch((error: any) => {
      console.error('Auth callback: Google sign-in failed:', error);
      setErrorMessage(error?.message ?? 'Google sign-in failed. Please try again.');
    });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {errorMessage ? (
          <>
            <XCircle size={64} color="#F44336" />
            <Text style={styles.message}>{errorMessage}</Text>
            <View style={styles.buttons}>
              <Button title="Back to sign in" onPress={() => router.replace('/role-selection' as any)} />
            </View>
          </>
        ) : (
          <>
            <ActivityIndicator size={64} color={Colors.light.primary} />
            <Text style={styles.message}>Signing you in…</Text>
          </>
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
