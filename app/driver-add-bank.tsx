import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import Toast from 'react-native-toast-message';
import Button from '@/components/Button';
import Colors from '@/constants/colors';
import { useTheme } from '@/hooks/useThemeStore';
import { useDriverAuth } from '@/hooks/useDriverAuthStore';
import { DriverWalletService } from '@/lib/driver-wallet-service';

export default function DriverAddBankScreen() {
  const { colors } = useTheme();
  const { driver } = useDriverAuth();

  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!bankName.trim() || !accountNumber.trim() || !accountName.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (accountNumber.replace(/\D/g, '').length < 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit account number');
      return;
    }
    if (!driver?.id) {
      Alert.alert('Error', 'Not logged in as a driver');
      return;
    }

    setIsSaving(true);
    try {
      await DriverWalletService.addBankAccount(
        driver.id,
        bankName.trim(),
        accountNumber.trim(),
        accountName.trim(),
        isDefault
      );
      Toast.show({ type: 'success', text1: 'Bank Account Added', position: 'top' });
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save bank account');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Add Bank Account' }} />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.label, { color: colors.text }]}>Bank Name</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              value={bankName}
              onChangeText={setBankName}
              placeholder="e.g. Access Bank, GTBank, Zenith Bank"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.label, { color: colors.text }]}>Account Number</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              value={accountNumber}
              onChangeText={setAccountNumber}
              placeholder="10-digit NUBAN account number"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              maxLength={10}
            />

            <Text style={[styles.label, { color: colors.text }]}>Account Holder Name</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              value={accountName}
              onChangeText={setAccountName}
              placeholder="As it appears on your bank account"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="words"
            />

            <View style={styles.defaultRow}>
              <Text style={[styles.defaultLabel, { color: colors.text }]}>Set as default account</Text>
              <Switch
                value={isDefault}
                onValueChange={setIsDefault}
                trackColor={{ true: colors.primary }}
              />
            </View>
          </View>

          <View style={[styles.notice, { backgroundColor: colors.lightGray }]}>
            <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
              Withdrawal requests are processed manually within 1-3 business days. Ensure your account details are correct before submitting a withdrawal.
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <Button
            title={isSaving ? 'Saving...' : 'Save Bank Account'}
            onPress={handleSave}
            disabled={isSaving}
            loading={isSaving}
          />
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16 },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  defaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
  },
  defaultLabel: { fontSize: 15, fontWeight: '500' },
  notice: {
    borderRadius: 12,
    padding: 14,
  },
  noticeText: { fontSize: 13, lineHeight: 19 },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
});
