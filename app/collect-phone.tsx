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
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuthStore';
import Button from '@/components/Button';
import Colors from '@/constants/colors';

// Asks for a phone number that a Google sign-in never provides (email signup
// collects it inline). Saved as-is, with no SMS code — same as email signup,
// which doesn't verify the phone either. Verifying would need an SMS provider
// configured in Supabase.
//
// Two entry points:
//  - right after Google sign-in (skippable, then continues to home), and
//  - from booking, when a rider with no number tries to book (`required=1`):
//    no skip, and it returns to the booking screen once saved, because the
//    driver needs a number to call the rider.
function formatE164(rawPhone: string): string {
  const trimmed = rawPhone.trim().replace(/[\s-]/g, '');
  return trimmed.startsWith('+') ? trimmed : `+234${trimmed.replace(/^0+/, '')}`;
}

export default function CollectPhoneScreen() {
  const { required } = useLocalSearchParams<{ required?: string }>();
  const isRequired = required === '1';
  const { updateProfile } = useAuth();
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const leave = () => {
    if (isRequired && router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/home');
    }
  };

  const handleSave = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      Alert.alert('Invalid number', 'Enter a valid phone number, e.g. 08012345678.');
      return;
    }
    setIsSaving(true);
    try {
      await updateProfile({ phone: formatE164(phone) });
      leave();
    } catch (error: any) {
      Alert.alert('Could not save number', error?.message ?? 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <View style={styles.content}>
          <Text style={styles.title}>Add your phone number</Text>
          <Text style={styles.subtitle}>
            {isRequired
              ? 'Your driver needs a number to reach you at pickup. Add one to continue booking.'
              : 'Drivers and support use this to reach you about your rides. You can add it later from your profile.'}
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. 08012345678"
              placeholderTextColor={Colors.light.textSecondary}
              keyboardType="phone-pad"
              autoFocus
              testID="collect-phone-input"
            />
          </View>

          <Button title="Save" onPress={handleSave} loading={isSaving} disabled={isSaving} testID="collect-phone-save" />

          {!isRequired && (
            <Pressable style={styles.skipButton} onPress={leave} testID="collect-phone-skip">
              <Text style={styles.skipText}>Skip for now</Text>
            </Pressable>
          )}
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
