import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Calendar, Star, ChevronRight } from 'lucide-react-native';
import { useRide } from '@/hooks/useRideStore';
import { useTheme } from '@/hooks/useThemeStore';
import { RideRequest } from '@/types';

export default function MyRidesScreen() {

  const { colors } = useTheme();
  const { pastRides } = useRide();
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'completed' | 'cancelled'>('all');

  const filteredRides = pastRides.filter(ride => {
    if (selectedFilter === 'all') return true;
    return ride.status === selectedFilter;
  });

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return colors.success;
      case 'cancelled':
        return colors.danger;
      case 'in_progress':
        return colors.warning;
      default:
        return colors.gray;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      case 'in_progress':
        return 'In Progress';
      case 'confirmed':
        return 'Confirmed';
      default:
        return 'Pending';
    }
  };

  const RideCard = ({ ride }: { ride: RideRequest }) => (
    <Pressable
      style={[styles.rideCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => {
        // Navigate to ride details if needed
        console.log('Navigate to ride details:', ride.id);
      }}
    >
      <View style={styles.rideHeader}>
        <View style={styles.rideInfo}>
          <Text style={[styles.rideDate, { color: colors.text }]}>
            {ride.createdAt && formatDate(ride.createdAt)}
          </Text>
          <Text style={[styles.rideTime, { color: colors.gray }]}>
            {ride.createdAt && formatTime(ride.createdAt)}
          </Text>
        </View>
        <View style={styles.rideStatus}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(ride.status || 'pending') }]} />
          <Text style={[styles.statusText, { color: getStatusColor(ride.status || 'pending') }]}>
            {getStatusText(ride.status || 'pending')}
          </Text>
        </View>
      </View>

      <View style={styles.rideRoute}>
        <View style={styles.routePoint}>
          <View style={[styles.routeDot, { backgroundColor: colors.success }]} />
          <Text style={[styles.routeText, { color: colors.text }]} numberOfLines={1}>
            {ride.pickupAddress || 'Pickup location'}
          </Text>
        </View>
        <View style={styles.routeLine} />
        <View style={styles.routePoint}>
          <View style={[styles.routeDot, { backgroundColor: colors.danger }]} />
          <Text style={[styles.routeText, { color: colors.text }]} numberOfLines={1}>
            {ride.dropoffAddress || 'Dropoff location'}
          </Text>
        </View>
      </View>

      <View style={styles.rideFooter}>
        <View style={styles.rideDetails}>
          {ride.distance && (
            <Text style={[styles.rideDetail, { color: colors.gray }]}>
              {ride.distance.toFixed(1)} km
            </Text>
          )}
          {ride.duration && (
            <Text style={[styles.rideDetail, { color: colors.gray }]}>
              • {ride.duration} min
            </Text>
          )}
          {ride.rideType && (
            <Text style={[styles.rideDetail, { color: colors.gray }]}>
              • {ride.rideType}
            </Text>
          )}
        </View>
        <View style={styles.ridePriceContainer}>
          {ride.price && (
            <Text style={[styles.ridePrice, { color: colors.text }]}>
              ₦{ride.price.toFixed(2)}
            </Text>
          )}
          <ChevronRight size={16} color={colors.gray} />
        </View>
      </View>

      {ride.driver && ride.status === 'completed' && (
        <View style={styles.driverInfo}>
          <Text style={[styles.driverName, { color: colors.text }]}>
            Driver: {ride.driver.name}
          </Text>
          <View style={styles.ratingContainer}>
            <Star size={14} color={colors.warning} fill={colors.warning} />
            <Text style={[styles.rating, { color: colors.text }]}>
              {ride.driver.rating.toFixed(1)}
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'My Rides',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />

      <View style={styles.filterContainer}>
        {(['all', 'completed', 'cancelled'] as const).map((filter) => (
          <Pressable
            key={filter}
            style={[
              styles.filterButton,
              {
                backgroundColor: selectedFilter === filter ? colors.primary : colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={() => setSelectedFilter(filter)}
          >
            <Text
              style={[
                styles.filterText,
                {
                  color: selectedFilter === filter ? colors.white : colors.text,
                },
              ]}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.content}>
        {filteredRides.length === 0 ? (
          <View style={styles.emptyState}>
            <Calendar size={48} color={colors.gray} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No rides found</Text>
            <Text style={[styles.emptySubtitle, { color: colors.gray }]}>
              {selectedFilter === 'all'
                ? "You haven't taken any rides yet"
                : `No ${selectedFilter} rides found`}
            </Text>
          </View>
        ) : (
          <View style={styles.ridesContainer}>
            {filteredRides.map((ride) => (
              <RideCard key={ride.id} ride={ride} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  ridesContainer: {
    padding: 16,
  },
  rideCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rideInfo: {
    flex: 1,
  },
  rideDate: {
    fontSize: 16,
    fontWeight: '600',
  },
  rideTime: {
    fontSize: 14,
    marginTop: 2,
  },
  rideStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  rideRoute: {
    marginBottom: 12,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  routeLine: {
    width: 1,
    height: 16,
    backgroundColor: '#E5E5E5',
    marginLeft: 4,
    marginVertical: 2,
  },
  routeText: {
    fontSize: 14,
    flex: 1,
  },
  rideFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rideDetails: {
    flexDirection: 'row',
    flex: 1,
  },
  rideDetail: {
    fontSize: 12,
  },
  ridePriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ridePrice: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 4,
  },
  driverInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  driverName: {
    fontSize: 14,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 14,
    marginLeft: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
});