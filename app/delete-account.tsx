import { AlertTriangle, Download } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { useTheme } from '@/hooks/useThemeStore';
import { useAuth } from '@/hooks/useAuthStore';
import { useDriverAuth } from '@/hooks/useDriverAuthStore';
import { AccountService, blockersFromError, describeBlocker } from '@/lib/account-service';

const WHAT_HAPPENS = [
  'Your name, email, phone number, photo, saved places, family contacts and payment details are erased.',
  'Your messages and the written part of your reviews are erased.',
  'If you drive for Pantra, your licence, vehicle, documents and bank details are erased and you can no longer take trips.',
  'Your trip and payment records are kept for accounting, but they no longer show who you are.',
  'Any reward points you still have are lost.',
  'This cannot be undone. You can sign up again later with the same email, as a new account.',
];

export default function DeleteAccountScreen() {
  const { colors } = useTheme();
  const { logout } = useAuth();
  const { logout: logoutDriver } = useDriverAuth();

  const [blockers, setBlockers] = useState<string[] | null>(null);
  const [checkFailed, setCheckFailed] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const loadBlockers = useCallback(async () => {
    setCheckFailed(false);
    setBlockers(null);
    try {
      setBlockers(await AccountService.getDeletionBlockers());
    } catch (error) {
      console.error('Could not check what blocks account deletion:', error);
      setCheckFailed(true);
    }
  }, []);

  useEffect(() => {
    loadBlockers();
  }, [loadBlockers]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await AccountService.downloadMyData();
    } catch (error) {
      console.error('Could not download account data:', error);
      Alert.alert('Could not download your data', 'Please check your connection and try again in a moment.');
    } finally {
      setDownloading(false);
    }
  };

  const performDelete = async () => {
    setDeleting(true);
    try {
      await AccountService.deleteAccount();
    } catch (error) {
      setDeleting(false);
      const codes = blockersFromError(error);
      if (codes) {
        setBlockers(codes);
        return;
      }
      console.error('Account deletion failed:', error);
      Alert.alert('Could not delete your account', 'Nothing was deleted. Please try again in a moment, or contact support.');
      return;
    }

    // The account is gone on the server; clear this phone too.
    try {
      await logoutDriver();
      await logout();
    } catch (error) {
      console.warn('Signing out after account deletion failed (the account is already deleted):', error);
    }
    Alert.alert('Account deleted', 'Your account and personal details have been deleted.');
    router.replace('/role-selection');
  };

  const handleDelete = () => {
    Alert.alert('Delete your account?', 'This is permanent and cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete my account', style: 'destructive', onPress: performDelete },
    ]);
  };

  const hasBlockers = (blockers?.length ?? 0) > 0;
  const canDelete = blockers !== null && !hasBlockers && typed.trim() === 'DELETE' && !deleting;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Delete Account',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
        }}
      />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.headerRow}>
            <AlertTriangle size={28} color={colors.danger} />
            <Text style={[styles.title, { color: colors.text }]}>Delete your account</Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>What happens</Text>
            {WHAT_HAPPENS.map((line) => (
              <Text key={line} style={[styles.bullet, { color: colors.gray }]}>
                {'•  '}
                {line}
              </Text>
            ))}
          </View>

          <Pressable
            testID="delete-account-download"
            style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={handleDownload}
            disabled={downloading}
          >
            {downloading ? <ActivityIndicator color={colors.primary} /> : <Download size={20} color={colors.primary} />}
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
              {downloading ? 'Preparing your data…' : 'Download a copy of my data first'}
            </Text>
          </Pressable>

          {blockers === null && !checkFailed && (
            <View style={styles.statusRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.statusText, { color: colors.gray }]}>Checking your account…</Text>
            </View>
          )}

          {checkFailed && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.danger }]}>
              <Text style={[styles.statusText, { color: colors.text }]}>
                We could not check your account just now. Check your connection and try again.
              </Text>
              <Pressable onPress={loadBlockers} style={styles.retry} testID="delete-account-retry">
                <Text style={{ color: colors.primary, fontWeight: '600' }}>Try again</Text>
              </Pressable>
            </View>
          )}

          {hasBlockers && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.danger }]} testID="delete-account-blockers">
              <Text style={[styles.cardTitle, { color: colors.text }]}>Before you can delete your account</Text>
              {blockers!.map((code) => (
                <Text key={code} style={[styles.bullet, { color: colors.text }]}>
                  {'•  '}
                  {describeBlocker(code)}
                </Text>
              ))}
              <Pressable onPress={loadBlockers} style={styles.retry}>
                <Text style={{ color: colors.primary, fontWeight: '600' }}>Check again</Text>
              </Pressable>
            </View>
          )}

          {blockers !== null && !hasBlockers && (
            <View style={styles.confirmBlock}>
              <Text style={[styles.label, { color: colors.text }]}>Type DELETE to confirm</Text>
              <TextInput
                testID="delete-account-confirm-input"
                value={typed}
                onChangeText={setTyped}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="DELETE"
                placeholderTextColor={colors.gray}
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
              />
              <Pressable
                testID="delete-account-button"
                accessibilityState={{ disabled: !canDelete }}
                style={[styles.deleteButton, { backgroundColor: colors.danger, opacity: canDelete ? 1 : 0.4 }]}
                onPress={handleDelete}
                disabled={!canDelete}
              >
                {deleting ? <ActivityIndicator color="#fff" /> : <Text style={styles.deleteButtonText}>Delete my account</Text>}
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', flex: 1 },
  card: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  bullet: { fontSize: 14, lineHeight: 21, marginBottom: 6 },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  secondaryButtonText: { fontSize: 16, fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  statusText: { fontSize: 14, lineHeight: 20 },
  retry: { marginTop: 8, paddingVertical: 4 },
  confirmBlock: { marginBottom: 32 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 16 },
  deleteButton: { alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12 },
  deleteButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
