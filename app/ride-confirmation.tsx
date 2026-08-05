import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ChevronDown, ChevronUp, Route, X, Zap } from 'lucide-react-native';

import Map from '@/components/Map';
import Button from '@/components/Button';
import Colors from '@/constants/colors';
import { getVehicleImageSource } from '@/assets/vehicles';
import VehicleImage from '@/assets/vehicles/VehicleImage';
import { useLocation } from '@/hooks/useLocationStore';
import { useRide } from '@/hooks/useRideStore';
import { Location } from '@/types';

const COLLAPSED_OFFSET = 188;
const EXPANDED_OFFSET = 0;

function buildRouteKey(pickup: Location | null, dropoff: Location | null) {
  if (!pickup || !dropoff) {
    return null;
  }

  return [
    pickup.latitude.toFixed(5),
    pickup.longitude.toFixed(5),
    dropoff.latitude.toFixed(5),
    dropoff.longitude.toFixed(5),
  ].join(':');
}

export default function RideConfirmationScreen() {
  const router = useRouter();
  const {
    estimatedDistance,
    estimatedDuration,
    estimatedPrice,
    rideTypes,
    selectedRideType,
    setSelectedRideType,
    tierPrices,
    requestRide,
    surgeMultiplier,
  } = useRide();
  const {
    pickupLocation,
    dropoffLocation,
    pickupAddress,
    dropoffAddress,
    routeInfo,
    isCalculatingRoute,
    calculateRoute,
    clearRoute,
  } = useLocation();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const routeRequestRef = useRef<string | null>(null);
  const sheetOffset = useRef<Animated.Value>(new Animated.Value(COLLAPSED_OFFSET)).current;
  const lastSheetOffset = useRef<number>(COLLAPSED_OFFSET);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [bookingFor, setBookingFor] = useState<'me' | 'other'>('me');
  const [passengerName, setPassengerName] = useState<string>('');
  const [passengerPhone, setPassengerPhone] = useState<string>('');

  useEffect(() => {
    const id = sheetOffset.addListener(({ value }) => {
      lastSheetOffset.current = value;
    });

    return () => {
      sheetOffset.removeListener(id);
    };
  }, [sheetOffset]);

  useEffect(() => {
    if (!pickupLocation || !dropoffLocation) {
      router.replace('/(tabs)/home');
      return;
    }

    const routeKey = buildRouteKey(pickupLocation, dropoffLocation);
    if (!routeKey || routeRequestRef.current === routeKey || isCalculatingRoute || routeInfo) {
      return;
    }

    routeRequestRef.current = routeKey;
    void calculateRoute(pickupLocation, dropoffLocation);
  }, [calculateRoute, dropoffLocation, isCalculatingRoute, pickupLocation, routeInfo, router]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 8,
    onPanResponderMove: (_, gestureState) => {
      const nextValue = Math.max(EXPANDED_OFFSET, Math.min(COLLAPSED_OFFSET, lastSheetOffset.current + gestureState.dy));
      sheetOffset.setValue(nextValue);
    },
    onPanResponderRelease: (_, gestureState) => {
      const shouldExpand = gestureState.dy < -35 || lastSheetOffset.current < COLLAPSED_OFFSET / 2;
      const nextValue = shouldExpand ? EXPANDED_OFFSET : COLLAPSED_OFFSET;
      Animated.spring(sheetOffset, {
        toValue: nextValue,
        damping: 18,
        stiffness: 170,
        mass: 0.9,
        useNativeDriver: true,
      }).start();
      setIsExpanded(shouldExpand);
    },
  }), [sheetOffset]);

  const mapRegion = useMemo<Location | undefined>(() => {
    if (!pickupLocation || !dropoffLocation) {
      return undefined;
    }

    const centerLat = (pickupLocation.latitude + dropoffLocation.latitude) / 2;
    const centerLng = (pickupLocation.longitude + dropoffLocation.longitude) / 2;
    const latDelta = Math.abs(pickupLocation.latitude - dropoffLocation.latitude) * 1.8;
    const lngDelta = Math.abs(pickupLocation.longitude - dropoffLocation.longitude) * 1.8;

    return {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: Math.max(0.02, latDelta),
      longitudeDelta: Math.max(0.02, lngDelta),
    };
  }, [dropoffLocation, pickupLocation]);

  const routeSourceLabel = useMemo(() => {
    if (!routeInfo) {
      return 'Preparing direction';
    }

    return routeInfo.polyline ? 'Live direction' : 'Estimated direction';
  }, [routeInfo]);

  const toggleSheet = () => {
    const nextExpanded = !isExpanded;
    Animated.spring(sheetOffset, {
      toValue: nextExpanded ? EXPANDED_OFFSET : COLLAPSED_OFFSET,
      damping: 18,
      stiffness: 170,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
    setIsExpanded(nextExpanded);
  };

  const handleBookRide = async () => {
    if (!pickupLocation || !dropoffLocation) {
      Alert.alert('Trip unavailable', 'Please select your route again.');
      return;
    }

    const trimmedName = passengerName.trim();
    const trimmedPhone = passengerPhone.trim();
    if (bookingFor === 'other') {
      if (!trimmedName) {
        Alert.alert('Passenger name required', "Enter the name of the person you're booking this ride for.");
        return;
      }
      if (trimmedPhone.replace(/\D/g, '').length < 7) {
        Alert.alert('Passenger phone required', "Enter a valid phone number for the person you're booking this ride for.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const ride = await requestRide(
        undefined,
        bookingFor === 'other' ? trimmedName : undefined,
        bookingFor === 'other' ? trimmedPhone : undefined
      );
      if (!ride) {
        Alert.alert('Sign in required', 'Please sign in to book a ride.');
        return;
      }
      router.push('/ride-progress');
    } catch (error) {
      console.error('Error booking ride from confirmation screen:', error);
      Alert.alert('Booking failed', 'We could not confirm this ride. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleCancel = () => {
    clearRoute();
    router.back();
  };

  if (!pickupLocation || !dropoffLocation || !mapRegion) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
        <Text style={styles.loadingText}>Preparing your trip...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <Map
        initialRegion={mapRegion}
        showDrivers={false}
        showRoute={true}
        fullScreen={true}
      />

      <View style={styles.topOverlay} pointerEvents="box-none">
        <SafeAreaView edges={['top']}>
          <View style={styles.topRow}>
            <Pressable style={styles.iconButton} onPress={handleCancel} testID="ride-map-close-button">
              <X size={20} color="#FFFFFF" />
            </Pressable>
            <View style={styles.routePill} testID="ride-route-source-pill">
              <Route size={14} color="#99F6E4" />
              <Text style={styles.routePillText}>{routeSourceLabel}</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <SafeAreaView edges={['bottom']} style={styles.bottomOverlay} pointerEvents="box-none">
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY: sheetOffset }] }]}
          {...panResponder.panHandlers}
          testID="ride-map-sheet"
        >
          <Pressable style={styles.handleWrap} onPress={toggleSheet} {...panResponder.panHandlers} testID="ride-sheet-handle">
            <View style={styles.handle} />
            <View style={styles.handleLabelRow}>
              <Text style={styles.handleTitle}>Trip details</Text>
              {isExpanded ? <ChevronDown size={18} color="#94A3B8" /> : <ChevronUp size={18} color="#94A3B8" />}
            </View>
          </Pressable>

          <View style={styles.sheetContent}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard} testID="ride-map-price-card">
                <Text style={styles.summaryLabel}>Price</Text>
                <Text style={styles.summaryValue}>₦{estimatedPrice.toFixed(0)}</Text>
              </View>
              <View style={styles.summaryCard} testID="ride-map-distance-card">
                <Text style={styles.summaryLabel}>Distance</Text>
                <Text style={styles.summaryValue}>{estimatedDistance.toFixed(1)} km</Text>
              </View>
            </View>

            {surgeMultiplier > 1 && (
              <View style={styles.surgeBadge} testID="surge-badge">
                <Zap size={14} color="#FF9500" fill="#FF9500" />
                <Text style={styles.surgeBadgeText}>
                  Prices are higher due to high demand ({surgeMultiplier.toFixed(1)}×)
                </Text>
              </View>
            )}

            <View style={styles.destinationCard} testID="ride-destination-card">
              <Text style={styles.destinationLabel}>Destination</Text>
              <Text style={styles.destinationValue} numberOfLines={isExpanded ? 2 : 1}>{dropoffAddress || 'Destination'}</Text>
              {isExpanded ? (
                <Text style={styles.pickupValue} numberOfLines={1}>From {pickupAddress || 'Current location'}</Text>
              ) : null}
            </View>

            <View style={styles.bookingForCard} testID="booking-for-card">
              <Text style={styles.destinationLabel}>Booking for</Text>
              <View style={styles.bookingForToggle}>
                <Pressable
                  style={[styles.bookingForOption, bookingFor === 'me' && styles.bookingForOptionSelected]}
                  onPress={() => setBookingFor('me')}
                  testID="booking-for-me"
                >
                  <Text style={[styles.bookingForOptionText, bookingFor === 'me' && styles.bookingForOptionTextSelected]}>Me</Text>
                </Pressable>
                <Pressable
                  style={[styles.bookingForOption, bookingFor === 'other' && styles.bookingForOptionSelected]}
                  onPress={() => setBookingFor('other')}
                  testID="booking-for-other"
                >
                  <Text style={[styles.bookingForOptionText, bookingFor === 'other' && styles.bookingForOptionTextSelected]}>Someone else</Text>
                </Pressable>
              </View>
              {bookingFor === 'other' ? (
                <View style={styles.passengerInputs}>
                  <TextInput
                    style={styles.passengerInput}
                    placeholder="Passenger's name"
                    placeholderTextColor="#64748B"
                    value={passengerName}
                    onChangeText={setPassengerName}
                    testID="booking-for-passenger-name"
                  />
                  <TextInput
                    style={styles.passengerInput}
                    placeholder="Passenger's phone number"
                    placeholderTextColor="#64748B"
                    value={passengerPhone}
                    onChangeText={setPassengerPhone}
                    keyboardType="phone-pad"
                    testID="booking-for-passenger-phone"
                  />
                </View>
              ) : null}
            </View>

            <View style={styles.tierContainer} testID="ride-type-picker">
              <Text style={styles.tierSectionTitle}>Select ride type</Text>
              <View style={styles.tierRow}>
                {rideTypes.map((type) => {
                  const isSelected = selectedRideType === type.id;
                  const price = tierPrices[type.id];
                  const vehicleSource = getVehicleImageSource(type);
                  return (
                    <Pressable
                      key={type.id}
                      style={[styles.tierCard, isSelected && styles.tierCardSelected]}
                      onPress={() => setSelectedRideType(type.id)}
                      testID={`tier-option-${type.id}`}
                    >
                      <VehicleImage source={vehicleSource} width={72} height={44} />
                      <Text style={[styles.tierName, isSelected && styles.tierNameSelected]}>
                        {type.name}
                      </Text>
                      <Text style={[styles.tierPrice, isSelected && styles.tierPriceSelected]}>
                        {price ? `₦${price.toLocaleString()}` : '—'}
                      </Text>
                      <Text style={styles.tierEta}>{type.eta} min</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {isExpanded ? (
              <View style={styles.expandedMetaRow}>
                <Text style={styles.metaText}>{estimatedDuration} min ride</Text>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaText}>{routeSourceLabel}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.footer}>
            <View style={styles.secondaryActions}>
              <Pressable style={styles.secondaryAction} onPress={handleCancel} testID="ride-map-cancel-button">
                <X size={16} color="#FECACA" />
                <Text style={styles.secondaryActionText}>Cancel</Text>
              </Pressable>
            </View>
            <Button
              title="Book ride"
              onPress={handleBookRide}
              loading={isSubmitting}
              disabled={isSubmitting || isCalculatingRoute}
              testID="ride-map-book-button"
            />
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#08111F',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#D6E4F0',
    fontSize: 15,
    fontWeight: '600',
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 18,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,10,18,0.68)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  routePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(5,10,18,0.74)',
    borderWidth: 1,
    borderColor: 'rgba(153,246,228,0.24)',
  },
  routePillText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  bottomOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 30,
    backgroundColor: 'rgba(7,14,26,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    overflow: 'hidden',
  },
  handleWrap: {
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(148,163,184,0.65)',
    alignSelf: 'center',
    marginBottom: 10,
  },
  handleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  handleTitle: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
  },
  sheetContent: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    gap: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  surgeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  surgeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9500',
  },
  summaryCard: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.96)',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  summaryLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 6,
    fontWeight: '600',
  },
  summaryValue: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
  },
  destinationCard: {
    backgroundColor: 'rgba(15,23,42,0.78)',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  destinationLabel: {
    color: '#7DD3FC',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  destinationValue: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  pickupValue: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 8,
    fontWeight: '500',
  },
  bookingForCard: {
    backgroundColor: 'rgba(15,23,42,0.78)',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 10,
  },
  bookingForToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  bookingForOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
  },
  bookingForOptionSelected: {
    backgroundColor: 'rgba(20,184,166,0.12)',
    borderColor: '#14B8A6',
  },
  bookingForOptionText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  bookingForOptionTextSelected: {
    color: '#F8FAFC',
  },
  passengerInputs: {
    gap: 8,
  },
  passengerInput: {
    backgroundColor: 'rgba(15,23,42,0.86)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 14,
  },
  expandedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  metaText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  metaDot: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
  tierContainer: {
    gap: 10,
  },
  tierSectionTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tierRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tierCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(15,23,42,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    gap: 6,
  },
  tierCardSelected: {
    backgroundColor: 'rgba(20,184,166,0.12)',
    borderColor: '#14B8A6',
  },
  tierName: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  tierNameSelected: {
    color: '#F8FAFC',
  },
  tierPrice: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '800',
  },
  tierPriceSelected: {
    color: '#99F6E4',
  },
  tierEta: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '600',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.12)',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 12,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.86)',
  },
  secondaryActionText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
  },
});