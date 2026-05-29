import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { CreditCard, Plus, Wallet } from 'lucide-react-native';
import { useTheme } from '@/hooks/useThemeStore';
import { useWallet } from '@/hooks/useWalletStore';
import { usePayment } from '@/hooks/usePaymentStore';

export default function AddMoneyScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { isAddingMoney, balance } = useWallet();
  const { paymentMethods } = usePayment();
  
  const [amount, setAmount] = useState('');
  const [selectedPaymentId, setSelectedPaymentId] = useState<string>('');

  const quickAmounts = [1000, 2500, 5000, 10000];
  const defaultPayment = paymentMethods.find(pm => pm.isDefault);

  React.useEffect(() => {
    if (defaultPayment && !selectedPaymentId) {
      setSelectedPaymentId(defaultPayment.id);
    }
  }, [defaultPayment, selectedPaymentId]);

  const handleAddMoney = async () => {
    const numAmount = parseFloat(amount);
    
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }
    
    if (numAmount < 100) {
      Alert.alert('Minimum Amount', 'Minimum wallet funding amount is ₦100');
      return;
    }

    router.push({
      pathname: '/payment-initialize' as any,
      params: {
        gateway: 'flutterwave',
        amount: String(numAmount),
        purpose: 'wallet_funding',
        paymentMethodId: selectedPaymentId || 'flutterwave',
      },
    });
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Add Money',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
        }}
      />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.balanceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Wallet size={24} color={colors.primary} />
            <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>Current Balance</Text>
            <Text style={[styles.balanceAmount, { color: colors.text }]}>₦{balance.toFixed(0)}</Text>
          </View>

          <View style={styles.amountSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Enter Amount</Text>
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
            <Text style={[styles.hint, { color: colors.textSecondary }]}>Minimum: ₦100. Secured by Flutterwave.</Text>
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
                    amount === quickAmount.toString() && { backgroundColor: colors.primary, borderColor: colors.primary }
                  ]}
                  onPress={() => setAmount(quickAmount.toString())}
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

          <View style={styles.paymentSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Payment Method</Text>
            {paymentMethods.length === 0 ? (
              <TouchableOpacity
                style={[styles.addPaymentButton, { backgroundColor: colors.card, borderColor: colors.primary }]}
                onPress={() => router.push('/payment-methods' as any)}
              >
                <Plus size={20} color={colors.primary} />
                <Text style={[styles.addPaymentText, { color: colors.primary }]}>Add Payment Method</Text>
              </TouchableOpacity>
            ) : (
              paymentMethods.map((method) => (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.paymentMethodCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    selectedPaymentId === method.id && { borderColor: colors.primary, borderWidth: 2 }
                  ]}
                  onPress={() => setSelectedPaymentId(method.id)}
                >
                  <CreditCard size={20} color={colors.text} />
                  <View style={styles.paymentMethodInfo}>
                    <Text style={[styles.paymentMethodName, { color: colors.text }]}>{method.name}</Text>
                    {method.lastFour && (
                      <Text style={[styles.paymentMethodDetails, { color: colors.textSecondary }]}>
                        •••• {method.lastFour}
                      </Text>
                    )}
                  </View>
                  {method.isDefault && (
                    <View style={[styles.defaultBadge, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={[styles.defaultBadgeText, { color: colors.primary }]}>Default</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.addButton,
              { backgroundColor: colors.primary },
              (isAddingMoney || !amount) && { opacity: 0.5 }
            ]}
            onPress={handleAddMoney}
            disabled={isAddingMoney || !amount}
          >
            <Text style={styles.addButtonText}>
              {isAddingMoney ? 'Opening...' : 'Fund with Flutterwave'}
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
  paymentSection: {
    marginBottom: 24,
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  paymentMethodInfo: {
    flex: 1,
    marginLeft: 12,
  },
  paymentMethodName: {
    fontSize: 16,
    fontWeight: '600',
  },
  paymentMethodDetails: {
    fontSize: 14,
    marginTop: 2,
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
  addPaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addPaymentText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
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
