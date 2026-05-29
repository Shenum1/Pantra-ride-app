import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState } from 'react';

export interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  rating: number;
  profileImage?: string;
  driverLicense: string;
  vehicle: {
    make: string;
    model: string;
    year: number;
    licensePlate: string;
    color: string;
  };
  isVerified: boolean;
  isOnline: boolean;
  totalEarnings: number;
  totalRides: number;
}

export interface DriverAuthState {
  driver: Driver | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
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
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<Driver>) => Promise<void>;
  toggleOnlineStatus: () => Promise<void>;
}

const DRIVER_AUTH_STORAGE_KEY = 'driver_auth_user';

export const [DriverAuthProvider, useDriverAuth] = createContextHook(() => {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredDriver();
  }, []);

  const loadStoredDriver = async () => {
    try {
      const storedDriver = await AsyncStorage.getItem(DRIVER_AUTH_STORAGE_KEY);
      if (storedDriver) {
        setDriver(JSON.parse(storedDriver));
      }
    } catch (error) {
      console.error('Error loading stored driver:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveDriver = async (driverData: Driver) => {
    try {
      await AsyncStorage.setItem(DRIVER_AUTH_STORAGE_KEY, JSON.stringify(driverData));
      setDriver(driverData);
    } catch (error) {
      console.error('Error saving driver:', error);
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    console.log('Driver Auth Store: Starting driver login process');
    setIsLoading(true);
    try {
      // Clear any existing user auth first
      await AsyncStorage.removeItem('auth_user');
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock driver data - in real app, this would come from your API
      const driverData: Driver = {
        id: '1',
        name: 'John Driver',
        email,
        phone: '+234 123 456 7890',
        rating: 4.8,
        driverLicense: 'DL123456789',
        vehicle: {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          licensePlate: 'ABC-123',
          color: 'Silver',
        },
        isVerified: true,
        isOnline: false,
        totalEarnings: 15420.50,
        totalRides: 342,
      };
      
      console.log('Driver Auth Store: Saving driver data', driverData);
      await saveDriver(driverData);
      console.log('Driver Auth Store: Login completed successfully');
    } catch (error) {
      console.error('Driver Auth Store: Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (
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
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const driverData: Driver = {
        id: Date.now().toString(),
        name,
        email,
        phone,
        rating: 5.0,
        driverLicense,
        vehicle,
        isVerified: false, // New drivers need verification
        isOnline: false,
        totalEarnings: 0,
        totalRides: 0,
      };
      
      await saveDriver(driverData);
    } catch (error) {
      console.error('Driver signup error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      console.log('Driver Auth Store: Starting logout process');
      await AsyncStorage.removeItem(DRIVER_AUTH_STORAGE_KEY);
      // Also clear user auth to prevent conflicts
      await AsyncStorage.removeItem('auth_user');
      setDriver(null);
      console.log('Driver Auth Store: Logout completed successfully');
    } catch (error) {
      console.error('Driver Auth Store: Logout error:', error);
      throw error;
    }
  };

  const updateProfile = async (updates: Partial<Driver>) => {
    if (!driver) return;
    
    try {
      const updatedDriver = { ...driver, ...updates };
      await saveDriver(updatedDriver);
    } catch (error) {
      console.error('Update driver profile error:', error);
      throw error;
    }
  };

  const toggleOnlineStatus = async () => {
    if (!driver) return;
    
    try {
      const updatedDriver = { ...driver, isOnline: !driver.isOnline };
      await saveDriver(updatedDriver);
    } catch (error) {
      console.error('Toggle online status error:', error);
      throw error;
    }
  };

  return {
    driver,
    isLoading,
    isAuthenticated: !!driver,
    login,
    signup,
    logout,
    updateProfile,
    toggleOnlineStatus,
  };
});