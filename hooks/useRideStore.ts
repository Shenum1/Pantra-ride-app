import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { mockRideTypes } from '@/mocks/rideTypes';
import { Location, PaymentMethod, RideCancellationReason, RideRequest, RideTrackingStage, RideType } from '@/types';
import { calculateFareBreakdown, calculateAllTierFares, applyRideDiscounts } from '@/lib/fare-calculator';
import { calculateCancellationFee } from '@/lib/cancellation-calculator';
import { calculateSurgeMultiplier } from '@/lib/surge-calculator';
import { SHARED_RIDE_DISCOUNT_MULTIPLIER } from '@/lib/pricing-config';
import { useLocation } from './useLocationStore';
import { usePayment } from './usePaymentStore';
import { usePromotions } from './usePromotionsStore';
import { FirebaseDriverService } from '@/lib/firebase-driver-service';
import { RideHistoryService } from '@/lib/ride-history-service';
import { DatabaseService } from '@/lib/database-service';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuthStore';
import { trpcClient } from '@/lib/trpc';

const isValidUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

interface FareBounds {
  basePrice: number;
  minPrice: number;
  maxPrice: number;
  adjustedPrice: number;
}

const ACTIVE_RIDE_STORAGE_PREFIX = 'active_ride_session_v2';
const getActiveRideStorageKey = (userId: string) => `${ACTIVE_RIDE_STORAGE_PREFIX}:${userId}`;

interface SerializedRideRequest extends Omit<RideRequest, 'createdAt' | 'scheduledFor' | 'arrivedAt' | 'offerExpiresAt'> {
  createdAt?: string;
  scheduledFor?: string;
  arrivedAt?: string;
  offerExpiresAt?: string;
}

function serializeRide(ride: RideRequest): SerializedRideRequest {
  return {
    ...ride,
    createdAt: ride.createdAt?.toISOString(),
    scheduledFor: ride.scheduledFor?.toISOString(),
    arrivedAt: ride.arrivedAt?.toISOString(),
    offerExpiresAt: ride.offerExpiresAt?.toISOString(),
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
    arrivedAt: ride.arrivedAt ? new Date(ride.arrivedAt) : undefined,
    offerExpiresAt: ride.offerExpiresAt ? new Date(ride.offerExpiresAt) : undefined,
  };
}

