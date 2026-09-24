import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import Button from '@/components/Button';
import DocumentCaptureCard from '@/components/DocumentCaptureCard';
import { useTheme } from '@/hooks/useThemeStore';
import { useDriverVerification } from '@/hooks/useDriverVerification';
import { validatePlateNumber, validateVehicleYear } from '@/lib/nigerian-format-validators';
import { VEHICLE_DOCUMENT_TYPES } from '@/lib/driver-verification-config';
import { useDriverVerificationWizard } from './_wizard-context';

const VEHICLE_CATEGORIES: { id: 'standard' | 'comfort' | 'xl'; label: string }[] = [
  { id: 'standard', label: 'Standard' },
  { id: 'comfort', label: 'Comfort' },
  { id: 'xl', label: 'XL' },
];

const HINTS: Record<string, string> = {
  vehicle_exterior: 'Photo of the whole vehicle from the back or front, with the plate number clearly visible.',
  vehicle_registration: 'Your current vehicle license certificate. Text must be readable.',
  roadworthiness: 'A valid roadworthiness certificate. Text must be readable.',
  vehicle_interior_front: 'Front seats and dashboard.',
  vehicle_interior_rear: 'Back seats.',
};

export default function VehicleScreen() {
  const { colors } = useTheme();
  const { status, submitProfile } = useDriverVerification();
  const { draft, updateDraft } = useDriverVerificationWizard();
  const [isSaving, setIsSaving] = useState(false);

  const submittedTypes = new Set(
    (status?.submittedDocuments ?? []).filter((doc) => doc.status !== 'rejected').map((doc) => doc.type)
  );
  const missing = VEHICLE_DOCUMENT_TYPES.filter((type) => !submittedTypes.has(type));

  const fail = (text1: string, text2: string) =>
    Toast.show({ type: 'error', text1, text2, position: 'top', visibilityTime: 5000 });

  const handleNext = async () => {
    if (!draft.vehicleCategory) return fail('Vehicle category required', 'Select your vehicle category.');

    const plateResult = validatePlateNumber(draft.vehiclePlateNumber);
    if (!plateResult.valid) return fail('Invalid plate number', plateResult.errors.join(' '));

    if (!draft.vehicleMake.trim() || !draft.vehicleModel.trim() || !draft.vehicleColor.trim()) {
      return fail('Missing vehicle details', 'Fill in make, model, and color.');
    }
    const year = parseInt(draft.vehicleYear, 10);
    const yearResult = validateVehicleYear(year);
    if (!yearResult.valid) return fail('Invalid vehicle year', yearResult.errors.join(' '));

    if (missing.length > 0) return fail('Photos missing', 'Add all vehicle photos and certificates before continuing.');

    setIsSaving(true);
    try {
      await submitProfile({
        operatingState: draft.operatingState || undefined,
        vehicleCategory: draft.vehicleCategory,
        vehiclePlateNumber: draft.vehiclePlateNumber.trim(),
        vehicleMake: draft.vehicleMake.trim(),
        vehicleModel: draft.vehicleModel.trim(),
        vehicleYear: year,
        vehicleColor: draft.vehicleColor.trim(),
      });
      router.push('/driver-verification/review-submit' as any);
    } catch (error: any) {
      fail('Could not save', error?.message ?? 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.label, { color: colors.text }]}>Vehicle Category</Text>
          <View style={styles.chipRow}>
            {VEHICLE_CATEGORIES.map(({ id, label }) => (
              <TouchableOpacity
                key={id}
                style={[
                  styles.chip,
                  { borderColor: colors.border },
                  draft.vehicleCategory === id && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => updateDraft({ vehicleCategory: id })}
              >
                <Text style={{ color: draft.vehicleCategory === id ? colors.white : colors.text, fontWeight: '600' }}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.text }]}>Plate Number</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            value={draft.vehiclePlateNumber}
            onChangeText={(value) => updateDraft({ vehiclePlateNumber: value })}
            placeholder="ABC-123-DE"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="characters"
            testID="vehicle-plate-input"
          />

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={[styles.label, { color: colors.text }]}>Make</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={draft.vehicleMake}
                onChangeText={(value) => updateDraft({ vehicleMake: value })}
                placeholder="Toyota"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={[styles.label, { color: colors.text }]}>Model</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={draft.vehicleModel}
                onChangeText={(value) => updateDraft({ vehicleModel: value })}
                placeholder="Camry"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={[styles.label, { color: colors.text }]}>Year</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={draft.vehicleYear}
                onChangeText={(value) => updateDraft({ vehicleYear: value })}
                placeholder="2020"
                keyboardType="numeric"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={[styles.label, { color: colors.text }]}>Color</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={draft.vehicleColor}
                onChangeText={(value) => updateDraft({ vehicleColor: value })}
                placeholder="Silver"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>
        </View>

        {VEHICLE_DOCUMENT_TYPES.map((type) => (
          <DocumentCaptureCard key={type} type={type} hint={HINTS[type]} />
        ))}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <Button title="Next: Review" onPress={handleNext} loading={isSaving} disabled={isSaving} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  card: { borderRadius: 16, padding: 16, gap: 4 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  row: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  footer: { padding: 16, borderTopWidth: 1 },
});
