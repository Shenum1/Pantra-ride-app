import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import { CheckCircle2, ChevronDown, Search, X } from 'lucide-react-native';
import Button from '@/components/Button';
import DocumentCaptureCard from '@/components/DocumentCaptureCard';
import EmailVerificationCard from '@/components/EmailVerificationCard';
import { useTheme } from '@/hooks/useThemeStore';
import { useDriverVerification } from '@/hooks/useDriverVerification';
import { NIGERIAN_STATES, LAUNCHED_STATES } from '@/constants/nigerian-states';
import { CREDENTIAL_DOCUMENT_TYPES } from '@/lib/driver-verification-config';
import { useDriverVerificationWizard } from './_wizard-context';

const HINTS: Record<string, string> = {
  driver_selfie: 'A clear photo of your face. Riders will see this.',
  drivers_license_front: 'Front of your driver\'s license. All four corners visible, text readable.',
  national_id: 'Your NIN slip or National ID card. Text must be readable.',
};

export default function CredentialsScreen() {
  const { colors } = useTheme();
  const { status, syncAuthVerificationStatus, submitProfile } = useDriverVerification();
  const { draft, updateDraft } = useDriverVerificationWizard();

  const [isSaving, setIsSaving] = useState(false);
  const [isStatePickerOpen, setIsStatePickerOpen] = useState(false);
  const [stateSearchQuery, setStateSearchQuery] = useState('');

  // The server only learns an email is confirmed when asked to re-read it, and the
  // status fetched at load can arrive before that happens — so sync once on mount
  // (covers Google sign-ups and drivers who just entered their signup code), and only
  // show the email-code fallback after that has settled, otherwise an already-verified
  // email flashes as "unverified" for a moment.
  const [emailSyncSettled, setEmailSyncSettled] = useState(false);
  useEffect(() => {
    syncAuthVerificationStatus()
      .catch(() => {})
      .finally(() => setEmailSyncSettled(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredStates = useMemo(() => {
    const query = stateSearchQuery.trim().toLowerCase();
    if (!query) return NIGERIAN_STATES;
    return NIGERIAN_STATES.filter((state) => state.toLowerCase().includes(query));
  }, [stateSearchQuery]);

  const closeStatePicker = () => {
    setIsStatePickerOpen(false);
    setStateSearchQuery('');
  };

  const submittedTypes = new Set(
    (status?.submittedDocuments ?? []).filter((doc) => doc.status !== 'rejected').map((doc) => doc.type)
  );
  const missing = CREDENTIAL_DOCUMENT_TYPES.filter((type) => !submittedTypes.has(type));

  const handleNext = async () => {
    if (!status?.emailVerifiedAt) {
      Toast.show({ type: 'error', text1: 'Email not verified', text2: 'Verify your email before continuing.', position: 'top' });
      return;
    }
    if (!draft.operatingState) {
      Toast.show({ type: 'error', text1: 'Operating state required', text2: 'Select the state you will operate in.', position: 'top' });
      return;
    }
    if (missing.length > 0) {
      Toast.show({
        type: 'error',
        text1: 'Photos missing',
        text2: 'Add your profile photo, driver\'s license and NIN before continuing.',
        position: 'top',
      });
      return;
    }
    setIsSaving(true);
    try {
      await submitProfile({ operatingState: draft.operatingState });
      router.push('/driver-verification/vehicle' as any);
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Could not save', text2: error?.message ?? 'Please try again.', position: 'top', visibilityTime: 5000 });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {emailSyncSettled && <EmailVerificationCard />}

        <View style={[styles.card, { backgroundColor: colors.card }]}>
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
              style={[styles.stateSelectText, { color: draft.operatingState ? colors.text : colors.textSecondary }]}
            >
              {draft.operatingState || 'Select your state'}
            </Text>
            <ChevronDown size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {CREDENTIAL_DOCUMENT_TYPES.map((type) => (
          <DocumentCaptureCard key={type} type={type} hint={HINTS[type]} faceOnly={type === 'driver_selfie'} />
        ))}

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
                    {!isLaunched && <Text style={[styles.chipSubtext, { color: colors.textSecondary }]}>Coming soon</Text>}
                    {isSelected && <CheckCircle2 size={18} color={colors.primary} />}
                  </TouchableOpacity>
                );
              }}
            />
          </SafeAreaView>
        </Modal>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <Button title="Next: Vehicle" onPress={handleNext} loading={isSaving} disabled={isSaving} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  card: { borderRadius: 16, padding: 16, gap: 4 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  helperText: { fontSize: 12, marginBottom: 8 },
  chipSubtext: { fontSize: 10, marginTop: 2 },
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
