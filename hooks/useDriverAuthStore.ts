import { useState, useEffect, useCallback, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { DriverAuthService, DriverRow } from '@/lib/driver-auth-service';
import { FirebaseDriverService } from '@/lib/firebase-driver-service';

export type Driver = DriverRow;

export const [DriverAuthProvider, useDriverAuth] = createContextHook(() => {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      console.warn('DriverAuth: timeout — forcing isLoading false');
      setIsLoading(false);
    }, 5000);

    const unsubscribe = DriverAuthService.onAuthStateChanged((d) => {
      clearTimeout(timeout);
      setDriver(d);
      setIsLoading(false);
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const d = await DriverAuthService.signInWithEmail(email, password);
      setDriver(d);
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
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setDriver(null);
    try {
      await DriverAuthService.signOut();
    } catch (e) {
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
