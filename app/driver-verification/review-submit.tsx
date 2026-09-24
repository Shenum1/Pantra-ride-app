import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react-native';
import Button from '@/components/Button';
import { useTheme } from '@/hooks/useThemeStore';
import { useDriverVerification } from '@/hooks/useDriverVerification';
import {
  CREDENTIAL_DOCUMENT_TYPES,
  VEHICLE_DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
} from '@/lib/driver-verification-config';
import { useDriverVerificationWizard } from './_wizard-context';

function SummaryRow({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: colors.text }]}>{value || '—'}</Text>
    </View>
  );
}

// Nothing uploads here any more — every photo was sent and recorded the moment it was
// taken, and the server moves the driver into review on its own once everything is in.
// This screen is the last check that nothing is missing or was rejected.
export default function ReviewScreen() {
  const { colors } = useTheme();
  const { status, verificationStatus } = useDriverVerification();
  const { draft } = useDriverVerificationWizard();

  const submitted = new Map((status?.submittedDocuments ?? []).map((doc) => [doc.type, doc]));
  const allTypes = [...CREDENTIAL_DOCUMENT_TYPES, ...VEHICLE_DOCUMENT_TYPES];
  const problems = allTypes.filter((type) => {
    const doc = submitted.get(type);
    return !doc || doc.status === 'rejected';
  });
  const emailVerified = !!status?.emailVerifiedAt;
  const ready = problems.length === 0 && emailVerified;

  const handleFinish = () => {
    if (!ready) {
      Toast.show({
        type: 'error',
        text1: 'Not finished yet',
        text2: !emailVerified ? 'Verify your email first.' : 'Some photos are missing or need to be retaken.',
        position: 'top',
      });
      return;
    }
    Toast.show({
      type: 'success',
      text1: 'Submitted for review',
      text2: 'We will notify you once a decision is made.',
      position: 'top',
      visibilityTime: 5000,
    });
    router.replace('/(driver-tabs)/dashboard');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Vehicle</Text>
          <SummaryRow label="Operating State" value={draft.operatingState} colors={colors} />
          <SummaryRow label="Category" value={draft.vehicleCategory} colors={colors} />
          <SummaryRow label="Plate Number" value={draft.vehiclePlateNumber} colors={colors} />
          <SummaryRow label="Make / Model" value={`${draft.vehicleMake} ${draft.vehicleModel}`.trim()} colors={colors} />
          <SummaryRow label="Year / Color" value={[draft.vehicleYear, draft.vehicleColor].filter(Boolean).join(' / ')} colors={colors} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Photos and documents</Text>
          {allTypes.map((type) => {
            const doc = submitted.get(type);
            const rejected = doc?.status === 'rejected';
            return (
              <View key={type} style={styles.checkRow}>
                {rejected ? (
                  <AlertCircle size={18} color={colors.error} />
                ) : doc ? (
                  <CheckCircle2 size={18} color={colors.success} />
                ) : (
                  <Circle size={18} color={colors.textSecondary} />
                )}
                <View style={styles.checkText}>
                  <Text style={{ color: colors.text, fontSize: 14 }}>{DOCUMENT_TYPE_LABELS[type]}</Text>
                  {rejected && (
                    <Text style={{ color: colors.error, fontSize: 12 }}>
                      Rejected{doc?.rejectionReason ? `: ${doc.rejectionReason}` : ''}. Go back and retake it.
                    </Text>
                  )}
                  {!doc && <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Not added yet</Text>}
                </View>
              </View>
            );
          })}
        </View>

        <View style={[styles.notice, { backgroundColor: colors.lightGray }]}>
          <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
            {verificationStatus === 'VERIFIED'
              ? 'Your account is verified.'
              : 'Your details go to our team for review. You cannot go online or accept rides until your account is verified.'}
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <Button title="Finish" onPress={handleFinish} />
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
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  checkText: { flex: 1 },
  notice: { borderRadius: 12, padding: 14 },
  noticeText: { fontSize: 13, lineHeight: 19 },
  footer: { padding: 16, borderTopWidth: 1 },
});
