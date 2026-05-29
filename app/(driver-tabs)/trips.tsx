import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  PanResponder,
  SafeAreaView,
  Platform,
  Alert,
} from 'react-native';
import {
  MapPin,
  Navigation,
  Clock,
  DollarSign,
  User,
  Phone,
  MessageCircle,
  Star,
  Gift,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import Map from '@/components/Map';
import { useLocation } from '@/hooks/useLocationStore';
import { useDriverStore } from '@/hooks/useDriverStore';
import { router } from 'expo-router';
import * as ExpoLocation from 'expo-location';

const { width, height } = Dimensions.get('window');
const PANEL_MIN_HEIGHT = 120;
const PANEL_MAX_HEIGHT = height * 0.6;

interface RideRequest {
  id: string;
  passengerName: string;
  rating: number;
  pickup: string;
  destination: string;
  distance: string;
  duration: string;
  fare: number;
  type: 'standard' | 'premium' | 'xl';
  surge?: number;
}

export default function DriverTrips() {
  const [panelHeight] = useState(new Animated.Value(PANEL_MIN_HEIGHT));
  const [showSpinWheel, setShowSpinWheel] = useState(false);
  const [spinValue] = useState(new Animated.Value(0));
  const { userLocation, setUserLocation } = useLocation();
  const { 
    rideRequests, 
    currentRide,
    isOnline, 
    acceptRideRequest, 
    declineRideRequest,
    updateLocation 
  } = useDriverStore();
  const [locationPermission, setLocationPermission] = useState(false);

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'web') return;
      
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      
      if (status === 'granted') {
        const location = await ExpoLocation.getCurrentPositionAsync({});
        const newLocation = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setUserLocation(newLocation);

        if (isOnline) {
          updateLocation(location.coords.latitude, location.coords.longitude);
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' || !locationPermission || !isOnline) return;

    const subscription = ExpoLocation.watchPositionAsync(
      {
        accuracy: ExpoLocation.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      (location) => {
        const newLocation = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setUserLocation(newLocation);
        updateLocation(location.coords.latitude, location.coords.longitude);
      }
    );

    return () => {
      subscription.then(sub => sub.remove());
    };
  }, [locationPermission, isOnline, updateLocation, setUserLocation]);

  const formatDistance = (distanceKm: number) => {
    return `${distanceKm.toFixed(1)} km`;
  };

  const formatDuration = (durationMin: number) => {
    if (durationMin < 60) {
      return `${Math.round(durationMin)} min`;
    }
    const hours = Math.floor(durationMin / 60);
    const mins = Math.round(durationMin % 60);
    return `${hours}h ${mins}m`;
  };

  const handleAcceptRide = async (rideId: string) => {
    try {
      await acceptRideRequest(rideId);
      router.push('/driver-active-trip');
    } catch (error) {
      console.error('Error accepting ride:', error);
      Alert.alert('Error', 'Failed to accept ride. Please try again.');
    }
  };

  const handleDeclineRide = async (rideId: string) => {
    try {
      await declineRideRequest(rideId);
    } catch (error) {
      console.error('Error declining ride:', error);
      Alert.alert('Error', 'Failed to decline ride. Please try again.');
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        const newHeight = PANEL_MIN_HEIGHT - gestureState.dy;
        if (newHeight >= PANEL_MIN_HEIGHT && newHeight <= PANEL_MAX_HEIGHT) {
          panelHeight.setValue(newHeight);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const velocity = gestureState.vy;
        const newHeight = PANEL_MIN_HEIGHT - gestureState.dy;
        
        if (velocity < -0.5 || newHeight > PANEL_MAX_HEIGHT * 0.5) {
          Animated.spring(panelHeight, {
            toValue: PANEL_MAX_HEIGHT,
            useNativeDriver: false,
          }).start();
        } else {
          Animated.spring(panelHeight, {
            toValue: PANEL_MIN_HEIGHT,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const spinWheel = () => {
    setShowSpinWheel(true);
    Animated.timing(spinValue, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        setShowSpinWheel(false);
        spinValue.setValue(0);
      }, 1000);
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'premium':
        return '#FF9800';
      case 'xl':
        return '#9C27B0';
      default:
        return '#4CAF50';
    }
  };

  const getTypeIcon = (type: string) => {
    const color = getTypeColor(type);
    return <MapPin size={20} color={color} />;
  };

  const RideCard = ({ ride }: { ride: any }) => (
    <View style={[styles.rideCard, { borderLeftColor: getTypeColor(ride.rideType || 'standard') }]}>
      <View style={styles.rideHeader}>
        <View style={styles.passengerInfo}>
          <Text style={styles.passengerName}>{ride.passenger?.name || 'Passenger'}</Text>
          <View style={styles.ratingContainer}>
            <Star size={14} color="#FFD700" fill="#FFD700" />
            <Text style={styles.rating}>{ride.passenger?.rating?.toFixed(1) || '5.0'}</Text>
          </View>
        </View>
        <View style={styles.fareContainer}>
          <Text style={styles.fare}>${(ride.price || ride.estimatedEarnings || 0).toFixed(2)}</Text>
          {ride.distanceToPickup && ride.distanceToPickup < 1 && (
            <Text style={styles.surge}>Nearby</Text>
          )}
        </View>
      </View>
      
      <View style={styles.routeInfo}>
        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: '#4CAF50' }]} />
          <Text style={styles.locationText} numberOfLines={1}>
            {ride.pickupAddress || 'Pickup location'}
          </Text>
        </View>
        <View style={styles.routeLine} />
        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: '#FF5722' }]} />
          <Text style={styles.locationText} numberOfLines={1}>
            {ride.dropoffAddress || 'Dropoff location'}
          </Text>
        </View>
      </View>
      
      <View style={styles.rideDetails}>
        <View style={styles.detailItem}>
          <Navigation size={16} color={Colors.light.textSecondary} />
          <Text style={styles.detailText}>
            {ride.distance ? formatDistance(ride.distance) : 'N/A'}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Clock size={16} color={Colors.light.textSecondary} />
          <Text style={styles.detailText}>
            {ride.duration ? formatDuration(ride.duration) : 'N/A'}
          </Text>
        </View>
        <View style={styles.typeTag}>
          {getTypeIcon(ride.rideType || 'standard')}
          <Text style={[styles.typeText, { color: getTypeColor(ride.rideType || 'standard') }]}>
            {(ride.rideType || 'standard').toUpperCase()}
          </Text>
        </View>
      </View>
      
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={styles.declineButton}
          onPress={() => handleDeclineRide(ride.id!)}
        >
          <Text style={styles.declineText}>Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.acceptButton}
          onPress={() => handleAcceptRide(ride.id!)}
        >
          <Text style={styles.acceptText}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const SpinWheel = () => {
    const rotation = spinValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '1440deg'],
    });

    return (
      <View style={styles.spinWheelOverlay}>
        <View style={styles.spinWheelContainer}>
          <Text style={styles.spinWheelTitle}>Bonus Spin! 🎉</Text>
          <Animated.View 
            style={[
              styles.wheel,
              { transform: [{ rotate: rotation }] }
            ]}
          >
            <View style={styles.wheelSegment}>
              <Text style={styles.wheelText}>$5</Text>
            </View>
          </Animated.View>
          <Text style={styles.spinWheelSubtitle}>You earned a $5 bonus!</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Map Area */}
      <View style={styles.mapContainer}>
        {Platform.OS === 'web' ? (
          <View style={styles.mapPlaceholder}>
            <MapPin size={40} color={Colors.light.primary} />
            <Text style={styles.mapText}>Interactive Map View</Text>
            <Text style={styles.mapSubtext}>Real-time ride requests will appear here</Text>
          </View>
        ) : (
          <Map
            fullScreen
            showDrivers={false}
            initialRegion={userLocation || undefined}
          />
        )}
        
        {/* Map Controls */}
        <View style={styles.mapControls}>
          <TouchableOpacity 
            style={styles.bonusButton}
            onPress={spinWheel}
          >
            <Gift size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Slide-up Panel */}
      <Animated.View 
        style={[styles.panel, { height: panelHeight }]}
        {...panResponder.panHandlers}
      >
        <View style={styles.panelHandle} />
        
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Available Rides</Text>
          <View style={styles.rideCount}>
            <Text style={styles.rideCountText}>{rideRequests.length}</Text>
          </View>
        </View>

        <Animated.ScrollView 
          style={styles.ridesContainer}
          showsVerticalScrollIndicator={false}
        >
          {!isOnline ? (
            <View style={styles.offlineContainer}>
              <MapPin size={48} color={Colors.light.textSecondary} />
              <Text style={styles.offlineText}>You are offline</Text>
              <Text style={styles.offlineSubtext}>Go online to receive ride requests</Text>
            </View>
          ) : rideRequests.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MapPin size={48} color={Colors.light.textSecondary} />
              <Text style={styles.emptyText}>No rides available</Text>
              <Text style={styles.emptySubtext}>Waiting for ride requests...</Text>
            </View>
          ) : (
            rideRequests.map((ride) => (
              <RideCard key={ride.id} ride={ride} />
            ))
          )}
        </Animated.ScrollView>
      </Animated.View>



      {/* Spin Wheel */}
      {showSpinWheel && <SpinWheel />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.mapBackground,
    padding: 20,
  },
  mapText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 10,
  },
  mapSubtext: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 5,
    textAlign: 'center',
  },
  mapControls: {
    position: 'absolute',
    bottom: 140,
    right: 20,
    gap: 10,
  },
  bonusButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FF9800',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.light.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  panelHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.light.lightGray,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  rideCount: {
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rideCountText: {
    color: Colors.light.white,
    fontSize: 12,
    fontWeight: '600',
  },
  ridesContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  rideCard: {
    backgroundColor: Colors.light.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  rideHeader: {
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
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginLeft: 4,
  },
  fareContainer: {
    alignItems: 'flex-end',
  },
  fare: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.success,
  },
  surge: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: '600',
  },
  routeInfo: {
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: Colors.light.lightGray,
    marginLeft: 3,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 14,
    color: Colors.light.text,
    flex: 1,
  },
  rideDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  detailText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginLeft: 4,
  },
  typeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.lightGray,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 'auto',
  },
  typeText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  declineButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.danger,
    alignItems: 'center',
  },
  declineText: {
    color: Colors.light.danger,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.light.success,
    alignItems: 'center',
  },
  acceptText: {
    color: Colors.light.white,
    fontWeight: '600',
  },
  currentRideOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentRideModal: {
    backgroundColor: Colors.light.white,
    borderRadius: 20,
    padding: 24,
    margin: 20,
    alignItems: 'center',
  },
  currentRideTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 8,
  },
  currentRideText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  currentRideActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  callText: {
    color: Colors.light.white,
    fontWeight: '600',
    marginLeft: 8,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.success,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  messageText: {
    color: Colors.light.white,
    fontWeight: '600',
    marginLeft: 8,
  },
  startTripButton: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 25,
  },
  startTripText: {
    color: Colors.light.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  spinWheelOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinWheelContainer: {
    alignItems: 'center',
  },
  spinWheelTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.white,
    marginBottom: 20,
  },
  wheel: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  wheelSegment: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  spinWheelSubtitle: {
    fontSize: 18,
    color: Colors.light.white,
    textAlign: 'center',
  },
  offlineContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  offlineText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 12,
  },
  offlineSubtext: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
});