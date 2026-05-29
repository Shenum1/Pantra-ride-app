import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import {
  MapPin,
  Clock,
  DollarSign,
  Star,
  Calendar,
  ArrowLeft,
  Filter,
  Navigation,
} from 'lucide-react-native';
import { router } from 'expo-router';
import Colors from '@/constants/colors';

interface Trip {
  id: string;
  passengerName: string;
  pickup: string;
  destination: string;
  date: string;
  time: string;
  duration: string;
  distance: string;
  fare: number;
  tip: number;
  rating: number;
  status: 'completed' | 'cancelled';
}

export default function TripHistory() {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  const trips: Trip[] = [
    {
      id: '1',
      passengerName: 'Sarah Johnson',
      pickup: '123 Main St',
      destination: 'Downtown Mall',
      date: 'Dec 11, 2024',
      time: '2:30 PM',
      duration: '15 min',
      distance: '2.3 mi',
      fare: 12.50,
      tip: 3.00,
      rating: 5.0,
      status: 'completed',
    },
    {
      id: '2',
      passengerName: 'Mike Chen',
      pickup: 'Airport Terminal',
      destination: 'Hotel District',
      date: 'Dec 11, 2024',
      time: '1:45 PM',
      duration: '25 min',
      distance: '5.1 mi',
      fare: 28.75,
      tip: 5.00,
      rating: 4.8,
      status: 'completed',
    },
    {
      id: '3',
      passengerName: 'Emma Davis',
      pickup: 'University Campus',
      destination: 'Shopping Center',
      date: 'Dec 11, 2024',
      time: '12:15 PM',
      duration: '18 min',
      distance: '3.7 mi',
      fare: 18.25,
      tip: 2.50,
      rating: 4.9,
      status: 'completed',
    },
    {
      id: '4',
      passengerName: 'John Smith',
      pickup: 'City Center',
      destination: 'Residential Area',
      date: 'Dec 10, 2024',
      time: '6:20 PM',
      duration: '12 min',
      distance: '1.8 mi',
      fare: 9.75,
      tip: 0.00,
      rating: 0,
      status: 'cancelled',
    },
    {
      id: '5',
      passengerName: 'Lisa Wong',
      pickup: 'Business District',
      destination: 'Train Station',
      date: 'Dec 10, 2024',
      time: '4:30 PM',
      duration: '22 min',
      distance: '4.2 mi',
      fare: 22.00,
      tip: 4.00,
      rating: 5.0,
      status: 'completed',
    },
  ];

  const filterTrips = (trips: Trip[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    return trips.filter(trip => {
      const tripDate = new Date(trip.date);
      switch (selectedFilter) {
        case 'today':
          return tripDate >= today;
        case 'week':
          return tripDate >= weekAgo;
        case 'month':
          return tripDate >= monthAgo;
        default:
          return true;
      }
    });
  };

  const filteredTrips = filterTrips(trips);
  const completedTrips = filteredTrips.filter(t => t.status === 'completed');
  const totalEarnings = completedTrips.reduce((sum, trip) => sum + trip.fare + trip.tip, 0);
  const totalDistance = completedTrips.reduce((sum, trip) => sum + parseFloat(trip.distance), 0);

  const FilterButton = ({ filter, label }: { filter: typeof selectedFilter; label: string }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        selectedFilter === filter && styles.activeFilterButton
      ]}
      onPress={() => setSelectedFilter(filter)}
    >
      <Text style={[
        styles.filterButtonText,
        selectedFilter === filter && styles.activeFilterButtonText
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const TripCard = ({ trip }: { trip: Trip }) => (
    <View style={[
      styles.tripCard,
      trip.status === 'cancelled' && styles.cancelledCard
    ]}>
      <View style={styles.tripHeader}>
        <View style={styles.passengerInfo}>
          <Text style={styles.passengerName}>{trip.passengerName}</Text>
          <Text style={styles.tripDateTime}>{trip.date} • {trip.time}</Text>
        </View>
        <View style={styles.tripStatus}>
          {trip.status === 'completed' ? (
            <View style={styles.ratingContainer}>
              <Star size={14} color="#FFD700" fill="#FFD700" />
              <Text style={styles.rating}>{trip.rating.toFixed(1)}</Text>
            </View>
          ) : (
            <Text style={styles.cancelledText}>Cancelled</Text>
          )}
        </View>
      </View>

      <View style={styles.routeInfo}>
        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: '#4CAF50' }]} />
          <Text style={styles.locationText} numberOfLines={1}>{trip.pickup}</Text>
        </View>
        <View style={styles.routeLine} />
        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: '#FF5722' }]} />
          <Text style={styles.locationText} numberOfLines={1}>{trip.destination}</Text>
        </View>
      </View>

      <View style={styles.tripDetails}>
        <View style={styles.detailItem}>
          <Navigation size={14} color={Colors.light.textSecondary} />
          <Text style={styles.detailText}>{trip.distance}</Text>
        </View>
        <View style={styles.detailItem}>
          <Clock size={14} color={Colors.light.textSecondary} />
          <Text style={styles.detailText}>{trip.duration}</Text>
        </View>
        <View style={styles.earningsContainer}>
          <Text style={styles.fareText}>${trip.fare.toFixed(2)}</Text>
          {trip.tip > 0 && (
            <Text style={styles.tipText}>+${trip.tip.toFixed(2)} tip</Text>
          )}
        </View>
      </View>
    </View>
  );

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
        <Text style={styles.headerTitle}>Trip History</Text>
        <TouchableOpacity style={styles.filterIcon}>
          <Filter size={24} color={Colors.light.primary} />
        </TouchableOpacity>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <FilterButton filter="all" label="All Time" />
          <FilterButton filter="today" label="Today" />
          <FilterButton filter="week" label="This Week" />
          <FilterButton filter="month" label="This Month" />
        </ScrollView>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <View style={styles.statIcon}>
            <MapPin size={20} color={Colors.light.primary} />
          </View>
          <Text style={styles.statValue}>{completedTrips.length}</Text>
          <Text style={styles.statLabel}>Trips</Text>
        </View>
        <View style={styles.statItem}>
          <View style={styles.statIcon}>
            <DollarSign size={20} color={Colors.light.success} />
          </View>
          <Text style={styles.statValue}>${totalEarnings.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Earned</Text>
        </View>
        <View style={styles.statItem}>
          <View style={styles.statIcon}>
            <Navigation size={20} color={Colors.light.primary} />
          </View>
          <Text style={styles.statValue}>{totalDistance.toFixed(1)} mi</Text>
          <Text style={styles.statLabel}>Distance</Text>
        </View>
      </View>

      {/* Trips List */}
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {filteredTrips.length > 0 ? (
          filteredTrips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Calendar size={48} color={Colors.light.lightGray} />
            <Text style={styles.emptyStateText}>No trips found</Text>
            <Text style={styles.emptyStateSubtext}>
              Try adjusting your filter or check back later
            </Text>
          </View>
        )}
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
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  filterIcon: {
    padding: 8,
  },
  filterContainer: {
    backgroundColor: Colors.light.white,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.light.lightGray,
    marginRight: 8,
  },
  activeFilterButton: {
    backgroundColor: Colors.light.primary,
  },
  filterButtonText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  activeFilterButtonText: {
    color: Colors.light.white,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.light.white,
    paddingVertical: 20,
    marginBottom: 10,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  tripCard: {
    backgroundColor: Colors.light.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cancelledCard: {
    opacity: 0.7,
    borderLeftWidth: 4,
    borderLeftColor: Colors.light.danger,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  passengerInfo: {
    flex: 1,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  tripDateTime: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  tripStatus: {
    alignItems: 'flex-end',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginLeft: 4,
    fontWeight: '600',
  },
  cancelledText: {
    fontSize: 12,
    color: Colors.light.danger,
    fontWeight: '600',
  },
  routeInfo: {
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  locationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: Colors.light.lightGray,
    marginLeft: 3,
    marginBottom: 6,
  },
  locationText: {
    fontSize: 14,
    color: Colors.light.text,
    flex: 1,
  },
  tripDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginLeft: 4,
  },
  earningsContainer: {
    alignItems: 'flex-end',
  },
  fareText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.light.success,
  },
  tipText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
});