import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { mockRideTypes } from '@/mocks/rideTypes';
import { Location, PaymentMethod, RideCancellationReason, RideRequest, RideTrackingStage, RideType } from '@/types';
import { calculateFare, calculateAllTierFares } from '@/lib/fare-calculator';
import { useLocation } from './useLocationStore';
import { usePayment } from './usePaymentStore';
import { usePromotions } from './usePromotionsStore';
import { FirebaseDriverService } from '@/lib/firebase-driver-service';
import { RideHistoryService } from '@/lib/ride-history-service';
import { DatabaseService } from '@/lib/database-service';
import { useAuth } from './useAuthStore';

const isValidUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

interface FareBounds {
  basePrice: number;
  minPrice: number;
  maxPrice: number;
  adjustedPrice: number;
}

const ACTIVE_RIDE_STORAGE_KEY = 'active_ride_session_v2';

interface SerializedRideRequest extends Omit<RideRequest, 'createdAt' | 'scheduledFor'> {
  createdAt?: string;
  scheduledFor?: string;
}

function serializeRide(ride: RideRequest): SerializedRideRequest {
  return {
    ...ride,
    createdAt: ride.createdAt?.toISOString(),
    scheduledFor: ride.scheduledFor?.toISOString(),
  };
}

function deserializeLocation(location: Location | null | undefined): Location | undefined {
  if (!location) {
    return undefined;
  }

  return {
    latitude: location.latitude,
    longitude: location.longitude,
    latitudeDelta: location.latitudeDelta,
    longitudeDelta: location.longitudeDelta,
  };
}

function deserializeRide(ride: SerializedRideRequest): RideRequest {
  return {
    ...ride,
    pickupLocation: deserializeLocation(ride.pickupLocation) as Location,
    dropoffLocation: deserializeLocation(ride.dropoffLocation) as Location,
    driverLocation: deserializeLocation(ride.driverLocation),
    driver: ride.driver
      ? {
          ...ride.driver,
          location: deserializeLocation(ride.driver.location) as Location,
        }
      : undefined,
    createdAt: ride.createdAt ? new Date(ride.createdAt) : undefined,
    scheduledFor: ride.scheduledFor ? new Date(ride.scheduledFor) : undefined,
  };
}

