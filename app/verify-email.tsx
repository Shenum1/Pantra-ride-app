import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useVideoConfig } from '@/hooks/useVideoConfig';
import Button from '@/components/Button';
import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';

const { width, height } = Dimensions.get('window');
const RESEND_COOLDOWN_SECONDS = 60;

// Standalone route (not local state on the signup screen) so the code box survives a
// page refresh / app restart and is reachable from login when a rider's account exists
// but was never confirmed. `resend=1` sends a fresh code on arrival — used by login,
// where the rider may have lost or never received the original email.
export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ email?: string; resend?: string }>();
  const email = (params.email ?? '').trim().toLowerCase();

  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(params.resend === '1' ? 0 : RESEND_COOLDOWN_SECONDS);
  const autoResendDone = useRef(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const sendCode = async (silent: boolean) => {
    if (!email) return;
    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) throw new Error(error.message);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      Toast.show({
        type: 'success',
        text1: silent ? 'Check your email' : 'Code Resent',
        text2: silent ? "We've sent you a new verification code" : 'Check your email again',
        position: 'top',
      });
    } catch (error: any) {
      console.error('VerifyEmail: resend failed:', error);
      Toast.show({
        type: 'error',
        text1: 'Could Not Send Code',
        text2: error.message || 'Please try again',
        position: 'top',
      });
    } finally {
      setIsResending(false);
    }
  };

  useEffect(() => {
    if (params.resend === '1' && !autoResendDone.current) {
      autoResendDone.current = true;
      void sendCode(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVerify = async () => {
    if (!code.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Code',
        text2: 'Enter the verification code from your email',
        position: 'top',
      });
      return;
    }
    setIsVerifying(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'signup' });
      if (error) throw new Error(error.message);
      router.replace('/');
    } catch (error: any) {
      console.error('VerifyEmail: code verification failed:', error);
      Toast.show({
        type: 'error',
        text1: 'Verification Failed',
        text2: error.message || 'Invalid or expired code',
        position: 'top',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const videoUri = useVideoConfig('rider_signup');
  const player = useVideoPlayer(videoUri, (p) => { p.loop = true; p.muted = true; p.play(); });
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status }: any) => {
      if (status === 'error') setVideoFailed(true);
    });
    return () => sub.remove();
  }, [player]);

  return (
    <View style={styles.container}>
      {!videoFailed && (
        <VideoView
          player={player}
          style={styles.backgroundVideo}
          contentFit="cover"
          nativeControls={false}
        />
      )}
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Text style={styles.title}>Verify Your Email</Text>
              <Text style={styles.subtitle}>Enter the code we sent to finish signing up</Text>
            </View>

            <View style={styles.form}>
              <Text style={styles.verifyText}>
                {email
                  ? `We sent a verification code to ${email}. Enter it below to finish creating your account.`
                  : 'Enter the verification code we sent to your email.'}
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Verification Code</Text>
                <TextInput
                  style={styles.input}
                  value={code}
                  onChangeText={setCode}
                  placeholder="Enter verification code"
                  keyboardType="number-pad"
                  maxLength={12}
                  autoFocus
                  testID="signup-verify-code-input"
                />
              </View>

              <Button
                title={isVerifying ? '' : 'Verify & Continue'}
                onPress={handleVerify}
                disabled={isVerifying || !email}
                loading={isVerifying}
                style={styles.primaryButton}
                testID="signup-verify-code-button"
              />

              <Button
                title={resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Code'}
                onPress={() => sendCode(false)}
                disabled={resendCooldown > 0 || isResending || !email}
                variant="secondary"
                style={styles.secondaryButton}
                testID="signup-resend-code-button"
              />

              <Button
                title="Back to Login"
                onPress={() => router.replace('/login')}
                variant="secondary"
                style={styles.secondaryButton}
                testID="verify-email-back-button"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.black,
  },
  backgroundVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    width,
    height,
    zIndex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width,
    height,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 2,
  },
  safeArea: {
    flex: 1,
    zIndex: 3,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.light.white,
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  form: {
    width: '100%',
  },
  verifyText: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.white,
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    color: Colors.light.black,
  },
  primaryButton: {
    marginTop: 8,
    marginBottom: 16,
  },
  secondaryButton: {
    marginBottom: 16,
  },
});
