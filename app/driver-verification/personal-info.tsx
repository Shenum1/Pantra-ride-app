import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CheckCircle2, ChevronDown, Search, X } from 'lucide-react-native';
import Button from '@/components/Button';
import DatePickerField from '@/components/DatePickerField';
import Colors from '@/constants/colors';
import { useTheme } from '@/hooks/useThemeStore';
import { useDriverAuth } from '@/hooks/useDriverAuthStore';
import { useDriverVerification } from '@/hooks/useDriverVerification';
import { supabase } from '@/lib/supabase';
import { NIGERIAN_STATES, LAUNCHED_STATES } from '@/constants/nigerian-states';
import { validateFullLegalName, validateDateOfBirth } from '@/lib/nigerian-format-validators';
import { useDriverVerificationWizard } from './_wizard-context';

function formatE164(rawPhone: string): string {
  return rawPhone.startsWith('+') ? rawPhone : `+234${rawPhone.replace(/^0+/, '')}`;
}

export default function PersonalInfoScreen() {
  const { colors } = useTheme();
  const { driver } = useDriverAuth();
  const { status, syncAuthVerificationStatus } = useDriverVerification();
  const { draft, updateDraft } = useDriverVerificationWizard();

  const [phone, setPhone] = useState(driver?.phone ?? '');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isStatePickerOpen, setIsStatePickerOpen] = useState(false);
  const [stateSearchQuery, setStateSearchQuery] = useState('');

  // A Google-signup driver's email is already verified by Supabase at sign-in
  // time (Google proved it) — sync once on mount so that's reflected immediately
  // instead of requiring a pointless manual "I've Verified" tap.
  useEffect(() => {
    void syncAuthVerificationStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const phoneVerified = !!status?.phoneVerifiedAt;
  const emailVerified = !!status?.emailVerifiedAt;

  const filteredStates = useMemo(() => {
    const query = stateSearchQuery.trim().toLowerCase();
    if (!query) return NIGERIAN_STATES;
    return NIGERIAN_STATES.filter((state) => state.toLowerCase().includes(query));
  }, [stateSearchQuery]);

  const closeStatePicker = () => {
    setIsStatePickerOpen(false);
    setStateSearchQuery('');
  };

  const handleSendOtp = async () => {
    if (!phone.trim()) {
      Alert.alert('Phone required', 'Enter your phone number first.');
      return;
    }
    setIsSendingOtp(true);
    try {
      const { error } = await supabase.auth.updateUser({ phone: formatE164(phone) });
      if (error) throw new Error(error.message);
      setOtpSent(true);
      Alert.alert('Code sent', 'Enter the verification code sent to your phone.');
    } catch (error: any) {
      Alert.alert('Could not send code', error?.message ?? 'Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) return;
    setIsVerifyingOtp(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: formatE164(phone),
        token: otpCode.trim(),
        type: 'phone_change',
      });
      if (error) throw new Error(error.message);
      await syncAuthVerificationStatus();
      Alert.alert('Phone verified', 'Your phone number has been verified.');
    } catch (error: any) {
      Alert.alert('Verification failed', error?.message ?? 'Please try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleResendEmail = async () => {
    if (!driver?.email) return;
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: driver.email });
      if (error) throw new Error(error.message);
      Alert.alert('Email sent', 'Check your inbox for the verification link.');
    } catch (error: any) {
      Alert.alert('Could not send email', error?.message ?? 'Please try again.');
    }
  };

  const handleRefreshEmailStatus = async () => {
    setIsCheckingEmail(true);
    try {
      await syncAuthVerificationStatus();
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const handleNext = () => {
    const nameResult = validateFullLegalName(draft.fullLegalName);
    if (!nameResult.valid) {
      Alert.alert('Invalid name', nameResult.errors.join(' '));
      return;
    }
    if (!draft.dateOfBirth) {
      Alert.alert('Date of birth required', 'Select your date of birth.');
      return;
    }
    const dobResult = validateDateOfBirth(new Date(draft.dateOfBirth));
    if (!dobResult.valid) {
      Alert.alert('Invalid date of birth', dobResult.errors.join(' '));
      return;
    }
    if (!draft.operatingState) {
      Alert.alert('Operating state required', 'Select the state you will operate in.');
      return;
    }
    if (!phoneVerified) {
      Alert.alert('Phone not verified', 'Verify your phone number before continuing.');
      return;
    }
    if (!emailVerified) {
      Alert.alert('Email not verified', 'Verify your email before continuing.');
      return;
    }
    router.push('/driver-verification/license-info' as any);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.label, { color: colors.text }]}>Full Legal Name</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            value={draft.fullLegalName}
            onChangeText={(value) => updateDraft({ fullLegalName: value })}
            placeholder="As it appears on your ID"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="words"
          />

          <Text style={[styles.label, { color: colors.text }]}>Date of Birth</Text>
          <DatePickerField
            value={draft.dateOfBirth}
            onChange={(isoDate) => updateDraft({ dateOfBirth: isoDate })}
            placeholder="Select date of birth"
            maximumDate={new Date()}
            borderColor={colors.border}
            textColor={colors.text}
            placeholderColor={colors.textSecondary}
            testID="driver-dob-input"
          />

          <Text style={[styles.label, { color: colors.text }]}>Operating State</Text>
          <Text style={[styles.helperText, { color: colors.textSecondary }]}>
            Driver registration is currently open in {LAUNCHED_STATES.join(', ')} only. Other states are shown for
            visibility and will open for registration soon.
          </Text>
          <TouchableOpacity
            style={[styles.stateSelectField, { borderColor: colors.border }]}
            onPress={() => setIsStatePickerOpen(true)}
            testID="operating-state-select"
          >
            <Text
              style={[
                styles.stateSelectText,
                { color: draft.operatingState ? colors.text : colors.textSecondary },
              ]}
            >
              {draft.operatingState || 'Select your state'}
            </Text>
            <ChevronDown size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <Modal visible={isStatePickerOpen} animationType="slide" onRequestClose={closeStatePicker}>
          <SafeAreaView style={[styles.pickerContainer, { backgroundColor: colors.background }]}>
            <View style={styles.pickerHeader}>
              <Text style={[styles.pickerTitle, { color: colors.text }]}>Select your state</Text>
              <TouchableOpacity onPress={closeStatePicker} testID="state-picker-close">
                <X size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={[styles.searchRow, { borderColor: colors.border }]}>
              <Search size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                value={stateSearchQuery}
                onChangeText={setStateSearchQuery}
                placeholder="Search states"
                placeholderTextColor={colors.textSecondary}
                autoFocus
                testID="state-search-input"
              />
            </View>
            <FlatList
              data={filteredStates}
              keyExtractor={(state) => state}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={[styles.noResultsText, { color: colors.textSecondary }]}>No states match your search.</Text>
              }
              renderItem={({ item: state }) => {
                const isLaunched = (LAUNCHED_STATES as readonly string[]).includes(state);
                const isSelected = draft.operatingState === state;
                return (
                  <TouchableOpacity
                    disabled={!isLaunched}
                    style={[styles.stateRow, { borderBottomColor: colors.border }, !isLaunched && styles.stateRowDisabled]}
                    onPress={() => {
                      updateDraft({ operatingState: state });
                      closeStatePicker();
                    }}
                    testID={`state-option-${state}`}
                  >
                    <Text
                      style={[
                        styles.stateRowText,
                        { color: isLaunched ? colors.text : colors.textSecondary },
                        isSelected && { color: colors.primary, fontWeight: '700' },
                      ]}
                    >
                      {state}
                    </Text>
                    {!isLaunched && (
                      <Text style={[styles.chipSubtext, { color: colors.textSecondary }]}>Coming soon</Text>
                    )}
                    {isSelected && <CheckCircle2 size={18} color={colors.primary} />}
                  </TouchableOpacity>
                );
              }}
            />
          </SafeAreaView>
        </Modal>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.verificationHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Phone Verification</Text>
            {phoneVerified && <CheckCircle2 size={18} color={colors.success} />}
          </View>
          {phoneVerified ? (
            <Text style={{ color: colors.success }}>Phone number verified.</Text>
          ) : (
            <>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={phone}
                onChangeText={setPhone}
                placeholder="e.g. 08012345678"
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
              />
              <Button
                title={otpSent ? 'Resend Code' : 'Send Verification Code'}
                onPress={handleSendOtp}
                variant="outline"
                loading={isSendingOtp}
                disabled={isSendingOtp}
                style={styles.smallButton}
              />
              {otpSent && (
                <>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, marginTop: 12 }]}
                    value={otpCode}
                    onChangeText={setOtpCode}
                    placeholder="Enter 6-digit code"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="number-pad"
                  />
                  <Button
                    title="Verify Phone"
                    onPress={handleVerifyOtp}
                    loading={isVerifyingOtp}
                    disabled={isVerifyingOtp}
                    style={styles.smallButton}
                  />
                </>
              )}
            </>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.verificationHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Email Verification</Text>
            {emailVerified && <CheckCircle2 size={18} color={colors.success} />}
          </View>
          {emailVerified ? (
            <Text style={{ color: colors.success }}>Email verified.</Text>
          ) : (
            <>
              <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>
                Check your inbox ({driver?.email}) for a verification link, then refresh below.
              </Text>
              <View style={styles.row}>
                <Button title="Resend Email" onPress={handleResendEmail} variant="outline" style={styles.halfButton} />
                <Button
                  title="I've Verified"
                  onPress={handleRefreshEmailStatus}
                  loading={isCheckingEmail}
                  disabled={isCheckingEmail}
                  style={styles.halfButton}
                />
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <Button title="Next" onPress={handleNext} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  card: { borderRadius: 16, padding: 16, gap: 4 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  verificationHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  helperText: { fontSize: 12, marginTop: -2, marginBottom: 6 },
  chipSubtext: { fontSize: 10, marginTop: 2 },
  smallButton: { marginTop: 4 },
  row: { flexDirection: 'row', gap: 12 },
  halfButton: { flex: 1 },
  footer: { padding: 16, borderTopWidth: 1 },
  stateSelectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  stateSelectText: { fontSize: 15 },
  pickerContainer: { flex: 1 },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pickerTitle: { fontSize: 17, fontWeight: '700' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15 },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  stateRowDisabled: { opacity: 0.5 },
  stateRowText: { fontSize: 15 },
  noResultsText: { textAlign: 'center', marginTop: 40, fontSize: 14 },
});
