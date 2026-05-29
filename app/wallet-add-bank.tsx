import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Building2, CheckCircle } from 'lucide-react-native';
import { useTheme } from '@/hooks/useThemeStore';
import { useWallet } from '@/hooks/useWalletStore';

export default function AddBankAccountScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { addBankAccountAsync, bankAccounts } = useWallet();
  
  const [bankName, setBankName] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [accountType, setAccountType] = useState<'savings' | 'checking'>('savings');
  const [isDefault, setIsDefault] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handleAddAccount = async () => {
    if (!bankName.trim()) {
      Alert.alert('Required', 'Please enter bank name');
      return;
    }
    
    if (!accountHolderName.trim()) {
      Alert.alert('Required', 'Please enter account holder name');
      return;
    }
    
    if (!accountNumber.trim()) {
      Alert.alert('Required', 'Please enter account number');
      return;
    }
    
    if (accountNumber !== confirmAccountNumber) {
      Alert.alert('Mismatch', 'Account numbers do not match');
      return;
    }

    if (accountNumber.length < 8 || accountNumber.length > 18) {
      Alert.alert('Invalid', 'Account number must be between 8-18 digits');
      return;
    }

    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      setIsLoading(true);
      
      const maskedAccountNumber = `****${accountNumber.slice(-4)}`;
      
      await addBankAccountAsync({
        bankName,
        accountHolderName,
        accountNumber: maskedAccountNumber,
        ifscCode: ifscCode || undefined,
        type: accountType,
        isDefault: bankAccounts.length === 0 ? true : isDefault,
      });
      
      Alert.alert(
        'Success',
        'Bank account added successfully. It will be verified within 1-2 business days.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to add bank account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Add Bank Account',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
        }}
      />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
              <Building2 size={32} color={colors.primary} />
            </View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Add Your Bank Account</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              Your bank details are encrypted and secure
            </Text>
          </View>

          <View style={styles.formSection}>
            <Text style={[styles.label, { color: colors.text }]}>Bank Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              placeholder="Enter bank name"
              placeholderTextColor={colors.textSecondary}
              value={bankName}
              onChangeText={setBankName}
              autoCapitalize="words"
            />

            <Text style={[styles.label, { color: colors.text }]}>Account Holder Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              placeholder="Enter account holder name"
              placeholderTextColor={colors.textSecondary}
              value={accountHolderName}
              onChangeText={setAccountHolderName}
              autoCapitalize="words"
            />

            <Text style={[styles.label, { color: colors.text }]}>Account Type *</Text>
            <View style={styles.accountTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.accountTypeButton,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  accountType === 'savings' && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}
                onPress={() => setAccountType('savings')}
              >
                <Text
                  style={[
                    styles.accountTypeText,
                    { color: colors.text },
                    accountType === 'savings' && { color: '#FFF' }
                  ]}
                >
                  Savings
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.accountTypeButton,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  accountType === 'checking' && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}
                onPress={() => setAccountType('checking')}
              >
                <Text
                  style={[
                    styles.accountTypeText,
                    { color: colors.text },
                    accountType === 'checking' && { color: '#FFF' }
                  ]}
                >
                  Checking
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: colors.text }]}>Account Number *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              placeholder="Enter account number"
              placeholderTextColor={colors.textSecondary}
              value={accountNumber}
              onChangeText={setAccountNumber}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={18}
            />

            <Text style={[styles.label, { color: colors.text }]}>Confirm Account Number *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              placeholder="Re-enter account number"
              placeholderTextColor={colors.textSecondary}
              value={confirmAccountNumber}
              onChangeText={setConfirmAccountNumber}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={18}
            />

            <Text style={[styles.label, { color: colors.text }]}>IFSC/SWIFT Code</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              placeholder="Enter IFSC or SWIFT code (optional)"
              placeholderTextColor={colors.textSecondary}
              value={ifscCode}
              onChangeText={setIfscCode}
              autoCapitalize="characters"
            />

            {bankAccounts.length > 0 && (
              <TouchableOpacity
                style={styles.defaultCheckbox}
                onPress={() => setIsDefault(!isDefault)}
              >
                <View
                  style={[
                    styles.checkbox,
                    { borderColor: colors.border },
                    isDefault && { backgroundColor: colors.primary, borderColor: colors.primary }
                  ]}
                >
                  {isDefault && <CheckCircle size={18} color="#FFF" />}
                </View>
                <Text style={[styles.checkboxLabel, { color: colors.text }]}>Set as default account</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={[styles.infoBox, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
            <Text style={[styles.infoText, { color: colors.text }]}>
              • Your account will be verified within 1-2 business days{'\n'}
              • We use bank-grade encryption to protect your data{'\n'}
              • Account details are never shared with third parties
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
              style={[
                styles.addButton,
                { backgroundColor: colors.primary },
                isLoading && { opacity: 0.5 }
              ]}
              onPress={handleAddAccount}
              disabled={isLoading}
            >
              <Text style={styles.addButtonText}>
                {isLoading ? 'Adding Account...' : 'Add Bank Account'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  headerCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  formSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  accountTypeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  accountTypeButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  accountTypeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  defaultCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    borderTopWidth: 1,
  },
  addButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
