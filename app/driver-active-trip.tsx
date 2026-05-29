import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ArrowLeft,
  CheckCircle,
  MapPin,
  MessageCircle,
  Navigation2,
  Phone,
  Star,
  User,
} from 'lucide-react-native';
import { router, Stack } from 'expo-router';
import * as ExpoLocation from 'expo-location';

import Map from '@/components/Map';
import Colors from '@/constants/colors';
import { useDriverStore } from '@/hooks/useDriverStore';
import { useDriverAuth } from '@/hooks/useDriverAuthStore';
import { MessagingService } from '@/lib/messaging-service';
import { GoogleMapsService } from '@/lib/google-maps-service';
import { Location } from '@/types';

type DriverTripStatus = 'heading_to_pickup' | 'at_pickup' | 'in_progress';

export default function DriverActiveTrip() {
  const { currentRide, updateRideStatus, updateLocation } = useDriverStore();
  const { driver } = useDriverAuth();
  const [driverLocation, setDriverLocation] = useState<Location | null>(null);
  const [tripStatus, setTripStatus] = useState<DriverTripStatus>('heading_to_pickup');
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);

  useEffect(() => {
    if (!currentRide) {
      router.back();
      return;
    }

    let active = true;
    let subscription: ExpoLocation.LocationSubscription | null = null;

    const startLocationTracking = async () => {
      if (Platform.OS === 'web') {
        const fallbackLocation = {
          latitude: currentRide.pickupLocation.latitude - 0.018,
          longitude: currentRide.pickupLocation.longitude - 0.012,
        };
        setDriverLocation(fallbackLocation);
        return;
      }

      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is required to track the trip.');
        return;
      }

      const location = await ExpoLocation.getCurrentPositionAsync({});
      const currentLoc: Location = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      if (!active) {
        return;
      }

      console.log('Driver live location initialized:', currentLoc);
      setDriverLocation(currentLoc);
      void updateLocation(location.coords.latitude, location.coords.longitude);

      subscription = await ExpoLocation.watchPositionAsync(
        {
          accuracy: ExpoLocation.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        (nextLocation) => {
          const nextDriverLocation: Location = {
            latitude: nextLocation.coords.latitude,
            longitude: nextLocation.coords.longitude,
          };
          console.log('Driver live location updated:', nextDriverLocation);
          setDriverLocation(nextDriverLocation);
          void updateLocation(nextLocation.coords.latitude, nextLocation.coords.longitude);
        }
      );
    };

    void startLocationTracking();

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [currentRide, updateLocation]);

  useEffect(() => {
    if (!currentRide) {
      return;
    }

    if (currentRide.status === 'in_progress') {
      setTripStatus('in_progress');
      return;
    }

    if (tripStatus === 'in_progress') {
      return;
    }

    setTripStatus('heading_to_pickup');
  }, [currentRide, tripStatus]);

  const mapDestination = useMemo(() => {
    if (!currentRide) {
      return null;
    }

    return tripStatus === 'in_progress' ? currentRide.dropoffLocation : currentRide.pickupLocation;
  }, [currentRide, tripStatus]);

  const mapRegion = useMemo<Location | undefined>(() => {
    const focusPoint = driverLocation ?? mapDestination ?? undefined;

    if (!focusPoint) {
      return undefined;
    }

    return {
      latitude: focusPoint.latitude,
      longitude: focusPoint.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }, [driverLocation, mapDestination]);

  const customMarkers = useMemo(() => {
    if (!currentRide) {
      return [] as Array<{ id: string; location: Location; title: string; description?: string; type: 'driver' | 'pickup' | 'dropoff' }>;
    }

    const markers: Array<{ id: string; location: Location; title: string; description?: string; type: 'driver' | 'pickup' | 'dropoff' }> = [];

    if (driverLocation) {
      markers.push({
        id: 'driver',
        location: driverLocation,
        title: 'Your vehicle',
        description: tripStatus === 'in_progress' ? 'Heading to destination' : 'Heading to rider pickup',
        type: 'driver',
      });
    }

    markers.push({
      id: 'pickup',
      location: currentRide.pickupLocation,
      title: tripStatus === 'in_progress' ? 'Pickup completed' : 'Rider live position',
      description: currentRide.pickupAddress || 'Pickup location',
      type: 'pickup',
    });

    markers.push({
      id: 'dropoff',
      location: currentRide.dropoffLocation,
      title: 'Destination',
      description: currentRide.dropoffAddress || 'Dropoff location',
      type: 'dropoff',
    });

    return markers;
  }, [currentRide, driverLocation, tripStatus]);

  if (!currentRide || !mapRegion || !mapDestination) {
    return null;
  }

  const handleCall = async () => {
    const phoneNumber = currentRide.passenger?.phone;
    if (!phoneNumber) {
      Alert.alert('Error', 'Phone number not available');
      return;
    }

    const phoneUrl = Platform.select({
      ios: `telprompt:${phoneNumber}`,
      android: `tel:${phoneNumber}`,
      default: `tel:${phoneNumber}`,
    });

    try {
      const supported = await Linking.canOpenURL(phoneUrl);
      if (!supported) {
        Alert.alert('Error', 'Phone calls are not supported on this device');
        return;
      }

      await Linking.openURL(phoneUrl);
    } catch (error) {
      console.error('Error making call:', error);
      Alert.alert('Error', 'Failed to make call');
    }
  };

  const handleMessage = async () => {
    if (!driver || !currentRide.passenger) {
      Alert.alert('Error', 'Passenger information not available');
      return;
    }

    try {
      const conversationId = await MessagingService.createConversation({
        userId: currentRide.passenger.id,
        userName: currentRide.passenger.name,
        userPhone: currentRide.passenger.phone || '',
        driverId: driver.id,
        driverName: driver.name,
        driverPhone: driver.phone,
        rideId: currentRide.id,
      });

      router.push({
        pathname: '/driver-message',
        params: {
          conversationId,
          passengerName: currentRide.passenger.name,
          passengerPhone: currentRide.passenger.phone || '',
        },
      });
    } catch (error) {
      console.error('Error creating conversation:', error);
      Alert.alert('Error', 'Failed to open message');
    }
  };

  const handleNavigate = async () => {
    if (!driverLocation) {
      Alert.alert('Navigation unavailable', 'Current driver location is still loading.');
      return;
    }

    const googleMapsUrl = GoogleMapsService.getExternalDirectionsUrl(driverLocation, mapDestination);
    const appleMapsUrl = `http://maps.apple.com/?daddr=${mapDestination.latitude},${mapDestination.longitude}&dirflg=d`;

    try {
      const canOpenGoogleMaps = await Linking.canOpenURL(googleMapsUrl);
      if (canOpenGoogleMaps) {
        await Linking.openURL(googleMapsUrl);
        return;
      }

      const canOpenApple = await Linking.canOpenURL(appleMapsUrl);
      if (canOpenApple && Platform.OS === 'ios') {
        await Linking.openURL(appleMapsUrl);
        return;
      }

      await Linking.openURL(googleMapsUrl);
    } catch (error) {
      console.error('Error opening navigation:', error);
      Alert.alert('Error', 'Failed to open navigation');
    }
  };

  const handleArrivedAtPickup = () => {
    setTripStatus('at_pickup');
    Alert.alert('Arrived at Pickup', 'You can now wait for the rider or start the trip when ready.');
  };

  const handleStartTrip = async () => {
    try {
      await updateRideStatus('in_progress');
      setTripStatus('in_progress');
      Alert.alert('Trip Started', 'Live direction is now focused on the destination.');
    } catch (error) {
      console.error('Error starting trip:', error);
      Alert.alert('Error', 'Failed to start trip');
    }
  };

  const handleCompleteTrip = async () => {
    Alert.alert('Complete Trip', 'Are you sure you want to complete this trip?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        onPress: async () => {
          try {
            await updateRideStatus('completed');
            router.replace('/(driver-tabs)/trips');
          } catch (error) {
            console.error('Error completing trip:', error);
            Alert.alert('Error', 'Failed to complete trip');
          }
        },
      },
    ]);
  };

  const tripTitle = tripStatus === 'heading_to_pickup'
    ? 'Heading to pickup'
    : tripStatus === 'at_pickup'
      ? 'At pickup'
      : 'Trip in progress';

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: tripTitle,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={styles.backButton} testID="driver-trip-back-button">
              <ArrowLeft size={22} color={Colors.light.text} />
            </Pressable>
          ),
        }}
      />

      <View style={styles.mapContainer}>
        <Map
          fullScreen={true}
          initialRegion={mapRegion}
          showRoute={true}
          routeStartLocation={driverLocation}
          routeEndLocation={mapDestination}
          customMarkers={customMarkers}
          showDrivers={false}
          onRouteInfoChange={setRouteInfo}
        />
      </View>

      <View style={styles.infoCard}>
        <View style={styles.passengerSection}>
          <View style={styles.passengerAvatar}>
            <User size={24} color={Colors.light.primary} />
          </View>
          <View style={styles.passengerInfo}>
            <Text style={styles.passengerName}>{currentRide.passenger?.name || 'Passenger'}</Text>
            <View style={styles.ratingContainer}>
              <Star size={14} color="#FFD700" fill="#FFD700" />
              <Text style={styles.rating}>{currentRide.passenger?.rating?.toFixed(1) || '5.0'}</Text>
            </View>
          </View>
          <View style={styles.contactButtons}>
            <Pressable style={styles.iconButton} onPress={handleCall} testID="driver-call-passenger-button">
              <Phone size={18} color={Colors.light.primary} />
            </Pressable>
            <Pressable style={styles.iconButton} onPress={handleMessage} testID="driver-message-passenger-button">
              <MessageCircle size={18} color={Colors.light.primary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.routeSection}>
          <View style={styles.locationRow}>
            <View style={[styles.locationDot, styles.pickupDot]} />
            <Text style={styles.locationText} numberOfLines={1}>
              {currentRide.pickupAddress || 'Pickup location'}
            </Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.locationRow}>
            <View style={[styles.locationDot, styles.dropoffDot]} />
            <Text style={styles.locationText} numberOfLines={1}>
              {currentRide.dropoffAddress || 'Dropoff location'}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>{tripStatus === 'in_progress' ? 'To destination' : 'To rider'}</Text>
            <Text style={styles.statValue}>{routeInfo ? `${(routeInfo.distance / 1000).toFixed(1)} km` : '--'}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>ETA</Text>
            <Text style={styles.statValue}>{routeInfo ? `${Math.round(routeInfo.duration / 60)} min` : '--'}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Fare</Text>
            <Text style={styles.statValue}>₦{(currentRide.price || 0).toFixed(0)}</Text>
          </View>
        </View>

        <View style={styles.liveStatusCard}>
          <MapPin size={16} color={Colors.light.primary} />
          <Text style={styles.liveStatusText}>
            {tripStatus === 'in_progress'
              ? 'Destination route is live on the map.'
              : tripStatus === 'at_pickup'
                ? 'You are at pickup. Rider live position remains pinned on the map.'
                : 'Rider live position is pinned on the map while you approach pickup.'}
          </Text>
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.navButton} onPress={handleNavigate} testID="driver-open-navigation-button">
            <Navigation2 size={18} color="#fff" />
            <Text style={styles.navButtonText}>Navigate</Text>
          </Pressable>

          {tripStatus === 'heading_to_pickup' ? (
            <Pressable style={styles.actionButton} onPress={handleArrivedAtPickup} testID="driver-arrived-button">
              <MapPin size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Arrived</Text>
            </Pressable>
          ) : tripStatus === 'at_pickup' ? (
            <Pressable style={styles.actionButton} onPress={handleStartTrip} testID="driver-start-trip-button">
              <CheckCircle size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Start Trip</Text>
            </Pressable>
          ) : (
            <Pressable style={[styles.actionButton, styles.completeButton]} onPress={handleCompleteTrip} testID="driver-complete-trip-button">
              <CheckCircle size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Complete</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  backButton: {
    padding: 8,
  },
  mapContainer: {
    flex: 1,
  },
  infoCard: {
    backgroundColor: Colors.light.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  passengerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  passengerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.light.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passengerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  rating: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeSection: {
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    padding: 14,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  pickupDot: {
    backgroundColor: '#0EA5E9',
  },
  dropoffDot: {
    backgroundColor: '#F97316',
  },
  routeLine: {
    width: 2,
    height: 18,
    marginLeft: 4,
    marginVertical: 6,
    backgroundColor: '#CBD5E1',
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '600',
  },
  statsRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: '#0F172A',
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  statValue: {
    marginTop: 6,
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(148,163,184,0.4)',
  },
  liveStatusCard: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#ECFEFF',
  },
  liveStatusText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#155E75',
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 14,
    backgroundColor: Colors.light.primary,
  },
  navButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 14,
    backgroundColor: '#111827',
  },
  completeButton: {
    backgroundColor: '#16A34A',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
