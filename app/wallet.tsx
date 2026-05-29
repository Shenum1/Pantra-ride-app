import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Animated,
} from 'react-native';
import {
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  Eye,
  EyeOff,
  Plus,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  Gift,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useThemeStore';
import { useWallet } from '@/hooks/useWalletStore';
import { Stack, useRouter } from 'expo-router';
import { format } from 'date-fns';

interface TransactionItemProps {
  transaction: {
    id: string;
    type: string;
    amount: number;
    description: string;
    date: Date;
    status: string;
  };
  onPress: () => void;
}

const TransactionItem: React.FC<TransactionItemProps> = ({ transaction, onPress }) => {
  const { colors } = useTheme();
  
  const getTransactionIcon = () => {
    switch (transaction.type) {
      case 'add_money':
        return <ArrowDownCircle size={20} color="#4CAF50" />;
      case 'withdraw':
        return <ArrowUpCircle size={20} color="#F44336" />;
      case 'ride_payment':
        return <Wallet size={20} color="#2196F3" />;
      case 'cashback':
        return <Gift size={20} color="#FF9800" />;
      case 'refund':
        return <RefreshCw size={20} color="#4CAF50" />;
      default:
        return <Wallet size={20} color={colors.textSecondary} />;
    }
  };

  const getStatusColor = () => {
    switch (transaction.status) {
      case 'completed':
        return '#4CAF50';
      case 'pending':
        return '#FF9800';
      case 'failed':
        return '#F44336';
      default:
        return colors.textSecondary;
    }
  };

  const isCredit = transaction.amount > 0;

  return (
    <Pressable
      style={[styles.transactionItem, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
    >
      <View style={[styles.transactionIcon, { backgroundColor: colors.lightGray }]}>
        {getTransactionIcon()}
      </View>
      <View style={styles.transactionDetails}>
        <Text style={[styles.transactionDescription, { color: colors.text }]}>
          {transaction.description}
        </Text>
        <Text style={[styles.transactionDate, { color: colors.textSecondary }]}>
          {format(transaction.date, 'MMM dd, yyyy • hh:mm a')}
        </Text>
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
          </Text>
        </View>
      </View>
      <View style={styles.transactionRight}>
        <Text
          style={[
            styles.transactionAmount,
            { color: isCredit ? '#4CAF50' : colors.text },
          ]}
        >
          {isCredit ? '+' : ''}₦{Math.abs(transaction.amount).toFixed(0)}
        </Text>
        <ChevronRight size={18} color={colors.textSecondary} />
      </View>
    </Pressable>
  );
};

export default function WalletScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { balance, transactions, isLoading } = useWallet();
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'credit' | 'debit'>('all');

  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handleBalanceVisibilityToggle = () => {
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
    setBalanceVisible(!balanceVisible);
  };

  const filteredTransactions = transactions.filter((t) => {
    if (selectedFilter === 'credit') return t.amount > 0;
    if (selectedFilter === 'debit') return t.amount < 0;
    return true;
  });

  const totalCredit = transactions
    .filter((t) => t.amount > 0 && t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalDebit = transactions
    .filter((t) => t.amount < 0 && t.status === 'completed')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'My Wallet',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
        }}
      />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.balanceSection}>
            <LinearGradient
              colors={[colors.primary, colors.primary + 'DD', colors.primary + 'BB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.balanceCard}
            >
              <View style={styles.balanceHeader}>
                <View style={styles.balanceLabelContainer}>
                  <Wallet size={20} color="#FFF" />
                  <Text style={styles.balanceLabel}>Total Balance</Text>
                </View>
                <Pressable onPress={handleBalanceVisibilityToggle} style={styles.eyeButton}>
                  {balanceVisible ? <Eye size={20} color="#FFF" /> : <EyeOff size={20} color="#FFF" />}
                </Pressable>
              </View>

              <Animated.View style={[styles.balanceAmountContainer, { transform: [{ scale: scaleAnim }] }]}>
                <Text style={styles.currencySymbol}>₦</Text>
                <Text style={styles.balanceAmount}>
                  {balanceVisible ? balance.toFixed(0) : '••••••'}
                </Text>
              </Animated.View>

              <View style={styles.balanceActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => router.push('/wallet-add-money' as any)}
                >
                  <View style={[styles.actionIcon, { backgroundColor: '#4CAF50' }]}>
                    <Plus size={18} color="#FFF" />
                  </View>
                  <Text style={styles.actionText}>Add Money</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => router.push('/wallet-withdraw' as any)}
                >
                  <View style={[styles.actionIcon, { backgroundColor: '#2196F3' }]}>
                    <ArrowUpCircle size={18} color="#FFF" />
                  </View>
                  <Text style={styles.actionText}>Withdraw</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.statsSection}>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.statIconContainer, { backgroundColor: '#4CAF50' + '20' }]}>
                <TrendingUp size={20} color="#4CAF50" />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>₦{totalCredit.toFixed(0)}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Credit</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.statIconContainer, { backgroundColor: '#F44336' + '20' }]}>
                <ArrowUpCircle size={20} color="#F44336" />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>₦{totalDebit.toFixed(0)}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Debit</Text>
            </View>
          </View>

          <View style={styles.transactionsSection}>
            <View style={styles.transactionsHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Transactions</Text>
            </View>

            <View style={styles.filterButtons}>
              <TouchableOpacity
                style={[
                  styles.filterButton,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  selectedFilter === 'all' && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setSelectedFilter('all')}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    { color: colors.text },
                    selectedFilter === 'all' && { color: '#FFF' },
                  ]}
                >
                  All
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterButton,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  selectedFilter === 'credit' && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setSelectedFilter('credit')}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    { color: colors.text },
                    selectedFilter === 'credit' && { color: '#FFF' },
                  ]}
                >
                  Credit
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterButton,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  selectedFilter === 'debit' && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setSelectedFilter('debit')}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    { color: colors.text },
                    selectedFilter === 'debit' && { color: '#FFF' },
                  ]}
                >
                  Debit
                </Text>
              </TouchableOpacity>
            </View>

            {isLoading ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Loading transactions...</Text>
            ) : filteredTransactions.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No transactions yet</Text>
            ) : (
              filteredTransactions.map((transaction) => (
                <TransactionItem
                  key={transaction.id}
                  transaction={transaction}
                  onPress={() => router.push({ pathname: '/wallet-transaction-details' as any, params: { id: transaction.id } })}
                />
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  balanceSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#FFF',
    opacity: 0.9,
    fontWeight: '500',
  },
  eyeButton: {
    padding: 4,
  },
  balanceAmountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 24,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginRight: 4,
  },
  balanceAmount: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFF',
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
    backgroundColor: '#FFF',
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
    color: '#000',
  },
  statsSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    fontSize: 12,
    textAlign: 'center',
  },
  transactionsSection: {
    paddingHorizontal: 20,
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
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
  transactionDate: {
    fontSize: 12,
    marginBottom: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  transactionRight: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    marginTop: 32,
  },
});
