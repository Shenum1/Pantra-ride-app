import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Receipt } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';

interface AdminRide {
  id: string;
  userName: string;
  driverName: string | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  rideType: string;
  status: string;
  fare: number | null;
  baseFare: number | null;
  minFare: number | null;
  maxFare: number | null;
  bookingFee: number | null;
  serviceFee: number | null;
  zoneFee: number | null;
  fareAdjustmentPercent: number | null;
  createdAt: string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return '#10b981';
    case 'cancelled': return '#ef4444';
    case 'in-progress': return '#f59e0b';
    case 'accepted': return '#3b82f6';
    default: return '#6b7280';
  }
};

const RideCard: React.FC<{ ride: AdminRide }> = ({ ride }) => {
  const fare = ride.fare ?? 0;
  const bookingFee = ride.bookingFee ?? 0;
  const serviceFee = ride.serviceFee ?? 0;
  const zoneFee = ride.zoneFee ?? 0;
  const meteredFare = fare - bookingFee - serviceFee - zoneFee;
  const adjustmentPercent = ride.fareAdjustmentPercent ?? 0;

  return (
    <View style={styles.rideCard}>
      <View style={styles.rideHeader}>
        <Text style={styles.rideRoute} numberOfLines={1}>
          {ride.pickupAddress || 'Pickup'} → {ride.dropoffAddress || 'Dropoff'}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ride.status) }]}>
          <Text style={styles.statusText}>{ride.status}</Text>
        </View>
      </View>

      <Text style={styles.ridePeople}>
        Rider: {ride.userName} {ride.driverName ? `• Driver: ${ride.driverName}` : ''}
      </Text>

      <View style={styles.breakdown}>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Metered fare</Text>
          <Text style={styles.breakdownValue}>₦{meteredFare.toFixed(0)}</Text>
        </View>
        {adjustmentPercent !== 0 && (
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Rider adjustment</Text>
            <Text style={styles.breakdownValue}>{adjustmentPercent > 0 ? '+' : ''}{adjustmentPercent}%</Text>
          </View>
        )}
        {bookingFee > 0 && (
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Booking fee</Text>
            <Text style={styles.breakdownValue}>₦{bookingFee.toFixed(0)}</Text>
          </View>
        )}
        {serviceFee > 0 && (
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Service fee</Text>
            <Text style={styles.breakdownValue}>₦{serviceFee.toFixed(0)}</Text>
          </View>
        )}
        {zoneFee > 0 && (
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Zone fee</Text>
            <Text style={styles.breakdownValue}>₦{zoneFee.toFixed(0)}</Text>
          </View>
        )}
        <View style={[styles.breakdownRow, styles.breakdownTotalRow]}>
          <Text style={styles.breakdownTotalLabel}>Total charged</Text>
          <Text style={styles.breakdownTotalValue}>₦{fare.toFixed(0)}</Text>
        </View>
      </View>
    </View>
  );
};

export default function AdminRidesScreen() {
  const insets = useSafeAreaInsets();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const ridesQuery = trpc.admin.rides.useQuery({ status: statusFilter, limit: 50, offset: 0 });
  const rides: AdminRide[] = (ridesQuery.data?.rides as AdminRide[]) ?? [];
  const total = ridesQuery.data?.total ?? 0;

  const filters: { key: string | undefined; label: string }[] = [
    { key: undefined, label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'in-progress', label: 'In progress' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#667eea', '#764ba2']} style={[styles.header, { paddingTop: insets.top + 32 }]}>
        <Text style={styles.headerTitle}>Rides</Text>
        <Text style={styles.headerSubtitle}>Full fare breakdown, admin-only</Text>
      </LinearGradient>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.label}
            style={[styles.filterChip, statusFilter === filter.key && styles.filterChipActive]}
            onPress={() => setStatusFilter(filter.key)}
          >
            <Text style={[styles.filterChipText, statusFilter === filter.key && styles.filterChipTextActive]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Receipt size={18} color="#667eea" />
            <Text style={styles.statValue}>{total.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Rides matching filter</Text>
          </View>
        </View>

        {ridesQuery.isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color="#667eea" />
          </View>
        ) : ridesQuery.error ? (
          <View style={styles.centerState}>
            <Text style={styles.errorText}>
              {ridesQuery.error.message.includes('not configured')
                ? 'Admin data is not configured on the server yet.'
                : 'Failed to load rides.'}
            </Text>
          </View>
        ) : rides.length === 0 ? (
          <View style={styles.centerState}>
            <Text style={styles.statLabel}>No rides found</Text>
          </View>
        ) : (
          <View style={styles.ridesList}>
            {rides.map((ride) => (
              <RideCard key={ride.id} ride={ride} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  filtersContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterChipActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  filterChipText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: 'white',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  statItem: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 6,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  centerState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
  },
  ridesList: {
    paddingBottom: 24,
  },
  rideCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  rideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  rideRoute: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
    textTransform: 'uppercase',
  },
  ridePeople: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 12,
  },
  breakdown: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  breakdownValue: {
    fontSize: 12,
    color: '#1f2937',
  },
  breakdownTotalRow: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  breakdownTotalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  breakdownTotalValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
  },
});
