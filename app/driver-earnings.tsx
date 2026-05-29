import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  Calendar,
  Clock,
  Star,
  Download,
} from 'lucide-react-native';
import { useDriverStore } from '@/hooks/useDriverStore';
import Colors from '@/constants/colors';
import { router } from 'expo-router';

export default function DriverEarnings() {
  const { driverProfile, earnings, stats, isLoading } = useDriverStore();

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return Colors.light.success;
      case 'processing':
        return Colors.light.primary;
      case 'pending':
        return Colors.light.gray;
      default:
        return Colors.light.gray;
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading earnings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!driverProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Driver profile not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Earnings</Text>
        <TouchableOpacity style={styles.downloadButton}>
          <Download size={20} color={Colors.light.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Earnings Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.totalEarnings}>
            <Text style={styles.totalLabel}>Total Earnings</Text>
            <Text style={styles.totalAmount}>${driverProfile.earnings.total.toFixed(2)}</Text>
          </View>

          <View style={styles.earningsGrid}>
            <View style={styles.earningsItem}>
              <View style={styles.earningsIcon}>
                <DollarSign size={20} color={Colors.light.success} />
              </View>
              <Text style={styles.earningsValue}>${driverProfile.earnings.today.toFixed(2)}</Text>
              <Text style={styles.earningsLabel}>Today</Text>
            </View>
            <View style={styles.earningsItem}>
              <View style={styles.earningsIcon}>
                <Calendar size={20} color={Colors.light.primary} />
              </View>
              <Text style={styles.earningsValue}>${driverProfile.earnings.thisWeek.toFixed(2)}</Text>
              <Text style={styles.earningsLabel}>This Week</Text>
            </View>
            <View style={styles.earningsItem}>
              <View style={styles.earningsIcon}>
                <TrendingUp size={20} color={Colors.light.secondary} />
              </View>
              <Text style={styles.earningsValue}>${driverProfile.earnings.thisMonth.toFixed(2)}</Text>
              <Text style={styles.earningsLabel}>This Month</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsCard}>
          <Text style={styles.cardTitle}>Performance Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalRides}</Text>
              <Text style={styles.statLabel}>Total Rides</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.averageRating.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.acceptanceRate}%</Text>
              <Text style={styles.statLabel}>Acceptance</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.onlineHours}h</Text>
              <Text style={styles.statLabel}>Online Hours</Text>
            </View>
          </View>
        </View>

        {/* Recent Earnings */}
        <View style={styles.recentCard}>
          <Text style={styles.cardTitle}>Recent Earnings</Text>
          {earnings.map((earning) => (
            <View key={earning.id} style={styles.earningItem}>
              <View style={styles.earningInfo}>
                <View style={styles.earningHeader}>
                  <Text style={styles.earningAmount}>+${earning.netAmount.toFixed(2)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(earning.payoutStatus) }]}>
                    <Text style={styles.statusText}>{earning.payoutStatus}</Text>
                  </View>
                </View>
                <Text style={styles.earningDate}>{formatDate(earning.createdAt)}</Text>
                <View style={styles.earningDetails}>
                  <Text style={styles.earningDetail}>
                    Ride fare: ${earning.amount.toFixed(2)}
                  </Text>
                  <Text style={styles.earningDetail}>
                    Commission: -${earning.commission.toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Payout Information */}
        <View style={styles.payoutCard}>
          <Text style={styles.cardTitle}>Payout Information</Text>
          <View style={styles.payoutInfo}>
            <View style={styles.payoutItem}>
              <Clock size={16} color={Colors.light.gray} />
              <Text style={styles.payoutText}>
                Payouts are processed weekly on Mondays
              </Text>
            </View>
            <View style={styles.payoutItem}>
              <Star size={16} color={Colors.light.gray} />
              <Text style={styles.payoutText}>
                Maintain 4.5+ rating for instant payouts
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.light.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  downloadButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.light.gray,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: Colors.light.danger,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: Colors.light.white,
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  totalEarnings: {
    alignItems: 'center',
    marginBottom: 24,
  },
  totalLabel: {
    fontSize: 16,
    color: Colors.light.gray,
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.light.success,
  },
  earningsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  earningsItem: {
    alignItems: 'center',
    flex: 1,
  },
  earningsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  earningsValue: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  earningsLabel: {
    fontSize: 12,
    color: Colors.light.gray,
  },
  statsCard: {
    backgroundColor: Colors.light.white,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.light.gray,
  },
  recentCard: {
    backgroundColor: Colors.light.white,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  earningItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.lightGray,
  },
  earningInfo: {
    flex: 1,
  },
  earningHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  earningAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.success,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.light.white,
    textTransform: 'uppercase',
  },
  earningDate: {
    fontSize: 12,
    color: Colors.light.gray,
    marginBottom: 8,
  },
  earningDetails: {
    gap: 2,
  },
  earningDetail: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  payoutCard: {
    backgroundColor: Colors.light.white,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  payoutInfo: {
    gap: 12,
  },
  payoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  payoutText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginLeft: 8,
    flex: 1,
  },
});