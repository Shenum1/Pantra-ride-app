import React from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Camera, CheckCircle2 } from 'lucide-react-native';
import Button from '@/components/Button';
import DatePickerField from '@/components/DatePickerField';
import { useTheme } from '@/hooks/useThemeStore';
import {
  validateDriverLicenseNumber,
  validateLicenseDates,
} from '@/lib/nigerian-format-validators';
import { useDriverVerificationWizard } from './_wizard-context';

const LICENSE_CATEGORIES = ['A', 'B', 'C', 'D', 'E', 'F'];

function DocumentCaptureRow({
  label,
  uri,
  onCapture,
  colors,
}: {
  label: string;
  uri?: string;
  onCapture: () => void;
  colors: any;
}) {
  return (
    <TouchableOpacity
      style={[styles.captureRow, { borderColor: colors.border }]}
      onPress={onCapture}
    >
      {uri ? <Image source={{ uri }} style={styles.thumbnail} /> : <Camera size={24} color={colors.textSecondary} />}
      <Text style={[styles.captureLabel, { color: colors.text }]}>{label}</Text>
      {uri && <CheckCircle2 size={18} color={colors.success} />}
    </TouchableOpacity>
  );
}

export default function LicenseInfoScreen() {
  const { colors } = useTheme();
  const { draft, updateDraft, setDocumentUri } = useDriverVerificationWizard();

  const capture = async (target: 'drivers_license_front' | 'drivers_license_back' | 'driver_selfie') => {
    const permission =
      target === 'driver_selfie'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Camera access is needed to capture this document.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      cameraType: target === 'driver_selfie' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
    });
    if (!result.canceled && result.assets[0]) {
      setDocumentUri(target, result.assets[0].uri);
    }
  };

  const handleNext = () => {
    const licenseResult = validateDriverLicenseNumber(draft.licenseNumber);
    if (!licenseResult.valid) {
      Alert.alert('Invalid license number', licenseResult.errors.join(' '));
      return;
    }
    if (!draft.licenseCategory) {
      Alert.alert('License category required', 'Select your license category/class.');
      return;
    }
    if (!draft.licenseIssueDate || !draft.licenseExpiryDate) {
      Alert.alert('License dates required', 'Enter both the issue and expiry date.');
      return;
    }
    const datesResult = validateLicenseDates(
      new Date(draft.licenseIssueDate),
      new Date(draft.licenseExpiryDate)
    );
    if (!datesResult.valid) {
      Alert.alert('Invalid license dates', datesResult.errors.join(' '));
      return;
    }
    if (!draft.documentUris.drivers_license_front || !draft.documentUris.drivers_license_back) {
      Alert.alert('License photos required', 'Capture both the front and back of your license.');
      return;
    }
    if (!draft.documentUris.driver_selfie) {
      Alert.alert('Selfie required', 'Capture a selfie photo.');
      return;
    }
    router.push('/driver-verification/vehicle-info' as any);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.label, { color: colors.text }]}>License Number</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            value={draft.licenseNumber}
            onChangeText={(value) => updateDraft({ licenseNumber: value })}
            placeholder="Nigerian driver's license number"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="characters"
          />

          <Text style={[styles.label, { color: colors.text }]}>License Category/Class</Text>
          <View style={styles.chipRow}>
            {LICENSE_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.chip,
                  { borderColor: colors.border },
                  draft.licenseCategory === cat && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => updateDraft({ licenseCategory: cat })}
              >
                <Text style={{ color: draft.licenseCategory === cat ? colors.white : colors.text, fontWeight: '600' }}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.text }]}>Issue Date</Text>
          <DatePickerField
            value={draft.licenseIssueDate}
            onChange={(isoDate) => updateDraft({ licenseIssueDate: isoDate })}
            placeholder="Select issue date"
            maximumDate={new Date()}
            borderColor={colors.border}
            textColor={colors.text}
            placeholderColor={colors.textSecondary}
            testID="license-issue-date-input"
          />

          <Text style={[styles.label, { color: colors.text }]}>Expiry Date</Text>
          <DatePickerField
            value={draft.licenseExpiryDate}
            onChange={(isoDate) => updateDraft({ licenseExpiryDate: isoDate })}
            placeholder="Select expiry date"
            minimumDate={new Date()}
            borderColor={colors.border}
            textColor={colors.text}
            placeholderColor={colors.textSecondary}
            testID="license-expiry-date-input"
          />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Photos</Text>
          <DocumentCaptureRow
            label="License — Front"
            uri={draft.documentUris.drivers_license_front}
            onCapture={() => capture('drivers_license_front')}
            colors={colors}
          />
          <DocumentCaptureRow
            label="License — Back"
            uri={draft.documentUris.drivers_license_back}
            onCapture={() => capture('drivers_license_back')}
            colors={colors}
          />
          <DocumentCaptureRow
            label="Selfie"
            uri={draft.documentUris.driver_selfie}
            onCapture={() => capture('driver_selfie')}
            colors={colors}
          />
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
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
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
