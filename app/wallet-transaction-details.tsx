import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import {
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  Calendar,
  CreditCard,
  RefreshCw,
  Gift,
  Download,
  Share2,
} from 'lucide-react-native';
import { useTheme } from '@/hooks/useThemeStore';
import { useWallet } from '@/hooks/useWalletStore';
import { format } from 'date-fns';

export default function TransactionDetailsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { transactions } = useWallet();
  
  const transaction = transactions.find(t => t.id === id);

  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  if (!transaction) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Transaction Details',
            headerStyle: { backgroundColor: colors.card },
            headerTintColor: colors.text,
          }}
        />
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>Transaction not found</Text>
        </View>
      </>
    );
  }

  const getTransactionIcon = () => {
    switch (transaction.type) {
      case 'add_money':
        return <ArrowDownCircle size={32} color="#4CAF50" />;
      case 'withdraw':
        return <ArrowUpCircle size={32} color="#F44336" />;
      case 'ride_payment':
        return <Wallet size={32} color="#2196F3" />;
      case 'cashback':
        return <Gift size={32} color="#FF9800" />;
      case 'refund':
        return <RefreshCw size={32} color="#4CAF50" />;
      default:
        return <Wallet size={32} color={colors.textSecondary} />;
    }
  };

  const getStatusIcon = () => {
    switch (transaction.status) {
      case 'completed':
        return <CheckCircle size={20} color="#4CAF50" />;
      case 'pending':
        return <Clock size={20} color="#FF9800" />;
      case 'failed':
        return <XCircle size={20} color="#F44336" />;
      default:
        return null;
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

  const getTypeLabel = () => {
    switch (transaction.type) {
      case 'add_money':
        return 'Money Added';
      case 'withdraw':
        return 'Withdrawal';
      case 'ride_payment':
        return 'Ride Payment';
      case 'cashback':
        return 'Cashback';
      case 'refund':
        return 'Refund';
      default:
        return 'Transaction';
    }
  };

  const isCredit = transaction.amount > 0;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Transaction Details',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
        }}
      />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Animated.View
            style={[
              styles.headerCard,
              { backgroundColor: colors.card, borderColor: colors.border },
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}
          >
            <View style={[styles.iconContainer, { backgroundColor: colors.lightGray }]}>
              {getTransactionIcon()}
            </View>
            
            <Text style={[styles.typeLabel, { color: colors.textSecondary }]}>{getTypeLabel()}</Text>
            
            <Text
              style={[
                styles.amount,
                { color: isCredit ? '#4CAF50' : colors.text }
              ]}
            >
              {isCredit ? '+' : ''}${Math.abs(transaction.amount).toFixed(2)}
            </Text>
            
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20', borderColor: getStatusColor() }]}>
              {getStatusIcon()}
              <Text style={[styles.statusText, { color: getStatusColor() }]}>
                {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
              </Text>
            </View>
          </Animated.View>

          <Animated.View
            style={[
              styles.detailsCard,
              { backgroundColor: colors.card, borderColor: colors.border },
              { opacity: fadeAnim }
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Transaction Details</Text>
            
            <View style={styles.detailRow}>
              <View style={styles.detailLabel}>
                <Calendar size={18} color={colors.textSecondary} />
                <Text style={[styles.detailLabelText, { color: colors.textSecondary }]}>Date & Time</Text>
              </View>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {format(transaction.date, 'MMM dd, yyyy • hh:mm a')}
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.detailRow}>
              <View style={styles.detailLabel}>
                <Wallet size={18} color={colors.textSecondary} />
                <Text style={[styles.detailLabelText, { color: colors.textSecondary }]}>Transaction ID</Text>
              </View>
              <Text style={[styles.detailValue, { color: colors.text }]}>{transaction.id}</Text>
            </View>

            {transaction.rideId && (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.detailRow}>
                  <View style={styles.detailLabel}>
                    <CreditCard size={18} color={colors.textSecondary} />
                    <Text style={[styles.detailLabelText, { color: colors.textSecondary }]}>Ride ID</Text>
                  </View>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{transaction.rideId}</Text>
                </View>
              </>
            )}

            {transaction.metadata?.fromLocation && (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.detailRow}>
                  <View style={styles.detailLabel}>
                    <MapPin size={18} color={colors.textSecondary} />
                    <Text style={[styles.detailLabelText, { color: colors.textSecondary }]}>From</Text>
                  </View>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {transaction.metadata.fromLocation}
                  </Text>
                </View>
              </>
            )}

            {transaction.metadata?.toLocation && (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.detailRow}>
                  <View style={styles.detailLabel}>
                    <MapPin size={18} color={colors.textSecondary} />
                    <Text style={[styles.detailLabelText, { color: colors.textSecondary }]}>To</Text>
                  </View>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {transaction.metadata.toLocation}
                  </Text>
                </View>
              </>
            )}
          </Animated.View>

          {transaction.metadata?.rideFare && (
            <Animated.View
              style={[
                styles.fareCard,
                { backgroundColor: colors.card, borderColor: colors.border },
                { opacity: fadeAnim }
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Payment Breakdown</Text>
              
              <View style={styles.fareRow}>
                <Text style={[styles.fareLabel, { color: colors.textSecondary }]}>Ride Fare</Text>
                <Text style={[styles.fareValue, { color: colors.text }]}>
                  ${transaction.metadata.rideFare.toFixed(2)}
                </Text>
              </View>

              {transaction.metadata.discountApplied && (
                <View style={styles.fareRow}>
                  <Text style={[styles.fareLabel, { color: colors.textSecondary }]}>Discount</Text>
                  <Text style={[styles.fareValue, { color: '#4CAF50' }]}>
                    -${transaction.metadata.discountApplied.toFixed(2)}
                  </Text>
                </View>
              )}

              {transaction.metadata.promoCode && (
                <View style={styles.fareRow}>
                  <Text style={[styles.fareLabel, { color: colors.textSecondary }]}>Promo Code</Text>
                  <Text style={[styles.fareValue, { color: colors.primary }]}>
                    {transaction.metadata.promoCode}
                  </Text>
                </View>
              )}

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.fareRow}>
                <Text style={[styles.totalLabel, { color: colors.text }]}>Total Paid</Text>
                <Text style={[styles.totalValue, { color: colors.text }]}>
                  ${Math.abs(transaction.amount).toFixed(2)}
                </Text>
              </View>
            </Animated.View>
          )}

          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Download size={20} color={colors.text} />
              <Text style={[styles.actionButtonText, { color: colors.text }]}>Download Receipt</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Share2 size={20} color={colors.text} />
              <Text style={[styles.actionButtonText, { color: colors.text }]}>Share</Text>
            </TouchableOpacity>
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
    padding: 20,
    paddingBottom: 40,
  },
  headerCard: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  typeLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  amount: {
    fontSize: 40,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailsCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  detailLabelText: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  fareCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fareLabel: {
    fontSize: 14,
  },
  fareValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    textAlign: 'center',
    fontSize: 16,
    marginTop: 32,
  },
});
