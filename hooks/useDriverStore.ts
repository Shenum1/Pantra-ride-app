import { useState, useEffect, useCallback, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { DriverProfile, RideRequestForDriver, DriverEarnings, DriverStats } from '@/types';
import { FirebaseDriverService } from '@/lib/firebase-driver-service';
import { useDriverAuth } from './useDriverAuthStore';

export const [DriverStoreProvider, useDriverStore] = createContextHook(() => {
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [rideRequests, setRideRequests] = useState<RideRequestForDriver[]>([]);
  const [currentRide, setCurrentRide] = useState<RideRequestForDriver | null>(null);
  const [earnings, setEarnings] = useState<DriverEarnings[]>([]);
  const [stats, setStats] = useState<DriverStats>({
    totalRides: 0,
    totalEarnings: 0,
    averageRating: 5.0,
    acceptanceRate: 0,
    cancellationRate: 0,
    onlineHours: 0,
    completionRate: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);

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
      setRideRequests(requests);
    } catch (error) {
      console.error('Error loading driver data:', error);
    } finally {
      setIsLoading(false);
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
            setRideRequests(requests);
          }
        }
      );

      return () => {
        unsubscribeProfile();
        unsubscribeRequests();
      };
    }
  }, [activeDriverId, isOnline, loadDriverData]);

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

      if (!newStatus) {
        setRideRequests([]);
        setCurrentRide(null);
      } else {
        const requests = await FirebaseDriverService.getPendingRideRequests(driverProfile.id);
        setRideRequests(requests);
      }
    } catch (error) {
      console.error('Error toggling online status:', error);
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
    }
  }, [rideRequests, driverProfile]);

  const declineRideRequest = useCallback(async (rideId: string) => {
    try {
      await FirebaseDriverService.declineRide(rideId);
      setRideRequests(prev => prev.filter(r => r.id !== rideId));
      
      console.log('Ride declined:', rideId);
    } catch (error) {
      console.error('Error declining ride:', error);
    }
  }, []);

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