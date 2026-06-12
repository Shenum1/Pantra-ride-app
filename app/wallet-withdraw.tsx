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
import { ArrowUpCircle, Plus, Building2, CheckCircle, Clock } from 'lucide-react-native';
import { useTheme } from '@/hooks/useThemeStore';
import { useWallet } from '@/hooks/useWalletStore';

export default function WithdrawScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { withdrawMoneyAsync, isWithdrawing, balance, bankAccounts } = useWallet();
  
  const [amount, setAmount] = useState('');
  const [selectedBankId, setSelectedBankId] = useState<string>('');

  const quickAmounts = [50, 100, 200, 500];
  const defaultBank = bankAccounts.find(acc => acc.isDefault);

  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (defaultBank && !selectedBankId) {
      setSelectedBankId(defaultBank.id);
    }
  }, [defaultBank, selectedBankId]);

  const handleWithdraw = async () => {
    const numAmount = parseFloat(amount);
    
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }
    
    if (numAmount < 10) {
      Alert.alert('Minimum Amount', 'Minimum withdrawal amount is ₦10');
      return;
    }
    
    if (numAmount > balance) {
      Alert.alert('Insufficient Balance', `You only have ₦${balance.toFixed(2)} available`);
      return;
    }
    
    if (!selectedBankId) {
      Alert.alert('Select Bank', 'Please select a bank account');
      return;
    }

    try {
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

      await withdrawMoneyAsync({ amount: numAmount, bankAccountId: selectedBankId });
      Alert.alert(
        'Withdrawal Initiated',
        `₦${numAmount.toFixed(2)} will be transferred to your bank account within 1-3 business days`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to withdraw. Please try again.');
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Withdraw Money',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
        }}
      />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.balanceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ArrowUpCircle size={24} color={colors.primary} />
            <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>Available Balance</Text>
            <Animated.Text style={[styles.balanceAmount, { color: colors.text, transform: [{ scale: scaleAnim }] }]}>
              ₦{balance.toFixed(2)}
            </Animated.Text>
          </View>

          <View style={styles.amountSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Withdrawal Amount</Text>
            <View style={[styles.amountInputContainer, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={[styles.currencySymbol, { color: colors.text }]}>₦</Text>
              <TextInput
                style={[styles.amountInput, { color: colors.text }]}
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
              />
            </View>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Minimum: ₦10 • Maximum: ₦{balance.toFixed(2)}
            </Text>
          </View>

          <View style={styles.quickAmountsSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Amounts</Text>
            <View style={styles.quickAmountsGrid}>
              {quickAmounts.map((quickAmount) => (
                <TouchableOpacity
                  key={quickAmount}
                  style={[
                    styles.quickAmountButton,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    amount === quickAmount.toString() && { backgroundColor: colors.primary, borderColor: colors.primary },
                    quickAmount > balance && { opacity: 0.4 }
                  ]}
                  onPress={() => quickAmount <= balance && setAmount(quickAmount.toString())}
                  disabled={quickAmount > balance}
                >
                  <Text
                    style={[
                      styles.quickAmountText,
                      { color: colors.text },
                      amount === quickAmount.toString() && { color: '#FFF' }
                    ]}
                  >
                    ₦{quickAmount}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.bankSection}>
            <View style={styles.bankHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Bank Account</Text>
              <TouchableOpacity onPress={() => router.push('/wallet-bank-accounts' as any)}>
                <Text style={[styles.manageText, { color: colors.primary }]}>Manage</Text>
              </TouchableOpacity>
            </View>
            {bankAccounts.length === 0 ? (
              <TouchableOpacity
                style={[styles.addBankButton, { backgroundColor: colors.card, borderColor: colors.primary }]}
                onPress={() => router.push('/wallet-add-bank' as any)}
              >
                <Plus size={20} color={colors.primary} />
                <Text style={[styles.addBankText, { color: colors.primary }]}>Add Bank Account</Text>
              </TouchableOpacity>
            ) : (
              bankAccounts.map((account) => (
                <TouchableOpacity
                  key={account.id}
                  style={[
                    styles.bankAccountCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    selectedBankId === account.id && { borderColor: colors.primary, borderWidth: 2 }
                  ]}
                  onPress={() => setSelectedBankId(account.id)}
                >
                  <View style={[styles.bankIconContainer, { backgroundColor: colors.primary + '20' }]}>
                    <Building2 size={20} color={colors.primary} />
                  </View>
                  <View style={styles.bankAccountInfo}>
                    <Text style={[styles.bankName, { color: colors.text }]}>{account.bankName}</Text>
                    <Text style={[styles.accountNumber, { color: colors.textSecondary }]}>
                      {account.accountNumber}
                    </Text>
                    <View style={styles.accountStatus}>
                      {account.isVerified ? (
                        <>
                          <CheckCircle size={14} color="#4CAF50" />
                          <Text style={[styles.statusText, { color: '#4CAF50' }]}>Verified</Text>
                        </>
                      ) : (
                        <>
                          <Clock size={14} color="#FF9800" />
                          <Text style={[styles.statusText, { color: '#FF9800' }]}>Pending Verification</Text>
                        </>
                      )}
                    </View>
                  </View>
                  {account.isDefault && (
                    <View style={[styles.defaultBadge, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={[styles.defaultBadgeText, { color: colors.primary }]}>Default</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>

          <View style={[styles.infoBox, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
            <Text style={[styles.infoText, { color: colors.text }]}>
              • Withdrawals are processed within 1-3 business days{'\n'}
              • No fees for withdrawals above ₦10{'\n'}
              • Bank account must be verified
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.withdrawButton,
              { backgroundColor: colors.primary },
              (isWithdrawing || !amount || !selectedBankId || parseFloat(amount) > balance) && { opacity: 0.5 }
            ]}
            onPress={handleWithdraw}
            disabled={isWithdrawing || !amount || !selectedBankId || parseFloat(amount) > balance}
          >
            <Text style={styles.withdrawButtonText}>
              {isWithdrawing ? 'Processing...' : 'Withdraw Money'}
            </Text>
          </TouchableOpacity>
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
  balanceCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 14,
    marginTop: 8,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 4,
  },
  amountSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '600',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    paddingVertical: 16,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    marginTop: 8,
  },
  quickAmountsSection: {
    marginBottom: 24,
  },
  quickAmountsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAmountButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  quickAmountText: {
    fontSize: 16,
    fontWeight: '600',
  },
  bankSection: {
    marginBottom: 24,
  },
  bankHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  manageText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bankAccountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  bankIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bankAccountInfo: {
    flex: 1,
  },
  bankName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  accountNumber: {
    fontSize: 14,
    marginBottom: 4,
  },
  accountStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  defaultBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addBankButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addBankText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  infoBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
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
  withdrawButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  withdrawButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