export const [RideProvider, useRide] = createContextHook(() => {
  const { pickupLocation, dropoffLocation, pickupAddress, dropoffAddress, routeInfo } = useLocation();
  const { getDefaultPaymentMethod } = usePayment();
  const { getActivePromotion, markPromoAsUsed } = usePromotions();
  const { user } = useAuth();

  const [selectedRideType, setSelectedRideType] = useState<string>('standard');
  const [currentRide, setCurrentRide] = useState<RideRequest | null>(null);
  const [pastRides, setPastRides] = useState<RideRequest[]>([]);
  const [estimatedPrice, setEstimatedPrice] = useState<number>(0);
  const [baseEstimatedPrice, setBaseEstimatedPrice] = useState<number>(0);
  const [minEstimatedPrice, setMinEstimatedPrice] = useState<number>(0);
  const [maxEstimatedPrice, setMaxEstimatedPrice] = useState<number>(0);
  const [fareAdjustmentPercent, setFareAdjustmentPercent] = useState<number>(0);
  const [estimatedDistance, setEstimatedDistance] = useState<number>(0);
  const [estimatedDuration, setEstimatedDuration] = useState<number>(0);
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethodState] = useState<PaymentMethod | null>(null);
  const [isSharedRide, setIsSharedRide] = useState<boolean>(false);
  const [sharedWith, setSharedWith] = useState<string[]>([]);
  const [surgeMultiplier, setSurgeMultiplier] = useState<number>(1);
  const [tierPrices, setTierPrices] = useState<Record<string, number>>({});
  const [isHydratingRide, setIsHydratingRide] = useState<boolean>(true);
  const currentRideRef = useRef<RideRequest | null>(null);

  const { data: nearbyDrivers = [] } = useQuery({
    queryKey: ['nearbyDrivers', pickupLocation, selectedRideType],
    queryFn: async () => {
      if (!pickupLocation) {
        return [];
      }

      return FirebaseDriverService.getNearbyDrivers(
        pickupLocation.latitude,
        pickupLocation.longitude,
        10
      );
    },
    enabled: !!pickupLocation,
  });

  const { data: rideTypes = [] } = useQuery({
    queryKey: ['rideTypes'],
    queryFn: async () => mockRideTypes,
  });

  useEffect(() => {
    const loadStoredRide = async () => {
      try {
        const storedRide = await AsyncStorage.getItem(ACTIVE_RIDE_STORAGE_KEY);
        if (!storedRide) {
          return;
        }

        const parsedRide = JSON.parse(storedRide) as SerializedRideRequest;
        const hydratedRide = deserializeRide(parsedRide);
        console.log('Hydrated active ride session:', hydratedRide);
        setCurrentRide(hydratedRide);
      } catch (error) {
        console.error('Error hydrating stored ride session:', error);
      } finally {
        setIsHydratingRide(false);
      }
    };

    void loadStoredRide();
  }, []);

  useEffect(() => {
    currentRideRef.current = currentRide;
  }, [currentRide]);

  useEffect(() => {
    if (isHydratingRide) {
      return;
    }

    const persistRide = async () => {
      try {
        if (!currentRide) {
          await AsyncStorage.removeItem(ACTIVE_RIDE_STORAGE_KEY);
          return;
        }

        await AsyncStorage.setItem(ACTIVE_RIDE_STORAGE_KEY, JSON.stringify(serializeRide(currentRide)));
      } catch (error) {
        console.error('Error persisting current ride session:', error);
      }
    };

    void persistRide();
  }, [currentRide, isHydratingRide]);

  const mapRideToRequest = useCallback((ride: any): RideRequest => {
    return {
      id: ride.id,
      pickupLocation: {
        latitude: ride.pickupLocation.lat,
        longitude: ride.pickupLocation.lng,
      },
      dropoffLocation: {
        latitude: ride.dropoffLocation.lat,
        longitude: ride.dropoffLocation.lng,
      },
      pickupAddress: ride.pickupLocation.address,
      dropoffAddress: ride.dropoffLocation.address,
      rideType: ride.rideType,
      price: ride.fare,
      basePrice: ride.baseFare,
      minPrice: ride.minFare,
      maxPrice: ride.maxFare,
      fareAdjustmentPercent: ride.fareAdjustmentPercent,
      distance: ride.distance,
      duration: ride.duration,
      status: ride.status as RideRequest['status'],
      createdAt: ride.createdAt ? new Date(ride.createdAt as string) : new Date(),
      driverLocation: ride.driverLocation
        ? {
            latitude: ride.driverLocation.latitude,
            longitude: ride.driverLocation.longitude,
          }
        : undefined,
      trackingStage: ride.trackingStage as RideTrackingStage | undefined,
      statusText: typeof ride.statusText === 'string' ? ride.statusText : undefined,
      cancelReason: ride.cancelReason as RideCancellationReason | undefined,
      cancelReasonDetails: typeof ride.cancelReasonDetails === 'string' ? ride.cancelReasonDetails : undefined,
    };
  }, []);

  const loadPastRides = useCallback(async () => {
    try {
      if (!user) {
        return;
      }

      const rides = await RideHistoryService.getUserRides(user.id, undefined, 50);
      setPastRides(rides.map(mapRideToRequest));
    } catch (error) {
      console.error('Error loading past rides:', error);
    }
  }, [mapRideToRequest, user]);

  useEffect(() => {
    if (user) {
      void loadPastRides();
    }
  }, [loadPastRides, user]);

  const applyFareAdjustment = useCallback((price: number, adjustmentPercent: number): FareBounds => {
    const roundedBase = Math.round(price);
    const minPrice = Math.round(roundedBase * 0.9);
    const maxPrice = Math.round(roundedBase * 1.1);
    const adjustedPrice = Math.round(roundedBase * (1 + adjustmentPercent / 100));

    return {
      basePrice: roundedBase,
      minPrice,
      maxPrice,
      adjustedPrice: Math.min(maxPrice, Math.max(minPrice, adjustedPrice)),
    };
  }, []);

  const updateEstimatedFare = useCallback((rawPrice: number, distanceKm: number, durationMinutes: number) => {
    const adjustedFare = applyFareAdjustment(rawPrice, fareAdjustmentPercent);

    console.log('Updating fare estimate:', {
      rawPrice,
      adjustedFare,
      distanceKm,
      durationMinutes,
      fareAdjustmentPercent,
    });

    setEstimatedDistance(parseFloat(distanceKm.toFixed(1)));
    setEstimatedDuration(Math.round(durationMinutes));
    setBaseEstimatedPrice(adjustedFare.basePrice);
    setMinEstimatedPrice(adjustedFare.minPrice);
    setMaxEstimatedPrice(adjustedFare.maxPrice);
    setEstimatedPrice(adjustedFare.adjustedPrice);
  }, [applyFareAdjustment, fareAdjustmentPercent]);

  const calculatePriceFromRoute = useCallback((
    distanceMeters: number,
    durationSeconds: number,
    rideTypeId: string
  ) => {
    const distanceKm = distanceMeters / 1000;
    const durationMinutes = durationSeconds / 60;

    let computedPrice = calculateFare(distanceKm, durationMinutes, rideTypeId, surgeMultiplier);
    setTierPrices(calculateAllTierFares(distanceKm, durationMinutes, surgeMultiplier));

    if (isSharedRide) {
      computedPrice = Math.round(computedPrice * 0.8);
    }

    const activePromo = getActivePromotion();
    if (activePromo) {
      computedPrice = Math.round(computedPrice * (1 - activePromo.discountPercentage / 100));
    }

    updateEstimatedFare(computedPrice, distanceKm, durationMinutes);
  }, [fareAdjustmentPercent, getActivePromotion, isSharedRide, surgeMultiplier, updateEstimatedFare]);

  const calculateRideEstimates = useCallback((pickup: typeof pickupLocation, dropoff: typeof dropoffLocation, rideTypeId: string) => {
    if (!pickup || !dropoff) {
      return;
    }

    const earthRadiusKm = 6371;
    const dLat = ((dropoff.latitude - pickup.latitude) * Math.PI) / 180;
    const dLon = ((dropoff.longitude - pickup.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((pickup.latitude * Math.PI) / 180) *
        Math.cos((dropoff.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = earthRadiusKm * c;
    const durationMinutes = (distanceKm / 30) * 60;

    let computedPrice = calculateFare(distanceKm, durationMinutes, rideTypeId, surgeMultiplier);
    setTierPrices(calculateAllTierFares(distanceKm, durationMinutes, surgeMultiplier));

    if (isSharedRide) {
      computedPrice = Math.round(computedPrice * 0.8);
    }

    const activePromo = getActivePromotion();
    if (activePromo) {
      computedPrice = Math.round(computedPrice * (1 - activePromo.discountPercentage / 100));
    }

    updateEstimatedFare(computedPrice, distanceKm, durationMinutes);
  }, [getActivePromotion, isSharedRide, surgeMultiplier, updateEstimatedFare]);

  useEffect(() => {
    if (routeInfo) {
      calculatePriceFromRoute(routeInfo.distance, routeInfo.duration, selectedRideType);
      return;
    }

    if (pickupLocation && dropoffLocation) {
      calculateRideEstimates(pickupLocation, dropoffLocation, selectedRideType);
    }
  }, [calculatePriceFromRoute, calculateRideEstimates, dropoffLocation, pickupLocation, routeInfo, selectedRideType]);

  const savePastRide = useCallback(async (ride: RideRequest) => {
    try {
      if (ride.id && ride.status) {
        await DatabaseService.update('rides', ride.id, {
          status: ride.status === 'cancelled'
            ? 'cancelled'
            : ride.status === 'completed'
              ? 'completed'
              : ride.status,
          trackingStage: ride.trackingStage ?? null,
          statusText: ride.statusText ?? null,
          cancelReason: ride.cancelReason ?? null,
          cancelReasonDetails: ride.cancelReasonDetails ?? null,
          driverLocation: ride.driverLocation
            ? {
                latitude: ride.driverLocation.latitude,
                longitude: ride.driverLocation.longitude,
              }
            : null,
        });
      }

      if (user) {
        const rides = await RideHistoryService.getUserRides(user.id, undefined, 50);
        setPastRides(rides.map(mapRideToRequest));
      }
    } catch (error) {
      console.error('Error saving ride:', error);
    }
  }, [mapRideToRequest, user]);

  const updateRideSession = useCallback(async (updates: Partial<RideRequest>) => {
    const activeRide = currentRideRef.current;

    if (!activeRide) {
      return null;
    }

    const mergedRide: RideRequest = {
      ...activeRide,
      ...updates,
      driver: updates.driver
        ? {
            ...activeRide.driver,
            ...updates.driver,
            location: updates.driver.location ?? activeRide.driver?.location,
          } as RideRequest['driver']
        : activeRide.driver,
      driverLocation: updates.driverLocation ?? activeRide.driverLocation,
    };

    console.log('Updating active ride session:', mergedRide);
    setCurrentRide(mergedRide);

    if (mergedRide.id) {
      try {
        await DatabaseService.update('rides', mergedRide.id, {
          status: mergedRide.status ?? 'pending',
          fare: mergedRide.price ?? 0,
          fareAdjustmentPercent: mergedRide.fareAdjustmentPercent ?? 0,
          trackingStage: mergedRide.trackingStage ?? null,
          statusText: mergedRide.statusText ?? null,
          driverId: mergedRide.driver?.id && isValidUuid(mergedRide.driver.id) ? mergedRide.driver.id : null,
          driverLocation: mergedRide.driverLocation
            ? {
                latitude: mergedRide.driverLocation.latitude,
                longitude: mergedRide.driverLocation.longitude,
              }
            : null,
          cancelReason: mergedRide.cancelReason ?? null,
          cancelReasonDetails: mergedRide.cancelReasonDetails ?? null,
        });
      } catch (error) {
        console.error('Error syncing ride session update:', error);
      }
    }

    return mergedRide;
  }, []);

  const requestRide = useCallback(async () => {
    if (!pickupLocation || !dropoffLocation || !user) {
      return null;
    }

    const paymentMethod = selectedPaymentMethod ?? getDefaultPaymentMethod();
    const activePromo = getActivePromotion();
    const fallbackDriver = nearbyDrivers[0];
    const driverLocation = fallbackDriver?.location ?? {
      latitude: pickupLocation.latitude - 0.028,
      longitude: pickupLocation.longitude - 0.02,
    };

    const rideData = {
      userId: user.id,
      pickupLocation: {
        lat: pickupLocation.latitude,
        lng: pickupLocation.longitude,
        latitude: pickupLocation.latitude,
        longitude: pickupLocation.longitude,
        address: pickupAddress || 'Unknown pickup location',
      },
      dropoffLocation: {
        lat: dropoffLocation.latitude,
        lng: dropoffLocation.longitude,
        latitude: dropoffLocation.latitude,
        longitude: dropoffLocation.longitude,
        address: dropoffAddress || 'Unknown dropoff location',
      },
      pickupAddress: pickupAddress || 'Unknown pickup location',
      dropoffAddress: dropoffAddress || 'Unknown dropoff location',
      rideType: selectedRideType,
      fare: estimatedPrice,
      baseFare: baseEstimatedPrice,
      minFare: minEstimatedPrice,
      maxFare: maxEstimatedPrice,
      fareAdjustmentPercent,
      distance: estimatedDistance,
      duration: estimatedDuration,
      status: 'pending',
      trackingStage: 'searching',
      statusText: 'Looking for a nearby driver',
      driverLocation,
      paymentMethod: paymentMethod?.id ?? 'cash',
      promoCode: activePromo?.code ?? null,
      isShared: isSharedRide,
      createdAt: new Date(),
      sharedWith: isSharedRide && sharedWith.length > 0 ? sharedWith : undefined,
      scheduledTime: scheduledDate && scheduledDate > new Date() ? scheduledDate : undefined,
      driverId: fallbackDriver?.id && isValidUuid(fallbackDriver.id) ? fallbackDriver.id : null,
    };

    let rideId: string;
    try {
      rideId = await DatabaseService.create('rides', rideData);
    } catch (error) {
      const isSupabaseUser = isValidUuid(user.id);
      if (isSupabaseUser) {
        throw error;
      }
      console.warn('Using local ride fallback for non-Supabase user:', error);
      rideId = `local-ride-${Date.now()}`;
    }

    const newRide: RideRequest = {
      id: rideId,
      pickupLocation,
      dropoffLocation,
      pickupAddress,
      dropoffAddress,
      rideType: selectedRideType,
      price: estimatedPrice,
      basePrice: baseEstimatedPrice,
      minPrice: minEstimatedPrice,
      maxPrice: maxEstimatedPrice,
      fareAdjustmentPercent,
      distance: estimatedDistance,
      duration: estimatedDuration,
      status: 'pending',
      trackingStage: 'searching',
      statusText: 'Looking for a nearby driver',
      driver: fallbackDriver,
      driverLocation,
      createdAt: new Date(),
      scheduledFor: scheduledDate ?? undefined,
      paymentMethod: paymentMethod ?? undefined,
      promoCode: activePromo?.code,
      isShared: isSharedRide,
      sharedWith: isSharedRide ? sharedWith : undefined,
    };

    console.log('Created new ride request:', newRide);
    setCurrentRide(newRide);

    if (activePromo) {
      void markPromoAsUsed(activePromo.code);
    }

    if (scheduledDate && scheduledDate > new Date()) {
      const scheduledRide: RideRequest = {
        ...newRide,
        status: 'confirmed',
        trackingStage: 'driver_assigned',
        statusText: 'Your scheduled ride has been locked in',
      };
      setCurrentRide(scheduledRide);
      void savePastRide(scheduledRide);
      return scheduledRide;
    }

    return newRide;
  }, [
    baseEstimatedPrice,
    dropoffAddress,
    dropoffLocation,
    estimatedDistance,
    estimatedDuration,
    estimatedPrice,
    fareAdjustmentPercent,
    getActivePromotion,
    getDefaultPaymentMethod,
    isSharedRide,
    markPromoAsUsed,
    maxEstimatedPrice,
    minEstimatedPrice,
    nearbyDrivers,
    pickupAddress,
    pickupLocation,
    savePastRide,
    scheduledDate,
    selectedPaymentMethod,
    selectedRideType,
    sharedWith,
    user,
  ]);

  const setFareAdjustment = useCallback((adjustmentPercent: number) => {
    const clampedAdjustment = Math.min(10, Math.max(-10, adjustmentPercent));
    console.log('Updating fare adjustment:', { adjustmentPercent: clampedAdjustment });
    setFareAdjustmentPercent(clampedAdjustment);
  }, []);

  const cancelRide = useCallback((reason?: RideCancellationReason, details?: string) => {
    if (!currentRide) {
      return;
    }

    const cancelledRide: RideRequest = {
      ...currentRide,
      status: 'cancelled',
      trackingStage: currentRide.trackingStage,
      cancelReason: reason,
      cancelReasonDetails: details,
      statusText: 'Ride cancelled',
    };
    console.log('Cancelling ride session:', cancelledRide);
    setCurrentRide(null);
    void savePastRide(cancelledRide);
  }, [currentRide, savePastRide]);

  const completeRide = useCallback((): RideRequest | undefined => {
    if (!currentRide) {
      return undefined;
    }

    const completedRide: RideRequest = {
      ...currentRide,
      status: 'completed',
      statusText: 'Trip completed',
    };
    setCurrentRide(null);
    void savePastRide(completedRide);

    return completedRide;
  }, [currentRide, savePastRide]);

  const getSelectedRideType = useCallback((): RideType | undefined => {
    return rideTypes.find((type) => type.id === selectedRideType);
  }, [rideTypes, selectedRideType]);

  const scheduleRide = useCallback((date: Date) => {
    setScheduledDate(date);
  }, []);

  const clearScheduledRide = useCallback(() => {
    setScheduledDate(null);
  }, []);

  const setPaymentMethod = useCallback((method: PaymentMethod) => {
    setSelectedPaymentMethodState(method);
  }, []);

  const toggleSharedRide = useCallback((shared: boolean) => {
    setIsSharedRide(shared);
  }, []);

  const addSharedRidePassenger = useCallback((phoneNumber: string) => {
    setSharedWith((prev) => {
      if (prev.includes(phoneNumber)) {
        return prev;
      }

      return [...prev, phoneNumber];
    });
  }, []);

  const removeSharedRidePassenger = useCallback((phoneNumber: string) => {
    setSharedWith((prev) => prev.filter((value) => value !== phoneNumber));
  }, []);

  return useMemo(() => ({
    nearbyDrivers,
    rideTypes,
    selectedRideType,
    setSelectedRideType,
    currentRide,
    pastRides,
    estimatedPrice,
    baseEstimatedPrice,
    minEstimatedPrice,
    maxEstimatedPrice,
    fareAdjustmentPercent,
    estimatedDistance,
    estimatedDuration,
    scheduledDate,
    isSharedRide,
    sharedWith,
    selectedPaymentMethod,
    isHydratingRide,
    tierPrices,
    requestRide,
    cancelRide,
    completeRide,
    updateRideSession,
    getSelectedRideType,
    scheduleRide,
    clearScheduledRide,
    setPaymentMethod,
    toggleSharedRide,
    addSharedRidePassenger,
    removeSharedRidePassenger,
    surgeMultiplier,
    setSurgeMultiplier,
    setFareAdjustment,
  }), [
    nearbyDrivers,
    rideTypes,
    selectedRideType,
    currentRide,
    pastRides,
    estimatedPrice,
    baseEstimatedPrice,
    minEstimatedPrice,
    maxEstimatedPrice,
    fareAdjustmentPercent,
    estimatedDistance,
    estimatedDuration,
    scheduledDate,
    isSharedRide,
    sharedWith,
    selectedPaymentMethod,
    isHydratingRide,
    tierPrices,
    requestRide,
    cancelRide,
    completeRide,
    updateRideSession,
    getSelectedRideType,
    scheduleRide,
    clearScheduledRide,
    setPaymentMethod,
    toggleSharedRide,
    addSharedRidePassenger,
    removeSharedRidePassenger,
    surgeMultiplier,
    setFareAdjustment,
  ]);
});
