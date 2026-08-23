import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Camera, CheckCircle2 } from 'lucide-react-native';
import Button from '@/components/Button';
import { useTheme } from '@/hooks/useThemeStore';
import { supabase } from '@/lib/supabase';
import {
  validatePlateNumber,
  validateVIN,
  validateEngineNumber,
  validateVehicleYear,
} from '@/lib/nigerian-format-validators';
import {
  resolveRequiredDocuments,
  type RequiredDocumentType,
  type VerificationRequirementRow,
} from '@/lib/driver-verification-config';
import { useDriverVerificationWizard } from './_wizard-context';

const VEHICLE_CATEGORIES: { id: 'standard' | 'comfort' | 'xl'; label: string }[] = [
  { id: 'standard', label: 'Standard' },
  { id: 'comfort', label: 'Comfort' },
  { id: 'xl', label: 'XL' },
];

const DOCUMENT_LABELS: Record<RequiredDocumentType, string> = {
  drivers_license_front: "License — Front",
  drivers_license_back: "License — Back",
  driver_selfie: 'Selfie',
  vehicle_registration: 'Vehicle Registration',
  proof_of_ownership: 'Proof of Ownership',
  insurance: 'Insurance',
  roadworthiness: 'Roadworthiness Certificate',
};

export default function VehicleInfoScreen() {
  const { colors } = useTheme();
  const { draft, updateDraft, setDocumentUri } = useDriverVerificationWizard();
  const [requiredDocs, setRequiredDocs] = useState<RequiredDocumentType[]>([]);

  useEffect(() => {
    let active = true;
    async function loadRequirements() {
      if (!draft.operatingState || !draft.vehicleCategory) {
        setRequiredDocs([]);
        return;
      }
      const { data } = await supabase
        .from('driver_verification_requirements')
        .select('state, vehicleCategory, documentType, isRequired, isActive')
        .eq('state', draft.operatingState)
        .eq('vehicleCategory', draft.vehicleCategory);
      if (!active) return;
      setRequiredDocs(
        resolveRequiredDocuments(draft.operatingState, draft.vehicleCategory, (data ?? []) as VerificationRequirementRow[])
      );
    }
    void loadRequirements();
    return () => {
      active = false;
    };
  }, [draft.operatingState, draft.vehicleCategory]);

  // Only vehicle-related required documents belong on this screen — license
  // front/back/selfie were already captured in license-info.tsx.
  const vehicleDocs = requiredDocs.filter(
    (type) => type !== 'drivers_license_front' && type !== 'drivers_license_back' && type !== 'driver_selfie'
  );

  const captureDocument = async (type: RequiredDocumentType) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Camera access is needed to capture this document.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setDocumentUri(type, result.assets[0].uri);
    }
  };

  const handleNext = () => {
    if (!draft.vehicleCategory) {
      Alert.alert('Vehicle category required', 'Select your vehicle category.');
      return;
    }
    const plateResult = validatePlateNumber(draft.vehiclePlateNumber);
    if (!plateResult.valid) {
      Alert.alert('Invalid plate number', plateResult.errors.join(' '));
      return;
    }
    if (!draft.vehicleMake.trim() || !draft.vehicleModel.trim() || !draft.vehicleColor.trim()) {
      Alert.alert('Missing vehicle details', 'Fill in make, model, and color.');
      return;
    }
    const yearResult = validateVehicleYear(parseInt(draft.vehicleYear, 10));
    if (!yearResult.valid) {
      Alert.alert('Invalid vehicle year', yearResult.errors.join(' '));
      return;
    }
    const vinResult = validateVIN(draft.vehicleVin);
    if (!vinResult.valid) {
      Alert.alert('Invalid VIN/chassis number', vinResult.errors.join(' '));
      return;
    }
    const engineResult = validateEngineNumber(draft.vehicleEngineNumber);
    if (!engineResult.valid) {
      Alert.alert('Invalid engine number', engineResult.errors.join(' '));
      return;
    }
    const missingDocs = vehicleDocs.filter((type) => !draft.documentUris[type]);
    if (missingDocs.length > 0) {
      Alert.alert('Missing documents', `Please capture: ${missingDocs.map((d) => DOCUMENT_LABELS[d]).join(', ')}`);
      return;
    }
    router.push('/driver-verification/review-submit' as any);
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

          <Text style={[styles.label, { color: colors.text }]}>VIN / Chassis Number</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            value={draft.vehicleVin}
            onChangeText={(value) => updateDraft({ vehicleVin: value })}
            placeholder="17-character VIN"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="characters"
          />

          <Text style={[styles.label, { color: colors.text }]}>Engine Number</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            value={draft.vehicleEngineNumber}
            onChangeText={(value) => updateDraft({ vehicleEngineNumber: value })}
            placeholder="Engine number"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="characters"
          />
        </View>

        {vehicleDocs.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Required Documents for {draft.operatingState || 'your state'}
            </Text>
            {vehicleDocs.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.captureRow, { borderColor: colors.border }]}
                onPress={() => captureDocument(type)}
              >
                {draft.documentUris[type] ? (
                  <Image source={{ uri: draft.documentUris[type] }} style={styles.thumbnail} />
                ) : (
                  <Camera size={22} color={colors.textSecondary} />
                )}
                <Text style={[styles.captureLabel, { color: colors.text }]}>{DOCUMENT_LABELS[type]}</Text>
                {draft.documentUris[type] && <CheckCircle2 size={18} color={colors.success} />}
              </TouchableOpacity>
            ))}
          </View>
        )}
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
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  row: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  captureLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
  thumbnail: { width: 40, height: 40, borderRadius: 6 },
  footer: { padding: 16, borderTopWidth: 1 },
});
