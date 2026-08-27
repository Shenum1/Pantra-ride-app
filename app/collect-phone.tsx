import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuthStore';
import Button from '@/components/Button';
import Colors from '@/constants/colors';

// Shown once, right after a Google sign-in/sign-up that has no phone number on
// file yet — email/password signup already collects phone inline, but a Google
// sign-in is a single tap with no form. Reuses the exact OTP pattern already
// proven in app/driver-verification/personal-info.tsx (updateUser + verifyOtp
// type:'phone_change') rather than the old rider phone-*login* flow, since this
// attaches/verifies a phone number on the already-authenticated Google identity
// instead of creating a separate one.
function formatE164(rawPhone: string): string {
  return rawPhone.startsWith('+') ? rawPhone : `+234${rawPhone.replace(/^0+/, '')}`;
}

export default function CollectPhoneScreen() {
  const { updateProfile } = useAuth();
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSendCode = async () => {
    if (!phone.trim()) {
      Alert.alert('Phone required', 'Enter your phone number first.');
      return;
    }
    setIsSending(true);
    try {
      const { error } = await supabase.auth.updateUser({ phone: formatE164(phone) });
      if (error) throw new Error(error.message);
      setOtpSent(true);
    } catch (error: any) {
      Alert.alert('Could not send code', error?.message ?? 'Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!otpCode.trim()) return;
    setIsVerifying(true);
    try {
      const formatted = formatE164(phone);
      const { error } = await supabase.auth.verifyOtp({
        phone: formatted,
        token: otpCode.trim(),
        type: 'phone_change',
      });
      if (error) throw new Error(error.message);
      await updateProfile({ phone: formatted });
      router.replace('/(tabs)/home');
    } catch (error: any) {
      Alert.alert('Verification failed', error?.message ?? 'Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSkip = () => {
    router.replace('/(tabs)/home');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <View style={styles.content}>
          <Text style={styles.title}>Add your phone number</Text>
          <Text style={styles.subtitle}>
            Drivers and support use this to reach you about your rides. You can add it later from your profile.
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. 08012345678"
              keyboardType="phone-pad"
              editable={!otpSent}
              testID="collect-phone-input"
            />
          </View>

          {!otpSent ? (
            <Button title="Send Verification Code" onPress={handleSendCode} loading={isSending} disabled={isSending} />
          ) : (
            <>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Verification Code</Text>
                <TextInput
                  style={styles.input}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  placeholder="Enter 6-digit code"
                  keyboardType="number-pad"
                  testID="collect-phone-otp-input"
                />
              </View>
              <Button title="Verify" onPress={handleVerifyCode} loading={isVerifying} disabled={isVerifying} />
            </>
          )}

          <Pressable style={styles.skipButton} onPress={handleSkip} testID="collect-phone-skip">
            <Text style={styles.skipText}>Skip for now</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  keyboardView: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.light.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: Colors.light.textSecondary, marginBottom: 24, lineHeight: 20 },
  inputContainer: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.light.text, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.light.text,
  },
  skipButton: { alignItems: 'center', marginTop: 20, paddingVertical: 8 },
  skipText: { fontSize: 14, fontWeight: '600', color: Colors.light.textSecondary },
});
