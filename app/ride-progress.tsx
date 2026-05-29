import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BellRing, Car, CircleDot, MapPin, Navigation2, Phone, X } from 'lucide-react-native';

import Map from '@/components/Map';
import Colors from '@/constants/colors';
import { useLocation } from '@/hooks/useLocationStore';
import { useRide } from '@/hooks/useRideStore';
import { Driver, Location, RideCancellationReason, RideTrackingStage } from '@/types';

type RiderStage = RideTrackingStage;

const COLLAPSED_OFFSET = 208;
const EXPANDED_OFFSET = 0;

function interpolateLocation(start: Location, end: Location, progress: number): Location {
  return {
    latitude: start.latitude + (end.latitude - start.latitude) * progress,
    longitude: start.longitude + (end.longitude - start.longitude) * progress,
  };
}

function buildApproachStart(pickup: Location): Location {
  return {
    latitude: pickup.latitude - 0.028,
    longitude: pickup.longitude - 0.02,
  };
}

function getStageTitle(stage: RiderStage): string {
  switch (stage) {
    case 'searching':
      return 'Finding your driver';
    case 'driver_assigned':
      return 'Driver accepted';
    case 'driver_arriving':
      return 'Driver on the way';
    case 'driver_arrived':
      return 'Driver has arrived';
    case 'trip_in_progress':
      return 'Trip in progress';
    default:
      return 'Ride status';
  }
}

