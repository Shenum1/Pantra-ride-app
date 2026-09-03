import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import Button from '@/components/Button';
import Colors from '@/constants/colors';
import {
  requestPasswordResetEmail,
  verifyResetCode,
  completePasswordReset,
  discardRecoverySession,
} from '@/lib/password-reset-service';
import { validatePassword, PASSWORD_POLICY_HINT } from '@/lib/password-policy';

const { width, height } = Dimensions.get('window');
const COOLDOWN_SECONDS = 60;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = 'request' | 'verify' | 'newPassword';

export default function ForgotPasswordScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const backTarget = from === 'driver' ? '/driver-login' : '/login';

  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const stepRef = useRef(step);
  useEffect(() => { stepRef.current = step; }, [step]);

  // Backstop for hardware-back/swipe-back leaving mid-flow: if a recovery
  // session was ever established (step advanced past 'request'), make sure
  // it's discarded even if the user never reaches the explicit success path.
  useEffect(() => {
    return () => {
      if (stepRef.current !== 'request') {
        void discardRecoverySession();
      }
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSendCode = async () => {
    if (!email || !EMAIL_REGEX.test(email)) {
      Toast.show({ type: 'error', text1: 'Invalid Email', text2: 'Please enter a valid email address', position: 'top' });
      return;
    }
    setIsSubmitting(true);
    try {
      await requestPasswordResetEmail(email);
      setStep('verify');
      setCooldown(COOLDOWN_SECONDS);
      Toast.show({
        type: 'success',
        text1: 'Check your email',
        text2: "If an account exists for that email, we've sent a reset code.",
        position: 'top',
        visibilityTime: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    if (cooldown > 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await requestPasswordResetEmail(email);
      setCooldown(COOLDOWN_SECONDS);
      Toast.show({ type: 'success', text1: 'Code Resent', text2: 'Check your email again', position: 'top' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code.trim()) {
      Toast.show({ type: 'error', text1: 'Invalid Code', text2: 'Enter the verification code from your email', position: 'top' });
      return;
    }
    setIsSubmitting(true);
    try {
      await verifyResetCode(email, code);
      setStep('newPassword');
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Verification Failed', text2: error.message || 'Invalid or expired code', position: 'top' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetNewPassword = async () => {
    const { valid, message } = validatePassword(newPassword);
    if (!valid) {
      Toast.show({ type: 'error', text1: 'Weak Password', text2: message ?? undefined, position: 'top', visibilityTime: 5000 });
      return;
    }
    if (newPassword !== confirmPassword) {
      Toast.show({ type: 'error', text1: 'Password Mismatch', text2: 'Passwords do not match', position: 'top' });
      return;
    }
    setIsSubmitting(true);
    try {
      const role = await completePasswordReset(newPassword);
      Toast.show({
        type: 'success',
        text1: 'Password Updated',
        text2: 'Please sign in with your new password',
        position: 'top',
        visibilityTime: 4000,
      });
      router.replace(role === 'driver' ? '/driver-login' : '/login');
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Reset Failed', text2: error.message || 'Please try again', position: 'top', visibilityTime: 5000 });
    } finally {
      await discardRecoverySession();
      setIsSubmitting(false);
    }
  };

  const handleBack = async () => {
    if (step !== 'request') {
      await discardRecoverySession();
    }
    router.replace(backTarget);
  };

  const player = useVideoPlayer(
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    (p) => { p.loop = true; p.muted = true; p.play(); }
  );

  const stepSubtitle: Record<Step, string> = {
    request: 'Enter your account email to receive a reset code',
    verify: 'Enter the verification code sent to your email',
    newPassword: 'Choose a new password',
  };

  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={styles.backgroundVideo}
        contentFit="cover"
        nativeControls={false}
      />
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <Text style={styles.title}>Reset Password</Text>
              <Text style={styles.subtitle}>{stepSubtitle[step]}</Text>
            </View>

            <View style={styles.form}>
              {step === 'request' && (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="Enter your email"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      testID="reset-email-input"
                    />
                  </View>

                  <Button
                    title={isSubmitting ? '' : 'Send Reset Code'}
                    onPress={handleSendCode}
                    disabled={isSubmitting}
                    loading={isSubmitting}
                    style={styles.button}
                    testID="send-reset-code-button"
                  />
                </>
              )}

              {step === 'verify' && (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Verification Code</Text>
                    <TextInput
                      style={styles.input}
                      value={code}
                      onChangeText={setCode}
                      placeholder="Enter verification code"
                      keyboardType="number-pad"
                      maxLength={12}
                      testID="reset-code-input"
                    />
                  </View>

                  <Button
                    title={isSubmitting ? '' : 'Verify Code'}
                    onPress={handleVerifyCode}
                    disabled={isSubmitting}
                    loading={isSubmitting}
                    style={styles.button}
                    testID="verify-reset-code-button"
                  />

                  <Button
                    title={cooldown > 0 ? `Resend Code (${cooldown}s)` : 'Resend Code'}
                    onPress={handleResendCode}
                    disabled={isSubmitting || cooldown > 0}
                    variant="secondary"
                    style={styles.resendButton}
                    testID="resend-reset-code-button"
                  />
                </>
              )}

              {step === 'newPassword' && (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>New Password</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        style={styles.passwordInput}
                        value={newPassword}
                        onChangeText={setNewPassword}
                        placeholder="Enter new password"
                        secureTextEntry={!showNewPassword}
                        autoComplete="password-new"
                        testID="new-password-input"
                      />
                      <Pressable onPress={() => setShowNewPassword(!showNewPassword)} style={styles.eyeButton}>
                        {showNewPassword ? (
                          <EyeOff size={20} color={Colors.light.gray} />
                        ) : (
                          <Eye size={20} color={Colors.light.gray} />
                        )}
                      </Pressable>
                    </View>
                    <Text style={styles.hintText}>{PASSWORD_POLICY_HINT}</Text>
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Confirm Password</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        style={styles.passwordInput}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Confirm new password"
                        secureTextEntry={!showConfirmPassword}
                        autoComplete="password-new"
                        testID="confirm-new-password-input"
                      />
                      <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeButton}>
                        {showConfirmPassword ? (
                          <EyeOff size={20} color={Colors.light.gray} />
                        ) : (
                          <Eye size={20} color={Colors.light.gray} />
                        )}
                      </Pressable>
                    </View>
                  </View>

                  <Button
                    title={isSubmitting ? '' : 'Reset Password'}
                    onPress={handleSetNewPassword}
                    disabled={isSubmitting}
                    loading={isSubmitting}
                    style={styles.button}
                    testID="set-new-password-button"
                  />
                </>
              )}

              <Button
                title="Back to Login"
                onPress={handleBack}
                variant="secondary"
                disabled={isSubmitting}
                style={styles.backButton}
                testID="forgot-password-back-button"
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
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
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
  inputContainer: {
    marginBottom: 24,
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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: Colors.light.black,
  },
  eyeButton: {
    paddingHorizontal: 16,
  },
  hintText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 8,
  },
  button: {
    marginTop: 8,
    marginBottom: 16,
  },
  resendButton: {
    marginBottom: 16,
  },
  backButton: {
    marginTop: 8,
  },
});
