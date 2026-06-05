import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { DriverAuthService, DriverRow } from '@/lib/driver-auth-service';
import { FirebaseDriverService } from '@/lib/firebase-driver-service';

export type Driver = DriverRow;

const DRIVER_STORAGE_KEY = 'driver_auth_user';

export const [DriverAuthProvider, useDriverAuth] = createContextHook(() => {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load cached driver from AsyncStorage immediately — no network needed
    const loadStoredDriver = async () => {
      try {
        const stored = await AsyncStorage.getItem(DRIVER_STORAGE_KEY);
        if (stored) setDriver(JSON.parse(stored) as Driver);
      } catch {
        // ignore read errors
      } finally {
        setIsLoading(false);
      }
    };
    void loadStoredDriver();

    // Keep in sync with live Supabase session in the background
    const unsubscribe = DriverAuthService.onAuthStateChanged((d) => {
      setDriver(d);
      if (d) {
        AsyncStorage.setItem(DRIVER_STORAGE_KEY, JSON.stringify(d)).catch(() => {});
      } else {
        AsyncStorage.removeItem(DRIVER_STORAGE_KEY).catch(() => {});
      }
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const d = await DriverAuthService.signInWithEmail(email, password);
      setDriver(d);
      await AsyncStorage.setItem(DRIVER_STORAGE_KEY, JSON.stringify(d));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signup = useCallback(async (
    name: string,
    email: string,
    phone: string,
    password: string,
    driverLicense: string,
    vehicle: {
      make: string;
      model: string;
      year: number;
      licensePlate: string;
      color: string;
    }
  ) => {
    setIsLoading(true);
    try {
      const d = await DriverAuthService.signUpWithEmail({ name, email, phone, password, driverLicense, vehicle });
      setDriver(d);
      await AsyncStorage.setItem(DRIVER_STORAGE_KEY, JSON.stringify(d));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(DRIVER_STORAGE_KEY);
    setDriver(null);
    try {
      await DriverAuthService.signOut();
    } catch {
      // session may already be expired or network unavailable — local state is cleared
    }
  }, []);

  const toggleOnlineStatus = useCallback(async () => {
    if (!driver) return;
    const newStatus = !driver.isOnline;
    await FirebaseDriverService.setDriverOnlineStatus(driver.id, newStatus);
    setDriver({ ...driver, isOnline: newStatus });
  }, [driver]);

  const updateProfile = useCallback(async (updates: Partial<Driver>) => {
    if (!driver) return;
    await FirebaseDriverService.updateDriver(driver.id, updates as any);
    setDriver({ ...driver, ...updates });
  }, [driver]);

  return useMemo(() => ({
    driver,
    isLoading,
    isAuthenticated: !!driver,
    login,
    signup,
    logout,
    updateProfile,
    toggleOnlineStatus,
  }), [driver, isLoading, login, signup, logout, updateProfile, toggleOnlineStatus]);
});