export default function RideProgressScreen() {
  const { currentRide, cancelRide, updateRideSession, isHydratingRide } = useRide();
  const { pickupLocation, dropoffLocation, pickupAddress, dropoffAddress } = useLocation();
  const resolvedPickupLocation = currentRide?.pickupLocation ?? pickupLocation ?? null;
  const resolvedDropoffLocation = currentRide?.dropoffLocation ?? dropoffLocation ?? null;
  const resolvedPickupAddress = currentRide?.pickupAddress ?? pickupAddress ?? 'Pickup location';
  const resolvedDropoffAddress = currentRide?.dropoffAddress ?? dropoffAddress ?? 'Destination';
  const [stage, setStage] = useState<RiderStage>('searching');
  const [statusText, setStatusText] = useState<string>('Looking for a nearby driver');
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
  const [driverLocation, setDriverLocation] = useState<Location | null>(null);
  const [driverEtaMinutes, setDriverEtaMinutes] = useState<number>(3);
  const sheetOffset = useRef<Animated.Value>(new Animated.Value(COLLAPSED_OFFSET)).current;
  const lastSheetOffset = useRef<number>(COLLAPSED_OFFSET);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const assignedDriver = currentRide?.driver ?? null;
  const currentRideId = currentRide?.id ?? null;
  const currentRideDriver = currentRide?.driver ?? null;
  const currentRideDriverLocation = currentRide?.driverLocation ?? null;
  const currentRideStatus = currentRide?.status ?? null;
  const currentRideTrackingStage = currentRide?.trackingStage ?? null;
  const currentRideStatusText = currentRide?.statusText ?? null;
  const lastSimulationStageRef = useRef<string | null>(null);
  const liveStageRef = useRef<RiderStage>('searching');
  const currentRideDriverRef = useRef<Driver | null>(null);
  const currentRideDriverLocationRef = useRef<Location | null>(null);
  const currentRideStatusTextRef = useRef<string | null>(null);

  useEffect(() => {
    const id = sheetOffset.addListener(({ value }) => {
      lastSheetOffset.current = value;
    });

    return () => {
      sheetOffset.removeListener(id);
    };
  }, [sheetOffset]);

  useEffect(() => {
    currentRideDriverRef.current = currentRideDriver;
    currentRideDriverLocationRef.current = currentRideDriverLocation;
    currentRideStatusTextRef.current = currentRideStatusText;
  }, [currentRideDriver, currentRideDriverLocation, currentRideStatusText]);

  useEffect(() => {
    console.log('RideProgress mounted with current ride:', currentRide);

    if (isHydratingRide) {
      return;
    }

    if (!currentRide || !resolvedPickupLocation || !resolvedDropoffLocation) {
      router.replace('/(tabs)/home');
    }
  }, [currentRide, isHydratingRide, resolvedDropoffLocation, resolvedPickupLocation]);

  useEffect(() => {
    if (!currentRideId || !resolvedPickupLocation || !resolvedDropoffLocation) {
      lastSimulationStageRef.current = null;
      return;
    }

    const fallbackDriver: Driver = {
      id: 'fallback-driver',
      name: 'Alex Johnson',
      rating: 4.9,
      carModel: 'Toyota Corolla',
      licensePlate: 'RIDE-204',
      eta: 3,
      phone: '+1234567890',
      carType: 'Standard',
      location: buildApproachStart(resolvedPickupLocation),
    };

    const activeDriver = currentRideDriverRef.current ?? fallbackDriver;
    const persistedStage = currentRideTrackingStage ?? (currentRideStatus === 'in_progress' ? 'trip_in_progress' : 'searching');
    const persistedStatusText = currentRideStatusTextRef.current ?? (persistedStage === 'trip_in_progress'
      ? 'Trip in progress to your destination'
      : 'Looking for a nearby driver');
    const persistedDriverLocation = currentRideDriverLocationRef.current ?? activeDriver.location ?? buildApproachStart(resolvedPickupLocation);
    const simulationKey = `${currentRideId}:${persistedStage}`;

    setStage(persistedStage);
    setStatusText(persistedStatusText);
    setDriverLocation(persistedDriverLocation);
    setDriverEtaMinutes(activeDriver.eta ?? 3);
    liveStageRef.current = persistedStage;

    if (lastSimulationStageRef.current === simulationKey) {
      return;
    }

    lastSimulationStageRef.current = simulationKey;

    let searchingInterval: ReturnType<typeof setInterval> | null = null;
    let stageTimer: ReturnType<typeof setTimeout> | null = null;
    let arrivalInterval: ReturnType<typeof setInterval> | null = null;
    let tripInterval: ReturnType<typeof setInterval> | null = null;

    const setPersistedStage = (nextStage: RiderStage, nextStatus: string, nextLocation?: Location, nextRideStatus?: 'pending' | 'confirmed' | 'in_progress') => {
      liveStageRef.current = nextStage;
      setStage(nextStage);
      setStatusText(nextStatus);
      if (nextLocation) {
        setDriverLocation(nextLocation);
      }
      void updateRideSession({
        trackingStage: nextStage,
        statusText: nextStatus,
        driverLocation: nextLocation,
        status: nextRideStatus ?? currentRideStatus ?? 'pending',
        driver: activeDriver,
      });
    };

    if (persistedStage === 'searching') {
      const searchingMessages = [
        'Looking for a nearby driver',
        'Checking who can reach you fastest',
        'Sending your request to active drivers',
      ];
      let searchingIndex = 0;

      searchingInterval = setInterval(() => {
        if (liveStageRef.current !== 'searching') {
          return;
        }

        searchingIndex = (searchingIndex + 1) % searchingMessages.length;
        const nextMessage = searchingMessages[searchingIndex];
        setStatusText(nextMessage);
        void updateRideSession({ statusText: nextMessage, driver: activeDriver, driverLocation: persistedDriverLocation });
      }, 1800);

      stageTimer = setTimeout(() => {
        if (searchingInterval) {
          clearInterval(searchingInterval);
        }
        setPersistedStage('driver_assigned', `${activeDriver.name} accepted your ride`, persistedDriverLocation, 'confirmed');
      }, assignedDriver ? 1200 : 3200);
    }

    if (persistedStage === 'driver_assigned' || persistedStage === 'driver_arriving') {
      let progress = persistedStage === 'driver_arriving' ? 0.35 : 0.12;

      arrivalInterval = setInterval(() => {
        if (liveStageRef.current !== 'driver_assigned' && liveStageRef.current !== 'driver_arriving') {
          return;
        }

        progress = Math.min(1, progress + 0.18);
        const nextLocation = interpolateLocation(persistedDriverLocation, resolvedPickupLocation, progress);
        const nextEta = Math.max(1, Math.round((1 - progress) * (activeDriver.eta ?? 3)));
        setDriverEtaMinutes(nextEta);
        const nextStage: RiderStage = progress >= 0.92 ? 'driver_arrived' : progress > 0.2 ? 'driver_arriving' : 'driver_assigned';
        const nextStatus = nextStage === 'driver_arrived' ? 'Driver has arrived at your pickup' : 'Driver is on the way';
        setPersistedStage(nextStage, nextStatus, nextLocation, 'confirmed');
        if (nextStage === 'driver_arrived' && arrivalInterval) {
          clearInterval(arrivalInterval);
        }
      }, 1800);
    }

    if (persistedStage === 'driver_arrived') {
      setDriverEtaMinutes(0);
      stageTimer = setTimeout(() => {
        const tripStartLocation = resolvedPickupLocation;
        setPersistedStage('trip_in_progress', 'Trip started. Driver is heading to your destination', tripStartLocation, 'in_progress');
      }, 4500);
    }

    if (persistedStage === 'trip_in_progress') {
      let progress = 0;
      const tripStart = currentRideDriverLocationRef.current ?? resolvedPickupLocation;
      tripInterval = setInterval(() => {
        if (liveStageRef.current !== 'trip_in_progress') {
          return;
        }

        progress = Math.min(1, progress + 0.08);
        const nextLocation = interpolateLocation(tripStart, resolvedDropoffLocation, progress);
        const nextStatus = progress < 1
          ? 'Trip started. Driver is heading to your destination'
          : 'You have arrived at your destination';
        setPersistedStage('trip_in_progress', nextStatus, nextLocation, 'in_progress');
        if (progress >= 1 && tripInterval) {
          clearInterval(tripInterval);
        }
      }, 1800);
    }

    return () => {
      if (searchingInterval) {
        clearInterval(searchingInterval);
      }
      if (stageTimer) {
        clearTimeout(stageTimer);
      }
      if (arrivalInterval) {
        clearInterval(arrivalInterval);
      }
      if (tripInterval) {
        clearInterval(tripInterval);
      }
    };
  }, [assignedDriver, currentRideId, currentRideStatus, currentRideTrackingStage, resolvedDropoffLocation, resolvedPickupLocation, updateRideSession]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 8,
    onMoveShouldSetPanResponderCapture: (_, gestureState) => Math.abs(gestureState.dy) > 8,
    onPanResponderMove: (_, gestureState) => {
      const nextValue = Math.max(EXPANDED_OFFSET, Math.min(COLLAPSED_OFFSET, lastSheetOffset.current + gestureState.dy));
      sheetOffset.setValue(nextValue);
    },
    onPanResponderRelease: (_, gestureState) => {
      const shouldExpand = gestureState.dy < -35 || lastSheetOffset.current < COLLAPSED_OFFSET / 2;
      Animated.spring(sheetOffset, {
        toValue: shouldExpand ? EXPANDED_OFFSET : COLLAPSED_OFFSET,
        damping: 18,
        stiffness: 170,
        mass: 0.9,
        useNativeDriver: true,
      }).start();
      setIsExpanded(shouldExpand);
    },
  }), [sheetOffset]);

  const routeStartLocation = useMemo(() => {
    if (!resolvedPickupLocation || !resolvedDropoffLocation) {
      return null;
    }

    if (stage === 'trip_in_progress') {
      return driverLocation ?? resolvedPickupLocation;
    }

    return null;
  }, [driverLocation, resolvedDropoffLocation, resolvedPickupLocation, stage]);

  const routeEndLocation = useMemo(() => {
    if (!resolvedPickupLocation || !resolvedDropoffLocation || stage !== 'trip_in_progress') {
      return null;
    }

    return resolvedDropoffLocation;
  }, [resolvedDropoffLocation, resolvedPickupLocation, stage]);

  const customMarkers = useMemo(() => {
    const markers: Array<{ id: string; location: Location; title: string; description?: string; type: 'driver' | 'pickup' | 'dropoff' }> = [];

    if (driverLocation) {
      markers.push({
        id: 'driver',
        location: driverLocation,
        title: assignedDriver?.name ?? 'Driver',
        description: stage === 'trip_in_progress' ? 'Heading to your destination' : 'Driver is on the way',
        type: 'driver',
      });
    }

    if (resolvedPickupLocation) {
      markers.push({
        id: 'pickup',
        location: resolvedPickupLocation,
        title: 'Pickup',
        description: stage === 'driver_arrived' ? 'Your driver is here' : resolvedPickupAddress,
        type: 'pickup',
      });
    }

    if (resolvedDropoffLocation) {
      markers.push({
        id: 'dropoff',
        location: resolvedDropoffLocation,
        title: 'Destination',
        description: resolvedDropoffAddress,
        type: 'dropoff',
      });
    }

    return markers;
  }, [assignedDriver?.name, driverLocation, resolvedDropoffAddress, resolvedDropoffLocation, resolvedPickupAddress, resolvedPickupLocation, stage]);

  const mapRegion = useMemo<Location | undefined>(() => {
    const focusPoint = driverLocation ?? resolvedPickupLocation ?? undefined;

    if (!focusPoint) {
      return undefined;
    }

    return {
      latitude: focusPoint.latitude,
      longitude: focusPoint.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }, [driverLocation, resolvedPickupLocation]);

  const stageTitle = useMemo(() => getStageTitle(stage), [stage]);

  const livePillLabel = useMemo(() => {
    return stage === 'trip_in_progress' ? 'Live direction' : 'Driver on the way';
  }, [stage]);

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

  const handleRouteInfoChange = (info: { distance: number; duration: number } | null) => {
    console.log('Ride progress route info updated:', info);
    setRouteInfo(info);
  };

  const handleCallDriver = async () => {
    const phoneNumber = assignedDriver?.phone;
    if (!phoneNumber) {
      Alert.alert('Phone unavailable', 'Driver phone number is not available yet.');
      return;
    }

    const phoneUrl = Platform.select({
      ios: `tel:${phoneNumber}`,
      android: `tel:${phoneNumber}`,
      default: `tel:${phoneNumber}`,
    });

    const canOpen = await Linking.canOpenURL(phoneUrl);
    if (!canOpen) {
      Alert.alert('Call unavailable', 'This device cannot place a phone call.');
      return;
    }

    await Linking.openURL(phoneUrl);
  };

  const confirmCancelReason = (reason: RideCancellationReason, label: string) => {
    Alert.alert('Cancel ride', `Reason: ${label}?`, [
      { text: 'Back', style: 'cancel' },
      {
        text: 'Confirm cancel',
        style: 'destructive',
        onPress: () => {
          cancelRide(reason, label);
          router.replace('/(tabs)/home');
        },
      },
    ]);
  };

  const handleCancelRide = () => {
    Alert.alert('Why are you cancelling?', 'Choose a reason to keep the trip session accurate.', [
      { text: 'Slow pickup', onPress: () => confirmCancelReason('slow_pickup', 'Slow pickup') },
      { text: 'Wrong destination', onPress: () => confirmCancelReason('wrong_destination', 'Wrong destination') },
      { text: 'Booked by mistake', onPress: () => confirmCancelReason('booked_by_mistake', 'Booked by mistake') },
      { text: 'Other', onPress: () => confirmCancelReason('other', 'Other') },
      { text: 'Keep ride', style: 'cancel' },
    ]);
  };

  if (isHydratingRide) {
    return (
      <View style={styles.loadingContainerScreen}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
        <Text style={styles.loadingText}>Restoring your ride...</Text>
      </View>
    );
  }

  if (!currentRide || !resolvedPickupLocation || !resolvedDropoffLocation || !mapRegion) {
    return null;
  }

  const canCallDriver = stage !== 'searching' && !!assignedDriver?.phone;
  const showRoute = stage === 'trip_in_progress';

  return (
    <View style={styles.container}>
      <Map
        showRoute={showRoute}
        initialRegion={mapRegion}
        fullScreen={true}
        showDrivers={false}
        onRouteInfoChange={handleRouteInfoChange}
        routeStartLocation={routeStartLocation}
        routeEndLocation={routeEndLocation}
        customMarkers={customMarkers}
      />

      <SafeAreaView edges={['top']} style={styles.topContainer}>
        <View style={styles.topCard}>
          <View style={styles.topCardHeader}>
            <Pressable style={styles.closeButton} onPress={() => router.back()} testID="ride-progress-close-button">
              <X size={18} color={Colors.light.text} />
            </Pressable>
            <View style={styles.livePill}>
              <BellRing size={14} color="#0F766E" />
              <Text style={styles.livePillText}>{livePillLabel}</Text>
            </View>
          </View>
          <Text style={styles.stageTitle}>{stageTitle}</Text>
          <Text style={styles.stageSubtitle}>{statusText}</Text>
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.bottomOverlay} pointerEvents="box-none">
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY: sheetOffset }] }]}
          {...panResponder.panHandlers}
          testID="ride-progress-sheet"
        >
          <Pressable style={styles.handleWrap} onPress={toggleSheet} testID="ride-progress-handle">
            <View style={styles.handle} />
            <Text style={styles.handleText}>Trip details</Text>
          </Pressable>

          <View style={styles.sheetContent}>
            <View style={styles.routeCard}>
              <View style={styles.routeRow}>
                <CircleDot size={16} color={Colors.light.primary} />
                <Text style={styles.routeText} numberOfLines={1}>{resolvedPickupAddress}</Text>
              </View>
              <View style={styles.routeDivider} />
              <View style={styles.routeRow}>
                <MapPin size={16} color={Colors.light.secondary} />
                <Text style={styles.routeText} numberOfLines={1}>{resolvedDropoffAddress}</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Price</Text>
                <Text style={styles.statValue}>₦{(currentRide.price ?? 0).toFixed(0)}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{showRoute ? 'To destination' : 'Driver ETA'}</Text>
                <Text style={styles.statValue}>
                  {showRoute
                    ? routeInfo
                      ? `${(routeInfo.distance / 1000).toFixed(1)} km`
                      : '--'
                    : stage === 'driver_arrived'
                      ? 'Now'
                      : `${driverEtaMinutes} min`}
                </Text>
              </View>
            </View>

            {stage === 'searching' ? (
              <View style={styles.noticeCard}>
                <ActivityIndicator size="small" color={Colors.light.primary} />
                <Text style={styles.noticeText}>Searching for a driver now...</Text>
              </View>
            ) : (
              <View style={styles.driverCard}>
                <View style={styles.driverBadge}>
                  <Car size={18} color="#FFFFFF" />
                </View>
                <View style={styles.driverDetails}>
                  <Text style={styles.driverName}>{assignedDriver?.name ?? 'Driver assigned'}</Text>
                  <Text style={styles.driverMeta}>
                    {assignedDriver?.carModel ?? 'Sedan'} · {assignedDriver?.licensePlate ?? 'Plate pending'}
                  </Text>
                </View>
                <View style={styles.etaPill}>
                  <Text style={styles.etaValue}>{stage === 'driver_arrived' ? 'Now' : `${driverEtaMinutes} min`}</Text>
                </View>
              </View>
            )}

            {isExpanded ? (
              <View style={styles.expandedSection}>
                <Text style={styles.expandedLabel}>Live status</Text>
                <Text style={styles.expandedText}>
                  {stage === 'trip_in_progress'
                    ? 'The route is active and the trip stays saved until you finish or cancel it.'
                    : stage === 'driver_arrived'
                      ? 'Your driver is at the pickup point. The session remains active until you cancel it.'
                      : 'The map is showing the live vehicle position as the driver comes to you.'}
                </Text>
                <View style={styles.expandedActions}>
                  {canCallDriver ? (
                    <Pressable style={styles.secondaryButton} onPress={handleCallDriver} testID="ride-progress-call-button">
                      <Phone size={16} color="#0F172A" />
                      <Text style={styles.secondaryButtonText}>Call driver</Text>
                    </Pressable>
                  ) : null}
                  <Pressable style={styles.secondaryButton} onPress={handleCancelRide} testID="ride-progress-cancel-button">
                    <Navigation2 size={16} color="#0F172A" />
                    <Text style={styles.secondaryButtonText}>Cancel ride</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  loadingContainerScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.background,
  },
  loadingText: {
    marginTop: 12,
    color: '#475569',
    fontSize: 15,
    fontWeight: '600',
  },
  topContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
  },
  topCard: {
    marginTop: 8,
    borderRadius: 24,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.96)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  topCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.lightGray,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#CCFBF1',
  },
  livePillText: {
    color: '#0F766E',
    fontSize: 12,
    fontWeight: '700',
  },
  stageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  stageSubtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
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
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    overflow: 'hidden',
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
  },
  handleText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  sheetContent: {
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  routeCard: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#F8FAFC',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeDivider: {
    width: 1,
    height: 18,
    marginLeft: 7,
    marginVertical: 8,
    backgroundColor: '#CBD5E1',
  },
  routeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  statCard: {
    flex: 1,
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#0F172A',
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  statValue: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  noticeCard: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#ECFEFF',
  },
  noticeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#155E75',
  },
  driverCard: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
  },
  driverBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  driverDetails: {
    flex: 1,
    marginLeft: 12,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  driverMeta: {
    marginTop: 4,
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  etaPill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  etaValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  expandedSection: {
    marginTop: 16,
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#F8FAFC',
  },
  expandedLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  expandedText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
  },
  expandedActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
});
