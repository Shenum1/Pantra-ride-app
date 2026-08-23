import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Button from '@/components/Button';
import { useTheme } from '@/hooks/useThemeStore';
import { useDriverAuth } from '@/hooks/useDriverAuthStore';
import { useDriverVerification } from '@/hooks/useDriverVerification';
import { StorageService } from '@/lib/storage-service';
import type { RequiredDocumentType } from '@/lib/driver-verification-config';
import { useDriverVerificationWizard } from './_wizard-context';

function SummaryRow({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: colors.text }]}>{value || '—'}</Text>
    </View>
  );
}

export default function ReviewSubmitScreen() {
  const { colors } = useTheme();
  const { driver } = useDriverAuth();
  const { draft } = useDriverVerificationWizard();
  const { submitProfile, submitDocument } = useDriverVerification();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressLabel, setProgressLabel] = useState('');

  const handleSubmit = async () => {
    if (!driver?.id) return;
    setIsSubmitting(true);
    try {
      setProgressLabel('Submitting profile...');
      await submitProfile({
        fullLegalName: draft.fullLegalName,
        dateOfBirth: draft.dateOfBirth,
        operatingState: draft.operatingState,
        vehicleCategory: draft.vehicleCategory as 'standard' | 'comfort' | 'xl',
        licenseNumber: draft.licenseNumber,
        licenseCategory: draft.licenseCategory,
        licenseIssueDate: draft.licenseIssueDate,
        licenseExpiryDate: draft.licenseExpiryDate,
        vehiclePlateNumber: draft.vehiclePlateNumber,
        vehicleMake: draft.vehicleMake,
        vehicleModel: draft.vehicleModel,
        vehicleYear: parseInt(draft.vehicleYear, 10),
        vehicleColor: draft.vehicleColor,
        vehicleVin: draft.vehicleVin,
        vehicleEngineNumber: draft.vehicleEngineNumber,
      });

      const entries = Object.entries(draft.documentUris) as [RequiredDocumentType, string][];
      for (const [type, uri] of entries) {
        setProgressLabel(`Uploading ${type.replace(/_/g, ' ')}...`);
        const storagePath = await StorageService.uploadPrivateFile(uri, `drivers/${driver.id}/${type}_${Date.now()}`);
        await submitDocument({
          type,
          storagePath,
          expiryDate: draft.documentExpiryDates[type],
        });
      }

      Alert.alert(
        'Submitted',
        'Your verification submission is being reviewed. We will notify you once a decision is made.',
        [{ text: 'OK', onPress: () => router.replace('/(driver-tabs)/dashboard') }]
      );
    } catch (error: any) {
      Alert.alert('Submission Failed', error?.message ?? 'Please try again.');
    } finally {
      setIsSubmitting(false);
      setProgressLabel('');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Personal</Text>
          <SummaryRow label="Full Name" value={draft.fullLegalName} colors={colors} />
          <SummaryRow label="Date of Birth" value={draft.dateOfBirth} colors={colors} />
          <SummaryRow label="Operating State" value={draft.operatingState} colors={colors} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>License</Text>
          <SummaryRow label="Number" value={draft.licenseNumber} colors={colors} />
          <SummaryRow label="Category" value={draft.licenseCategory} colors={colors} />
          <SummaryRow label="Issue Date" value={draft.licenseIssueDate} colors={colors} />
          <SummaryRow label="Expiry Date" value={draft.licenseExpiryDate} colors={colors} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Vehicle</Text>
          <SummaryRow label="Category" value={draft.vehicleCategory} colors={colors} />
          <SummaryRow label="Plate Number" value={draft.vehiclePlateNumber} colors={colors} />
          <SummaryRow label="Make / Model" value={`${draft.vehicleMake} ${draft.vehicleModel}`} colors={colors} />
          <SummaryRow label="Year / Color" value={`${draft.vehicleYear} / ${draft.vehicleColor}`} colors={colors} />
          <SummaryRow label="VIN" value={draft.vehicleVin} colors={colors} />
          <SummaryRow label="Engine Number" value={draft.vehicleEngineNumber} colors={colors} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Documents</Text>
          <Text style={{ color: colors.textSecondary }}>
            {Object.keys(draft.documentUris).length} document(s) ready to submit.
          </Text>
        </View>

        <View style={[styles.notice, { backgroundColor: colors.lightGray }]}>
          <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
            Submitting sends your information for automated format checks and human review. You cannot go online or
            accept rides until your account is fully verified.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        {isSubmitting && progressLabel ? (
          <View style={styles.progressRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ color: colors.textSecondary }}>{progressLabel}</Text>
          </View>
        ) : null}
        <Button title="Submit for Verification" onPress={handleSubmit} loading={isSubmitting} disabled={isSubmitting} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  card: { borderRadius: 16, padding: 16, gap: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { fontSize: 13 },
  summaryValue: { fontSize: 13, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  notice: { borderRadius: 12, padding: 14 },
  noticeText: { fontSize: 13, lineHeight: 19 },
  footer: { padding: 16, borderTopWidth: 1, gap: 10 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
});
