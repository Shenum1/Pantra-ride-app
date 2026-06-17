import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Alert,
  TextInput,
  Modal,
  RefreshControl,
} from 'react-native';
import {
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  Gift,
  Zap,
  Clock,
  Star,
  Eye,
  EyeOff,
  Download,
  Send,
  Plus,
  CreditCard,
} from 'lucide-react-native';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useTheme } from '@/hooks/useThemeStore';
import { useDriverStore } from '@/hooks/useDriverStore';
import { useDriverAuth } from '@/hooks/useDriverAuthStore';
import { LinearGradient } from 'expo-linear-gradient';
import { DriverWalletService, DriverBankAccount, DriverPayout } from '@/lib/driver-wallet-service';



interface Transaction {
  id: string;
  type: 'earning' | 'tip' | 'bonus' | 'payout';
  amount: number;
  description: string;
  date: string;
  time: string;
}

interface EarningsData {
  today: number;
  week: number;
  month: number;
  tips: number;
}

export default function DriverWallet() {
  const { colors } = useTheme();
  const { driverProfile, earnings: earningsHistory, stats } = useDriverStore();
  const { driver } = useDriverAuth();
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bankAccounts, setBankAccounts] = useState<DriverBankAccount[]>([]);
  const [payouts, setPayouts] = useState<DriverPayout[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadWalletData = useCallback(async () => {
    if (!driver?.id) return;
    try {
      const [accounts, payoutHistory] = await Promise.all([
        DriverWalletService.getBankAccounts(driver.id),
        DriverWalletService.getPayouts(driver.id),
      ]);
      setBankAccounts(accounts);
      setPayouts(payoutHistory);
      const defaultAccount = accounts.find(a => a.isDefault) ?? accounts[0];
      if (defaultAccount) setSelectedBankId(defaultAccount.id);
    } catch (error: any) {
      console.error('Failed to load wallet data:', error.message);
    }
  }, [driver?.id]);

  useEffect(() => { void loadWalletData(); }, [loadWalletData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWalletData();
    setRefreshing(false);
  };

  const earnings: EarningsData = {
    today: driverProfile?.earnings?.today ?? 0,
    week: driverProfile?.earnings?.thisWeek ?? 0,
    month: driverProfile?.earnings?.thisMonth ?? 0,
    tips: 0,
  };

  const currentEarnings = earnings[selectedPeriod];

  const transactions: Transaction[] = earningsHistory.map((e: any) => ({
    id: e.id ?? String(Math.random()),
    type: 'earning' as const,
    amount: e.amount ?? 0,
    description: e.description ?? 'Trip',
    date: e.date ? new Date(e.date).toLocaleDateString() : '',
    time: e.date ? new Date(e.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
  }));



  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'earning':
        return <ArrowUpRight size={20} color="#4CAF50" />;
      case 'tip':
        return <Star size={20} color="#FFD700" />;
      case 'bonus':
        return <Gift size={20} color="#FF9800" />;
      case 'payout':
        return <ArrowDownLeft size={20} color="#2196F3" />;
      default:
        return <DollarSign size={20} color={colors.textSecondary} />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'earning':
      case 'tip':
      case 'bonus':
        return '#4CAF50';
      case 'payout':
        return colors.textSecondary;
      default:
        return colors.text;
    }
  };



  const TransactionItem = ({ transaction }: { transaction: Transaction }) => (
    <View style={[styles.transactionItem, { backgroundColor: colors.card }]}>
      <View style={[styles.transactionIcon, { backgroundColor: colors.lightGray }]}>
        {getTransactionIcon(transaction.type)}
      </View>
      <View style={styles.transactionDetails}>
        <Text style={[styles.transactionDescription, { color: colors.text }]}>{transaction.description}</Text>
        <Text style={[styles.transactionDateTime, { color: colors.textSecondary }]}>
          {transaction.date} • {transaction.time}
        </Text>
      </View>
      <Text style={[
        styles.transactionAmount,
        { color: getTransactionColor(transaction.type) }
      ]}>
        {transaction.amount > 0 ? '+' : ''}₦{Math.abs(transaction.amount).toFixed(2)}
      </Text>
    </View>
  );

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);

    if (!withdrawAmount || isNaN(amount)) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }
    if (amount < 100) {
      Alert.alert('Minimum Withdrawal', 'Minimum withdrawal amount is ₦100');
      return;
    }
    if (amount > currentEarnings) {
      Alert.alert('Insufficient Balance', 'You do not have enough balance for this withdrawal');
      return;
    }
    if (!selectedBankId) {
      Alert.alert('No Bank Account', 'Please add a bank account first');
      return;
    }
    if (!driver?.id) return;

    setIsSubmitting(true);
    try {
      await DriverWalletService.requestWithdrawal(driver.id, amount, selectedBankId);
      setWithdrawModalVisible(false);
      setWithdrawAmount('');
      await loadWalletData();
      Toast.show({
        type: 'success',
        text1: 'Withdrawal Requested',
        text2: `₦${amount.toFixed(2)} request submitted — processed within 1-3 business days`,
        position: 'top',
        visibilityTime: 4000,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit withdrawal request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusColor = (status: DriverPayout['status']) => {
    switch (status) {
      case 'completed': return '#4CAF50';
      case 'processing': return '#FF9800';
      case 'failed': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Balance Card with Gradient */}
        <View style={styles.balanceSection}>
          <LinearGradient
            colors={[colors.primary, colors.primary + 'DD', colors.primary + 'BB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.balanceCard}
          >
            <View style={styles.balanceHeader}>
              <View>
                <Text style={styles.balanceLabel}>Total Balance</Text>
                <View style={styles.balanceAmountContainer}>
                  <Text style={styles.balanceAmount}>
                    {balanceVisible ? `${currentEarnings.toFixed(2)}` : '••••••'}
                  </Text>
                  <Pressable 
                    onPress={() => setBalanceVisible(!balanceVisible)}
                    style={styles.eyeButton}
                  >
                    {balanceVisible ? (
                      <Eye size={20} color="#FFF" />
                    ) : (
                      <EyeOff size={20} color="#FFF" />
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
            
            <View style={styles.balanceActions}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => setWithdrawModalVisible(true)}
              >
                <View style={styles.actionIcon}>
                  <Send size={18} color={colors.primary} />
                </View>
                <Text style={styles.actionText}>Withdraw</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => {
                  Alert.alert(
                    'Download Statement',
                    'Your earnings statement will be emailed to you.',
                    [{ text: 'OK' }]
                  );
                }}
              >
                <View style={styles.actionIcon}>
                  <Download size={18} color={colors.primary} />
                </View>
                <Text style={styles.actionText}>Statement</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {/* Period Selector */}
        <View style={styles.periodSelector}>
          <TouchableOpacity 
            style={[
              styles.periodButton,
              { backgroundColor: colors.card },
              selectedPeriod === 'today' && { backgroundColor: colors.primary }
            ]}
            onPress={() => setSelectedPeriod('today')}
          >
            <Text style={[
              styles.periodButtonText,
              { color: colors.text },
              selectedPeriod === 'today' && styles.periodButtonTextActive
            ]}>Today</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.periodButton,
              { backgroundColor: colors.card },
              selectedPeriod === 'week' && { backgroundColor: colors.primary }
            ]}
            onPress={() => setSelectedPeriod('week')}
          >
            <Text style={[
              styles.periodButtonText,
              { color: colors.text },
              selectedPeriod === 'week' && styles.periodButtonTextActive
            ]}>Week</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.periodButton,
              { backgroundColor: colors.card },
              selectedPeriod === 'month' && { backgroundColor: colors.primary }
            ]}
            onPress={() => setSelectedPeriod('month')}
          >
            <Text style={[
              styles.periodButtonText,
              { color: colors.text },
              selectedPeriod === 'month' && styles.periodButtonTextActive
            ]}>Month</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsSection}>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <View style={[styles.statIconContainer, { backgroundColor: '#4CAF50' + '20' }]}>
              <Clock size={22} color="#4CAF50" />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>—</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Online Time</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <View style={[styles.statIconContainer, { backgroundColor: '#FF9800' + '20' }]}>
              <Zap size={22} color="#FF9800" />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.totalRides}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Trips</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <View style={[styles.statIconContainer, { backgroundColor: '#2196F3' + '20' }]}>
              <TrendingUp size={22} color="#2196F3" />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>
              ₦{stats.totalRides > 0 ? Math.round(stats.totalEarnings / stats.totalRides).toLocaleString() : '0'}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Avg/Trip</Text>
          </View>
        </View>

        {/* Earnings Breakdown */}
        <View style={styles.breakdownSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Earnings Breakdown</Text>
          
          <View style={[styles.breakdownCard, { backgroundColor: colors.card }]}>
            <View style={styles.breakdownItem}>
              <View style={styles.breakdownLeft}>
                <View style={[styles.breakdownIcon, { backgroundColor: '#4CAF50' + '20' }]}>
                  <DollarSign size={18} color="#4CAF50" />
                </View>
                <Text style={[styles.breakdownLabel, { color: colors.text }]}>Trip Earnings</Text>
              </View>
              <Text style={[styles.breakdownValue, { color: colors.text }]}>₦{currentEarnings.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={styles.transactionsSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Activity</Text>
          </View>
          {transactions.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No transactions yet</Text>
          ) : (
            transactions.map((transaction) => (
              <TransactionItem key={transaction.id} transaction={transaction} />
            ))
          )}
        </View>

        {/* Bank Accounts */}
        <View style={styles.transactionsSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Bank Accounts</Text>
            <TouchableOpacity onPress={() => router.push('/driver-add-bank' as any)}>
              <View style={styles.addBankBtn}>
                <Plus size={14} color={colors.primary} />
                <Text style={[styles.viewAllText, { color: colors.primary }]}>Add</Text>
              </View>
            </TouchableOpacity>
          </View>
          {bankAccounts.length === 0 ? (
            <TouchableOpacity
              style={[styles.emptyBankCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push('/driver-add-bank' as any)}
            >
              <CreditCard size={24} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary, marginTop: 8 }]}>
                No bank accounts added yet
              </Text>
              <Text style={[styles.emptySubText, { color: colors.primary }]}>Tap to add one</Text>
            </TouchableOpacity>
          ) : (
            bankAccounts.map(account => (
              <View key={account.id} style={[styles.bankCard, { backgroundColor: colors.card }]}>
                <CreditCard size={20} color={colors.primary} />
                <View style={styles.bankCardDetails}>
                  <Text style={[styles.bankCardName, { color: colors.text }]}>{account.bankName}</Text>
                  <Text style={[styles.bankCardNumber, { color: colors.textSecondary }]}>
                    {account.accountName} • ••••{account.accountNumber.slice(-4)}
                  </Text>
                </View>
                {account.isDefault && (
                  <View style={[styles.defaultBadge, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.defaultBadgeText, { color: colors.primary }]}>Default</Text>
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        {/* Payout History */}
        {payouts.length > 0 && (
          <View style={styles.transactionsSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Payout History</Text>
            {payouts.map(payout => (
              <View key={payout.id} style={[styles.transactionItem, { backgroundColor: colors.card }]}>
                <View style={[styles.transactionIcon, { backgroundColor: colors.lightGray }]}>
                  <ArrowDownLeft size={20} color={statusColor(payout.status)} />
                </View>
                <View style={styles.transactionDetails}>
                  <Text style={[styles.transactionDescription, { color: colors.text }]}>
                    Withdrawal — {payout.bankAccount?.bankName ?? 'Bank'}
                  </Text>
                  <Text style={[styles.transactionDateTime, { color: colors.textSecondary }]}>
                    {new Date(payout.requestedAt).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.payoutRight}>
                  <Text style={[styles.transactionAmount, { color: colors.text }]}>
                    ₦{payout.amount.toFixed(2)}
                  </Text>
                  <Text style={[styles.payoutStatus, { color: statusColor(payout.status) }]}>
                    {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Withdraw Modal */}
      <Modal
        visible={withdrawModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setWithdrawModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Withdraw Funds</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Available Balance: ₦{currentEarnings.toFixed(2)}
            </Text>
            
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Amount</Text>
              <View style={[styles.inputWrapper, { borderColor: colors.border }]}>
                <Text style={[styles.currencySymbol, { color: colors.text }]}>₦</Text>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="decimal-pad"
                  value={withdrawAmount}
                  onChangeText={setWithdrawAmount}
                />
              </View>
              <Text style={[styles.inputHint, { color: colors.textSecondary }]}>
                Minimum withdrawal: ₦10
              </Text>
            </View>

            <View style={styles.quickAmounts}>
              <TouchableOpacity
                style={[styles.quickAmount, { backgroundColor: colors.lightGray }]}
                onPress={() => setWithdrawAmount('50')}
              >
                <Text style={[styles.quickAmountText, { color: colors.text }]}>₦50</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickAmount, { backgroundColor: colors.lightGray }]}
                onPress={() => setWithdrawAmount('100')}
              >
                <Text style={[styles.quickAmountText, { color: colors.text }]}>₦100</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickAmount, { backgroundColor: colors.lightGray }]}
                onPress={() => setWithdrawAmount('200')}
              >
                <Text style={[styles.quickAmountText, { color: colors.text }]}>₦200</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickAmount, { backgroundColor: colors.lightGray }]}
                onPress={() => setWithdrawAmount(currentEarnings.toFixed(2))}
              >
                <Text style={[styles.quickAmountText, { color: colors.text }]}>All</Text>
              </TouchableOpacity>
            </View>

            {bankAccounts.length === 0 ? (
              <TouchableOpacity
                style={[styles.bankInfo, { backgroundColor: colors.lightGray }]}
                onPress={() => { setWithdrawModalVisible(false); router.push('/driver-add-bank' as any); }}
              >
                <Text style={[styles.bankInfoText, { color: colors.textSecondary }]}>No bank account added.</Text>
                <Text style={[styles.bankInfoAccount, { color: colors.primary }]}>Tap to add one →</Text>
              </TouchableOpacity>
            ) : (
              <View>
                <Text style={[styles.bankInfoText, { color: colors.textSecondary, marginBottom: 8 }]}>Send to:</Text>
                {bankAccounts.map(account => (
                  <TouchableOpacity
                    key={account.id}
                    style={[
                      styles.bankInfo,
                      { backgroundColor: selectedBankId === account.id ? colors.primary + '20' : colors.lightGray },
                      selectedBankId === account.id && { borderWidth: 1, borderColor: colors.primary },
                    ]}
                    onPress={() => setSelectedBankId(account.id)}
                  >
                    <Text style={[styles.bankInfoAccount, { color: colors.text }]}>
                      {account.bankName} • ••••{account.accountNumber.slice(-4)}
                    </Text>
                    <Text style={[styles.bankInfoText, { color: colors.textSecondary }]}>{account.accountName}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => { setWithdrawModalVisible(false); setWithdrawAmount(''); }}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton, { backgroundColor: isSubmitting ? colors.primary + '80' : colors.primary }]}
                onPress={handleWithdraw}
                disabled={isSubmitting}
              >
                <Text style={styles.confirmButtonText}>{isSubmitting ? 'Submitting…' : 'Withdraw'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  balanceSection: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  balanceCard: {
    borderRadius: 24,
    padding: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  balanceHeader: {
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 8,
    fontWeight: '500',
  },
  balanceAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginRight: 12,
  },
  eyeButton: {
    padding: 4,
  },
  balanceActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  periodSelector: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 10,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  periodButtonTextActive: {
    color: '#FFFFFF',
  },
  statsSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
  breakdownSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  breakdownCard: {
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  breakdownIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  breakdownValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  transactionsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionDateTime: {
    fontSize: 12,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '600',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 20,
    paddingVertical: 16,
  },
  inputHint: {
    fontSize: 12,
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  quickAmount: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bankInfo: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  bankInfoText: {
    fontSize: 12,
    marginBottom: 4,
  },
  bankInfoAccount: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {},
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    marginVertical: 8,
  },
  emptySubText: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  emptyBankCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
    marginBottom: 8,
  },
  bankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  bankCardDetails: { flex: 1 },
  bankCardName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  bankCardNumber: { fontSize: 12 },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  defaultBadgeText: { fontSize: 11, fontWeight: '700' },
  addBankBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  payoutRight: { alignItems: 'flex-end', gap: 4 },
  payoutStatus: { fontSize: 11, fontWeight: '600' },
});