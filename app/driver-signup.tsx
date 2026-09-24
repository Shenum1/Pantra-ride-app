import React, { useEffect, useState } from 'react';
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
import { Link, router } from 'expo-router';
import { Eye, EyeOff, ArrowLeft, CheckSquare, Square } from 'lucide-react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useDriverAuth } from '@/hooks/useDriverAuthStore';
import { useTermsStore } from '@/hooks/useTermsStore';
import { useVideoConfig } from '@/hooks/useVideoConfig';
import Button from '@/components/Button';
import Colors from '@/constants/colors';
import { validatePassword, PASSWORD_POLICY_HINT } from '@/lib/password-policy';
import { supabase } from '@/lib/supabase';

const { width, height } = Dimensions.get('window');
const RESEND_COOLDOWN_SECONDS = 60;

// Registration only creates the account — full legal name, license, vehicle, and
// document details are collected next in the app/driver-verification/* wizard, the
// only path that can move a driver toward VERIFIED (always decided server-side, see
// backend/services/verification/engine.ts — never set directly by this screen or any
// other client code).
export default function DriverSignupScreen() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const { signup, verifySignupCode, loginWithGoogle, isLoading } = useDriverAuth();
  const { acceptTerms } = useTermsStore();

  // Inline step, not a separate screen — same shape as the rider signup: once the
  // account exists, this screen swaps its form for the email verification-code entry.
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [verificationCode, setVerificationCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSignup = async () => {
    const { name, email, phone, password, confirmPassword } = formData;

    // Toast rather than Alert.alert: Alert is a silent no-op on the web build, which
    // made every error on this screen invisible there.
    if (!name || !email || !phone || !password || !confirmPassword) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please fill in all fields', position: 'top' });
      return;
    }

    if (!acceptedTerms) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please accept the Terms and Conditions and Privacy Policy to continue', position: 'top' });
      return;
    }

    if (password !== confirmPassword) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Passwords do not match', position: 'top' });
      return;
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      Toast.show({ type: 'error', text1: 'Error', text2: passwordCheck.message ?? 'Password does not meet the requirements', position: 'top', visibilityTime: 5000 });
      return;
    }

    try {
      await acceptTerms();
      const { needsEmailConfirmation } = await signup(name, email, phone, password);
      if (needsEmailConfirmation) {
        setStep('verify');
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        Toast.show({
          type: 'success',
          text1: 'Check your email',
          text2: 'Enter the verification code we sent to finish creating your account',
          position: 'top',
          visibilityTime: 5000,
        });
        return;
      }
      router.replace('/driver-verification/credentials' as any);
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Registration Failed', text2: error?.message ?? 'Please try again', position: 'top', visibilityTime: 5000 });
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      Toast.show({ type: 'error', text1: 'Invalid Code', text2: 'Enter the verification code from your email', position: 'top' });
      return;
    }
    try {
      await verifySignupCode(formData.email, verificationCode);
      router.replace('/driver-verification/credentials' as any);
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Verification Failed', text2: error?.message || 'Invalid or expired code', position: 'top', visibilityTime: 5000 });
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: formData.email.trim().toLowerCase() });
      if (error) throw new Error(error.message);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      Toast.show({ type: 'success', text1: 'Code Resent', text2: 'Check your email again', position: 'top' });
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Could Not Resend', text2: error?.message || 'Please try again', position: 'top' });
    }
  };

  const handleGoogleSignup = async () => {
    try {
      await loginWithGoogle();
      router.replace('/driver-verification/credentials' as any);
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Google Sign-In Failed', text2: error?.message ?? 'Please try again.', position: 'top', visibilityTime: 5000 });
    }
  };

  const videoUri = useVideoConfig('driver_signup');
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
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.backButton}>
              <Pressable
                onPress={() => router.back()}
                style={styles.backButtonInner}
              >
                <ArrowLeft size={24} color={Colors.light.white} />
              </Pressable>
            </View>

            <View style={styles.header}>
              <Text style={styles.title}>{step === 'verify' ? 'Verify Your Email' : 'Become a Driver'}</Text>
              <Text style={styles.subtitle}>
                {step === 'verify' ? 'Enter the code we sent to finish signing up' : 'Start earning with us today'}
              </Text>
            </View>

            {step === 'verify' ? (
              <View style={styles.form}>
                <Text style={styles.verifyText}>
                  We sent a verification code to {formData.email}. Enter it below to finish creating your account.
                </Text>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Verification Code</Text>
                  <TextInput
                    style={styles.input}
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                    placeholder="Enter verification code"
                    keyboardType="number-pad"
                    maxLength={12}
                    testID="driver-verify-code-input"
                  />
                </View>

                <Button
                  title={isLoading ? '' : 'Verify & Continue'}
                  onPress={handleVerifyCode}
                  disabled={isLoading}
                  loading={isLoading}
                  style={styles.signupButton}
                  testID="driver-verify-code-button"
                />

                <Button
                  title={resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Code'}
                  onPress={handleResendCode}
                  disabled={resendCooldown > 0}
                  variant="secondary"
                  style={styles.resendButton}
                  testID="driver-resend-code-button"
                />
              </View>
            ) : (
            <View style={styles.form}>
              <Text style={styles.sectionTitle}>Personal Information</Text>
              
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={(value) => handleInputChange('name', value)}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  testID="driver-name-input"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={formData.email}
                  onChangeText={(value) => handleInputChange('email', value)}
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  testID="driver-email-input"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={formData.phone}
                  onChangeText={(value) => handleInputChange('phone', value)}
                  placeholder="Enter your phone number"
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  testID="driver-phone-input"
                />
              </View>

              <Text style={styles.sectionTitle}>Security</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    value={formData.password}
                    onChangeText={(value) => handleInputChange('password', value)}
                    placeholder="Enter your password"
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                    testID="driver-password-input"
                  />
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                  >
                    {showPassword ? (
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
                    value={formData.confirmPassword}
                    onChangeText={(value) => handleInputChange('confirmPassword', value)}
                    placeholder="Confirm your password"
                    secureTextEntry={!showConfirmPassword}
                    autoComplete="password"
                    testID="driver-confirm-password-input"
                  />
                  <Pressable
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeButton}
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={20} color={Colors.light.gray} />
                    ) : (
                      <Eye size={20} color={Colors.light.gray} />
                    )}
                  </Pressable>
                </View>
              </View>

              <Pressable
                style={styles.termsContainer}
                onPress={() => setAcceptedTerms(!acceptedTerms)}
              >
                {acceptedTerms ? (
                  <CheckSquare size={24} color={Colors.light.primary} />
                ) : (
                  <Square size={24} color="rgba(255, 255, 255, 0.8)" />
                )}
                <Text style={styles.termsText}>
                  I agree to the{' '}
                  <Text
                    style={styles.termsLink}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push('/terms-and-conditions');
                    }}
                  >
                    Terms and Conditions
                  </Text>
                  {' '}and{' '}
                  <Text
                    style={styles.termsLink}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push('/privacy-policy');
                    }}
                  >
                    Privacy Policy
                  </Text>
                </Text>
              </Pressable>

              <Button
                title={isLoading ? '' : 'Create Driver Account'}
                onPress={handleSignup}
                disabled={isLoading}
                loading={isLoading}
                style={styles.signupButton}
              />

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <Pressable
                style={styles.googleButton}
                onPress={handleGoogleSignup}
                disabled={isLoading}
              >
                <View style={styles.googleIcon}>
                  <Text style={styles.googleIconText}>G</Text>
                </View>
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </Pressable>

              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  Already have a driver account?{' '}
                  <Link href="/driver-login" style={styles.link}>
                    <Text style={styles.linkText}>Sign in</Text>
                  </Link>
                </Text>
              </View>
            </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  verifyText: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 20,
  },
  resendButton: {
    marginTop: 12,
  },
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
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 24,
    zIndex: 10,
  },
  backButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 80,
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
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  form: {
    width: '100%',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.white,
    marginBottom: 16,
    marginTop: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  inputContainer: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
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
  signupButton: {
    marginTop: 24,
    marginBottom: 24,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  dividerText: {
    color: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: '600',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.white,
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 24,
    gap: 12,
  },
  googleIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconText: {
    color: Colors.light.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  googleButtonText: {
    color: Colors.light.black,
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  link: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
  linkText: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    marginTop: 8,
    gap: 12,
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.8)',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  termsLink: {
    color: Colors.light.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});