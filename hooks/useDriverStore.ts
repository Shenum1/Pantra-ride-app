import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppState, Platform } from 'react-native';
import * as ExpoLocation from 'expo-location';
import createContextHook from '@nkzw/create-context-hook';
import { DriverProfile, RideRequestForDriver, DriverEarnings, DriverStats } from '@/types';
import { FirebaseDriverService } from '@/lib/firebase-driver-service';
import { NotificationService } from '@/lib/notification-service';
import { useDriverAuth } from './useDriverAuthStore';

export const [DriverStoreProvider, useDriverStore] = createContextHook(() => {
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [rideRequests, setRideRequests] = useState<RideRequestForDriver[]>([]);
  const [currentRide, setCurrentRide] = useState<RideRequestForDriver | null>(null);
  const [earnings, setEarnings] = useState<DriverEarnings[]>([]);
  const [stats, setStats] = useState<DriverStats>({
    totalRides: 0,
    totalEarnings: 0,
    averageRating: null,
    acceptanceRate: 0,
    cancellationRate: 0,
    onlineHours: 0,
    completionRate: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const knownRequestIdsRef = useRef<Set<string>>(new Set());

  const loadDriverData = useCallback(async (driverId: string) => {
    try {
      setIsLoading(true);

      const profile = await FirebaseDriverService.getDriver(driverId);
      if (profile) {
        setDriverProfile(profile);
        setIsOnline(profile.isOnline || false);
      }

      const earningsData = await FirebaseDriverService.getDriverEarnings(driverId);
      setEarnings(earningsData);

      const statsData = await FirebaseDriverService.getDriverStats(driverId);
      setStats(statsData);

      const requests = await FirebaseDriverService.getPendingRideRequests(driverId);
      knownRequestIdsRef.current = new Set(requests.map((r) => r.id).filter((id): id is string => !!id));
      setRideRequests(requests);
    } catch (error) {
      console.error('Error loading driver data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshRideRequests = useCallback(async (driverId: string) => {
    try {
      const requests = await FirebaseDriverService.getPendingRideRequests(driverId);
      knownRequestIdsRef.current = new Set(requests.map((r) => r.id).filter((id): id is string => !!id));
      setRideRequests(requests);
    } catch (error) {
      console.error('Error refreshing ride requests:', error);
    }
  }, []);

  const { driver } = useDriverAuth();
  const activeDriverId = driver?.id;

  useEffect(() => {
    if (activeDriverId) {
      loadDriverData(activeDriverId);

      const unsubscribeProfile = FirebaseDriverService.subscribeToDriverProfile(
        activeDriverId,
        (profile) => {
          if (profile) {
            setDriverProfile(profile);
            setIsOnline(profile.isOnline || false);
          }
        }
      );

      const unsubscribeRequests = FirebaseDriverService.subscribeToRideRequests(
        activeDriverId,
        (requests) => {
          if (isOnline) {
            const newRequests = requests.filter((r) => r.id && !knownRequestIdsRef.current.has(r.id));
            knownRequestIdsRef.current = new Set(requests.map((r) => r.id).filter((id): id is string => !!id));
            setRideRequests(requests);

            newRequests.forEach((request) => {
              void NotificationService.notifyNewRideRequest(
                activeDriverId,
                request.pickupAddress ?? 'a nearby pickup point',
                request.price ?? 0
              );
            });
          }
        }
      );

      return () => {
        unsubscribeProfile();
        unsubscribeRequests();
      };
    }

    setIsLoading(false);
  }, [activeDriverId, isOnline, loadDriverData]);

  // Realtime subscriptions can miss events while the app is backgrounded (mobile OSes
  // commonly suspend WebSocket connections), so a ride created during that window would
  // never appear until something else refetches. Refresh on foreground to close that gap.
  // Deliberately only refreshes ride requests, not the full profile/isOnline — reloading
  // isOnline from a fresh read here could race with an in-flight toggleOnlineStatus call
  // and stomp the just-toggled value back to whatever was last read.
  useEffect(() => {
    if (!activeDriverId) return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshRideRequests(activeDriverId);
      }
    });

    return () => subscription.remove();
  }, [activeDriverId, refreshRideRequests]);

  // Safety net independent of realtime/AppState — poll for pending rides while online.
  // The realtime channel and foreground-refetch above should normally be enough, but
  // both depend on triggers (a live socket, a true OS-level background/foreground
  // transition) that have proven unreliable in practice. Polling guarantees a new ride
  // surfaces within a bounded time regardless of which of those mechanisms is flaky.
  // Same as above: only refreshes ride requests, never isOnline/driverProfile.
  useEffect(() => {
    if (!activeDriverId || !isOnline) return;

    const interval = setInterval(() => {
      refreshRideRequests(activeDriverId);
    }, 8000);

    return () => clearInterval(interval);
  }, [activeDriverId, isOnline, refreshRideRequests]);

  const updateDriverProfile = useCallback(async (updates: Partial<DriverProfile>) => {
    if (!driverProfile) return;

    try {
      await FirebaseDriverService.updateDriver(driverProfile.id, updates);
    } catch (error) {
      console.error('Error updating driver profile:', error);
    }
  }, [driverProfile]);

  const toggleOnlineStatus = useCallback(async () => {
    try {
      if (!driverProfile) return;

      const newStatus = !isOnline;
      await FirebaseDriverService.setDriverOnlineStatus(driverProfile.id, newStatus);
      setIsOnline(newStatus);

      if (!newStatus) {
        setRideRequests([]);
        setCurrentRide(null);
      } else {
        const requests = await FirebaseDriverService.getPendingRideRequests(driverProfile.id);
        knownRequestIdsRef.current = new Set(requests.map((r) => r.id).filter((id): id is string => !!id));
        setRideRequests(requests);
      }
    } catch (error) {
      console.error('Error toggling online status:', error);
      return;
    }

    // Online-session tracking only feeds DriverStats.onlineHours — it must never
    // block the toggle above, which is what actually lets the driver see/take rides.
    try {
      if (!driverProfile) return;
      if (!isOnline) {
        await FirebaseDriverService.startOnlineSession(driverProfile.id);
      } else {
        await FirebaseDriverService.endOnlineSession(driverProfile.id);
      }
    } catch (error) {
      console.error('Error tracking online session:', error);
    }
  }, [isOnline, driverProfile]);

  const acceptRideRequest = useCallback(async (rideId: string) => {
    try {
      if (!driverProfile) return;

      const ride = rideRequests.find(r => r.id === rideId);
      if (!ride) return;

      await FirebaseDriverService.acceptRide(rideId, driverProfile.id);
      setCurrentRide({ ...ride, status: 'confirmed' });
      setRideRequests(prev => prev.filter(r => r.id !== rideId));
      
      console.log('Ride accepted:', rideId);
    } catch (error) {
      console.error('Error accepting ride:', error);
      throw error;
    }
  }, [rideRequests, driverProfile]);

  const declineRideRequest = useCallback(async (rideId: string) => {
    try {
      if (!driverProfile) return;

      await FirebaseDriverService.declineRide(rideId, driverProfile.id);
      setRideRequests(prev => prev.filter(r => r.id !== rideId));

      console.log('Ride declined:', rideId);
    } catch (error) {
      console.error('Error declining ride:', error);
    }
  }, [driverProfile]);

  const updateRideStatus = useCallback(async (status: 'in_progress' | 'completed' | 'cancelled') => {
    try {
      if (!currentRide || !driverProfile) return;

      await FirebaseDriverService.updateRideStatus(currentRide.id!, status, driverProfile.id);

      if (status === 'completed' || status === 'cancelled') {
        if (status === 'completed' && driverProfile) {
          const earningsData = await FirebaseDriverService.getDriverEarnings(driverProfile.id);
          setEarnings(earningsData);

          const statsData = await FirebaseDriverService.getDriverStats(driverProfile.id);
          setStats(statsData);
        }

        setCurrentRide(null);
      } else {
        setCurrentRide({ ...currentRide, status });
      }

      console.log('Ride status updated:', status);
    } catch (error) {
      console.error('Error updating ride status:', error);
    }
  }, [currentRide, driverProfile]);

  const updateLocation = useCallback(async (latitude: number, longitude: number) => {
    try {
      if (driverProfile) {
        await FirebaseDriverService.updateDriverLocation(driverProfile.id, latitude, longitude);
      }
    } catch (error) {
      console.error('Error updating location:', error);
    }
  }, [driverProfile]);

  // GPS tracking used to live only inside app/(driver-tabs)/trips.tsx's effects, so
  // drivers.location was never written unless the driver happened to have the Trips
  // screen mounted while online — e.g. toggling online from Dashboard and backgrounding
  // the app before visiting Trips left location permanently null, which silently made
  // getPendingRideRequests()/subscribeToRideRequests() return nothing (both bail out on
  // !driver.location). Tracking here instead runs whenever the driver is online, app-wide.
  useEffect(() => {
    if (Platform.OS === 'web' || !activeDriverId || !isOnline) return;

    let cancelled = false;
    let subscription: ExpoLocation.LocationSubscription | null = null;

    (async () => {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      const initial = await ExpoLocation.getCurrentPositionAsync({});
      if (cancelled) return;
      void updateLocation(initial.coords.latitude, initial.coords.longitude);

      subscription = await ExpoLocation.watchPositionAsync(
        { accuracy: ExpoLocation.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
        (location) => {
          void updateLocation(location.coords.latitude, location.coords.longitude);
        }
      );
      if (cancelled) subscription.remove();
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [activeDriverId, isOnline, updateLocation]);

  return useMemo(() => ({
    driverProfile,
    rideRequests,
    currentRide,
    earnings,
    stats,
    isLoading,
    isOnline,
    updateDriverProfile,
    toggleOnlineStatus,
    acceptRideRequest,
    declineRideRequest,
    updateRideStatus,
    updateLocation,
    loadDriverData,
  }), [
    driverProfile,
    rideRequests,
    currentRide,
    earnings,
    stats,
    isLoading,
    isOnline,
    updateDriverProfile,
    toggleOnlineStatus,
    acceptRideRequest,
    declineRideRequest,
    updateRideStatus,
    updateLocation,
    loadDriverData,
  ]);
});