export const [RideProvider, useRide] = createContextHook(() => {
  const { pickupLocation, dropoffLocation, pickupAddress, dropoffAddress, routeInfo } = useLocation();
  const { getDefaultPaymentMethod } = usePayment();
  const { getActivePromotion, markPromoAsUsed } = usePromotions();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [selectedRideType, setSelectedRideType] = useState<string>('standard');
  const [currentRide, setCurrentRide] = useState<RideRequest | null>(null);
  const [pastRides, setPastRides] = useState<RideRequest[]>([]);
  const [isLoadingPastRides, setIsLoadingPastRides] = useState<boolean>(true);
  const [estimatedPrice, setEstimatedPrice] = useState<number>(0);
  const [baseEstimatedPrice, setBaseEstimatedPrice] = useState<number>(0);
  const [minEstimatedPrice, setMinEstimatedPrice] = useState<number>(0);
  const [maxEstimatedPrice, setMaxEstimatedPrice] = useState<number>(0);
  const [estimatedBookingFee, setEstimatedBookingFee] = useState<number>(0);
  const [estimatedServiceFee, setEstimatedServiceFee] = useState<number>(0);
  const [estimatedZoneFee, setEstimatedZoneFee] = useState<number>(0);
  const [zoneFee, setZoneFee] = useState<number>(0);
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

  // Computed on demand from two plain counts, no background job or geospatial
  // indexing — only runs while the rider actually has a pickup location set
  // (i.e. actively looking at a fare estimate), refreshed periodically.
  const { data: liveSurgeMultiplier } = useQuery({
    queryKey: ['surgeMultiplier'],
    queryFn: async () => {
      const [onlineDriversResult, pendingRidesResult, surgeConfigResult] = await Promise.all([
        supabase.from('drivers').select('id', { count: 'exact', head: true }).eq('isOnline', true),
        supabase.from('rides').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('surge_config').select('*').limit(1).maybeSingle(),
      ]);

      const config = surgeConfigResult.data;
      if (!config) {
        return 1;
      }

      return calculateSurgeMultiplier(onlineDriversResult.count ?? 0, pendingRidesResult.count ?? 0, {
        minMultiplier: Number(config.minMultiplier),
        maxMultiplier: Number(config.maxMultiplier),
        highDemandRatio: Number(config.highDemandRatio),
        lowDemandRatio: Number(config.lowDemandRatio),
        isEnabled: !!config.isEnabled,
      });
    },
    enabled: !!pickupLocation,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (liveSurgeMultiplier !== undefined) {
      setSurgeMultiplier(liveSurgeMultiplier);
    }
  }, [liveSurgeMultiplier]);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    const userId = user?.id;

    if (!userId) {
      setCurrentRide(null);
      setIsHydratingRide(false);
      return;
    }

    let cancelled = false;

    const loadStoredRide = async () => {
      try {
        const storedRide = await AsyncStorage.getItem(getActiveRideStorageKey(userId));
        if (!storedRide) {
          return;
        }

        const parsedRide = JSON.parse(storedRide) as SerializedRideRequest;
        const hydratedRide = deserializeRide(parsedRide);

        // Local ride IDs (test/non-Supabase accounts) never exist as a real DB row —
        // trust the local snapshot as-is. Otherwise, re-validate against the server
        // before restoring it: a ride that finished/was cancelled in a previous
        // session (or an app crash) must not resurrect a stuck "loading" screen.
        if (hydratedRide.id && !hydratedRide.id.startsWith('local-ride-')) {
          const row: any = await DatabaseService.get('rides', hydratedRide.id);
          const isTerminal = row?.status === 'completed' || row?.status === 'cancelled';
          if (!row || row.userId !== userId || isTerminal) {
            await AsyncStorage.removeItem(getActiveRideStorageKey(userId));
            return;
          }
        }

        if (!cancelled) {
          console.log('Hydrated active ride session:', hydratedRide);
          setCurrentRide(hydratedRide);
        }
      } catch (error) {
        console.error('Error hydrating stored ride session:', error);
      } finally {
        if (!cancelled) {
          setIsHydratingRide(false);
        }
      }
    };

    setIsHydratingRide(true);
    void loadStoredRide();

    return () => {
      cancelled = true;
    };
  }, [user?.id, isAuthLoading]);

  useEffect(() => {
    currentRideRef.current = currentRide;
  }, [currentRide]);

  useEffect(() => {
    if (isHydratingRide || !user?.id) {
      return;
    }

    const userId = user.id;

    const persistRide = async () => {
      try {
        if (!currentRide) {
          await AsyncStorage.removeItem(getActiveRideStorageKey(userId));
          return;
        }

        await AsyncStorage.setItem(getActiveRideStorageKey(userId), JSON.stringify(serializeRide(currentRide)));
      } catch (error) {
        console.error('Error persisting current ride session:', error);
      }
    };

    void persistRide();
  }, [currentRide, isHydratingRide, user?.id]);

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
    if (!user) {
      setIsLoadingPastRides(false);
      return;
    }

    try {
      const rides = await RideHistoryService.getUserRides(user.id, undefined, 50);
      setPastRides(rides.map(mapRideToRequest));
    } catch (error) {
      console.error('Error loading past rides:', error);
    } finally {
      setIsLoadingPastRides(false);
    }
  }, [mapRideToRequest, user]);

  useEffect(() => {
    if (user) {
      void loadPastRides();
    } else {
      setIsLoadingPastRides(false);
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

  // Rider fare adjustment (the ±10% slider) is, like promo/shared-ride, a
  // discount applied to the metered fare only — never to flat platform fees.
  const updateEstimatedFare = useCallback((
    discountedMeteredFare: number,
    distanceKm: number,
    durationMinutes: number,
    bookingFee: number,
    serviceFee: number,
    zoneFeeAmount: number
  ) => {
    const adjustedFare = applyFareAdjustment(discountedMeteredFare, fareAdjustmentPercent);

    console.log('Updating fare estimate:', {
      discountedMeteredFare,
      adjustedFare,
      distanceKm,
      durationMinutes,
      fareAdjustmentPercent,
      bookingFee,
      serviceFee,
      zoneFeeAmount,
    });

    setEstimatedDistance(parseFloat(distanceKm.toFixed(1)));
    setEstimatedDuration(Math.round(durationMinutes));
    setBaseEstimatedPrice(adjustedFare.basePrice);
    setMinEstimatedPrice(adjustedFare.minPrice);
    setMaxEstimatedPrice(adjustedFare.maxPrice);
    setEstimatedBookingFee(bookingFee);
    setEstimatedServiceFee(serviceFee);
    setEstimatedZoneFee(zoneFeeAmount);
    // Final amount payable = discounted/negotiated metered fare + undiscounted flat fees.
    setEstimatedPrice(adjustedFare.adjustedPrice + bookingFee + serviceFee + zoneFeeAmount);
  }, [applyFareAdjustment, fareAdjustmentPercent]);

  const calculatePriceFromRoute = useCallback((
    distanceMeters: number,
    durationSeconds: number,
    rideTypeId: string
  ) => {
    const distanceKm = distanceMeters / 1000;
    const durationMinutes = durationSeconds / 60;

    const breakdown = calculateFareBreakdown(distanceKm, durationMinutes, rideTypeId, surgeMultiplier, zoneFee);
    setTierPrices(calculateAllTierFares(distanceKm, durationMinutes, surgeMultiplier));

    const activePromo = getActivePromotion();
    const discountedMetered = applyRideDiscounts(breakdown.meteredSubtotal, rideTypeId, {
      sharedRideDiscountMultiplier: isSharedRide ? SHARED_RIDE_DISCOUNT_MULTIPLIER : 1,
      promo: activePromo
        ? { discountPercentage: activePromo.discountPercentage, maxDiscountNGN: activePromo.maxDiscountNGN }
        : null,
    });

    updateEstimatedFare(discountedMetered, distanceKm, durationMinutes, breakdown.bookingFee, breakdown.serviceFee, breakdown.zoneFee);
  }, [fareAdjustmentPercent, getActivePromotion, isSharedRide, surgeMultiplier, updateEstimatedFare, zoneFee]);

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

    const breakdown = calculateFareBreakdown(distanceKm, durationMinutes, rideTypeId, surgeMultiplier, zoneFee);
    setTierPrices(calculateAllTierFares(distanceKm, durationMinutes, surgeMultiplier));

    const activePromo = getActivePromotion();
    const discountedMetered = applyRideDiscounts(breakdown.meteredSubtotal, rideTypeId, {
      sharedRideDiscountMultiplier: isSharedRide ? SHARED_RIDE_DISCOUNT_MULTIPLIER : 1,
      promo: activePromo
        ? { discountPercentage: activePromo.discountPercentage, maxDiscountNGN: activePromo.maxDiscountNGN }
        : null,
    });

    updateEstimatedFare(discountedMetered, distanceKm, durationMinutes, breakdown.bookingFee, breakdown.serviceFee, breakdown.zoneFee);
  }, [getActivePromotion, isSharedRide, surgeMultiplier, updateEstimatedFare, zoneFee]);

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
          // Both terminal states (cancel/complete) carry a final, authoritative
          // `price` by this point — cancelRide() sets it to the cancellation
          // fee, and the completed-ride path refetches the server fare
          // (including any waiting charge) before calling completeRide().
          fare: ride.price ?? 0,
          cancellationFee: ride.cancellationFee ?? 0,
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

    // Capture arrival time exactly once, the moment tracking first reaches
    // 'driver_arrived' — needed to later compute a waiting charge. Guarded so
    // repeated updates (GPS jitter, re-renders) never reset an already-set time.
    const arrivedAt = !activeRide.arrivedAt && updates.trackingStage === 'driver_arrived'
      ? new Date()
      : activeRide.arrivedAt;

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
      arrivedAt,
    };

    console.log('Updating active ride session:', mergedRide);
    setCurrentRide(mergedRide);

    if (mergedRide.id) {
      try {
        // Deliberately NOT writing `fare` here: no caller of updateRideSession
        // ever changes `price`, so this would always just rewrite the original
        // client-side estimate — and could clobber server-authoritative fare
        // updates (e.g. the driver-side waiting-charge addition in
        // FirebaseDriverService.updateRideStatus) if this fires around the
        // same time. Fare changes belong exclusively to requestRide() (initial)
        // and driver/admin-authoritative server updates from then on.
        await DatabaseService.update('rides', mergedRide.id, {
          status: mergedRide.status ?? 'pending',
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
          arrivedAt: mergedRide.arrivedAt ? mergedRide.arrivedAt.toISOString() : null,
        });
      } catch (error) {
        console.error('Error syncing ride session update:', error);
      }
    }

    return mergedRide;
  }, []);

  // offeredFare (optional): a rider-proposed price from the negotiation preset
  // picker. Reuses the exact same pull-model broadcast as a normal ride — the
  // ride is still visible to any online driver, just carrying an extra
  // proposed amount alongside the metered reference fare. `fare` stays the
  // metered reference until a driver accepts (see FirebaseDriverService.acceptRide,
  // which overwrites it to offeredFare at that point).
  const requestRide = useCallback(async (offeredFare?: number, passengerName?: string, passengerPhone?: string) => {
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

    const hasOffer = offeredFare !== undefined && offeredFare !== estimatedPrice;
    const offerExpiresAt = hasOffer ? new Date(Date.now() + 60_000) : undefined;

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
      bookingFee: estimatedBookingFee,
      serviceFee: estimatedServiceFee,
      zoneFee: estimatedZoneFee,
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
      offeredFare: hasOffer ? offeredFare : null,
      negotiationStatus: hasOffer ? 'pending' : null,
      offerExpiresAt: hasOffer ? offerExpiresAt!.toISOString() : null,
      passengerName: passengerName || null,
      passengerPhone: passengerPhone || null,
    };

    let rideId: string;
    try {
      rideId = await DatabaseService.create('rides', rideData);

      // Notify all online drivers via remote push so they receive the request
      // even if their app is backgrounded or the screen is locked.
      void trpcClient.notifications.notifyDrivers.mutate({
        pickupAddress: rideData.pickupAddress,
        fare: rideData.fare,
        rideId,
      }).catch((error) => {
        console.error('Failed to notify drivers of new ride:', error);
      });
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
      bookingFee: estimatedBookingFee,
      serviceFee: estimatedServiceFee,
      zoneFee: estimatedZoneFee,
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
      offeredFare: hasOffer ? offeredFare : undefined,
      negotiationStatus: hasOffer ? 'pending' : undefined,
      offerExpiresAt: hasOffer ? offerExpiresAt : undefined,
      passengerName: passengerName || undefined,
      passengerPhone: passengerPhone || undefined,
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
    estimatedBookingFee,
    estimatedServiceFee,
    estimatedZoneFee,
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

  const cancelRide = useCallback(async (reason?: RideCancellationReason, details?: string) => {
    if (!currentRide) {
      return;
    }

    // Compute the cancellation fee from server-authoritative timestamps —
    // acceptedAt/arrivedAt are never reliably present on local state, so this
    // reads the real row rather than trusting whatever currentRide has.
    let cancellationFee = 0;
    if (currentRide.id && !currentRide.id.startsWith('local-ride-')) {
      try {
        const row = await DatabaseService.get('rides', currentRide.id) as
          | { status?: string; acceptedAt?: string; arrivedAt?: string }
          | null;
        if (row) {
          cancellationFee = calculateCancellationFee({
            status: row.status,
            acceptedAt: row.acceptedAt,
            arrivedAt: row.arrivedAt,
          }).fee;
        }
      } catch (error) {
        console.error('Error computing cancellation fee:', error);
      }
    }

    const cancelledRide: RideRequest = {
      ...currentRide,
      status: 'cancelled',
      trackingStage: currentRide.trackingStage,
      cancelReason: reason,
      cancelReasonDetails: details,
      statusText: 'Ride cancelled',
      cancellationFee,
      // A cancelled ride's payable amount IS the cancellation fee (0 if free)
      // — the original trip was never actually taken.
      price: cancellationFee,
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
    isLoadingPastRides,
    estimatedPrice,
    baseEstimatedPrice,
    minEstimatedPrice,
    maxEstimatedPrice,
    estimatedBookingFee,
    estimatedServiceFee,
    estimatedZoneFee,
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
    zoneFee,
    setZoneFee,
  }), [
    nearbyDrivers,
    rideTypes,
    selectedRideType,
    currentRide,
    pastRides,
    isLoadingPastRides,
    estimatedPrice,
    baseEstimatedPrice,
    minEstimatedPrice,
    maxEstimatedPrice,
    estimatedBookingFee,
    estimatedServiceFee,
    estimatedZoneFee,
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
    zoneFee,
  ]);
});
