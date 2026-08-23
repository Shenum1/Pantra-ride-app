import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { useState, useEffect, useCallback, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { DriverAuthService, DriverRow } from '@/lib/driver-auth-service';
import { FirebaseDriverService } from '@/lib/firebase-driver-service';
import { supabase } from '@/lib/supabase';
import { StorageService } from '@/lib/storage-service';

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
    password: string
  ) => {
    setIsLoading(true);
    try {
      const d = await DriverAuthService.signUpWithEmail({ name, email, phone, password });
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
    try {
      await FirebaseDriverService.setDriverOnlineStatus(driver.id, newStatus);
      setDriver({ ...driver, isOnline: newStatus });
    } catch (error: any) {
      // Actual security boundary is the enforce_driver_verified_before_online
      // Postgres trigger — this just turns its raw error into something readable.
      if (typeof error?.message === 'string' && error.message.includes('must be VERIFIED')) {
        Alert.alert('Verification Required', 'You must be a fully verified driver before going online.');
        return;
      }
      throw error;
    }
  }, [driver]);

  const updateProfile = useCallback(async (updates: Partial<Driver>) => {
    if (!driver) return;
    await FirebaseDriverService.updateDriver(driver.id, updates as any);
    setDriver({ ...driver, ...updates });
  }, [driver]);

  // Writes directly to the `drivers` Supabase row (not FirebaseDriverService)
  // because that's where the driver record — and profileImage specifically —
  // is actually read from (see lib/driver-auth-service.ts's mapRowToDriver).
  // "Driver can update own row" RLS policy allows this column; it is not one of
  // the verification fields locked by the protect_driver_verification_columns trigger.
  const updateProfileImage = useCallback(async (uri: string) => {
    if (!driver) return;
    const publicUrl = await StorageService.uploadImage(`drivers/${driver.id}.jpg`, uri);
    const { error } = await supabase.from('drivers').update({ profileImage: publicUrl }).eq('id', driver.id);
    if (error) throw new Error(error.message);
    const updated = { ...driver, profileImage: publicUrl };
    setDriver(updated);
    await AsyncStorage.setItem(DRIVER_STORAGE_KEY, JSON.stringify(updated));
  }, [driver]);

  return useMemo(() => ({
    driver,
    isLoading,
    isAuthenticated: !!driver,
    login,
    signup,
    logout,
    updateProfile,
    updateProfileImage,
    toggleOnlineStatus,
  }), [driver, isLoading, login, signup, logout, updateProfile, updateProfileImage, toggleOnlineStatus]);
});
