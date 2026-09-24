import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import Toast from 'react-native-toast-message';
import Button from '@/components/Button';
import { useTheme } from '@/hooks/useThemeStore';
import { useDriverAuth } from '@/hooks/useDriverAuthStore';
import { useDriverVerification } from '@/hooks/useDriverVerification';
import { supabase } from '@/lib/supabase';

// Fallback for a driver whose email is somehow still unconfirmed when they reach the
// registration wizard (signup already collects the code, and Google accounts arrive
// verified). Renders nothing once the server reports the email as verified.
export default function EmailVerificationCard() {
  const { colors } = useTheme();
  const { driver } = useDriverAuth();
  const { status, syncAuthVerificationStatus } = useDriverVerification();

  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Nothing to show until the server's answer is in: while status is still loading the
  // email would look unverified even when it isn't.
  if (!status || status.emailVerifiedAt || !driver?.email) return null;
  const email = driver.email;

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) throw new Error(error.message);
      setResendCooldown(60);
      Toast.show({ type: 'success', text1: 'Code sent', text2: 'Check your inbox for the verification code.', position: 'top' });
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Could not send code', text2: error?.message ?? 'Please try again.', position: 'top' });
    }
  };

  const handleVerify = async () => {
    if (!code.trim()) {
      Toast.show({ type: 'error', text1: 'Enter code', text2: 'Enter the verification code from your email.', position: 'top' });
      return;
    }
    setIsVerifying(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code.trim(),
        type: 'signup',
      });
      if (error) throw new Error(error.message);
      // The server re-reads email_confirmed_at itself; this call only triggers that re-check.
      await syncAuthVerificationStatus();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Verification failed', text2: error?.message ?? 'Invalid or expired code.', position: 'top' });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.title, { color: colors.text }]}>Verify your email</Text>
      <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>
        Enter the verification code sent to {email}.
      </Text>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        value={code}
        onChangeText={setCode}
        placeholder="Enter verification code"
        placeholderTextColor={colors.textSecondary}
        keyboardType="number-pad"
        maxLength={12}
        testID="driver-email-verify-code-input"
      />
      <View style={styles.row}>
        <Button
          title={resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend Code'}
          onPress={handleResend}
          variant="outline"
          disabled={resendCooldown > 0}
          style={styles.half}
        />
        <Button title="Verify Code" onPress={handleVerify} loading={isVerifying} disabled={isVerifying} style={styles.half} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 16 },
  title: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
});
