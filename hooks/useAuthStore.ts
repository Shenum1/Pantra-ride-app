import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState } from 'react';
import { AuthService } from '@/lib/auth-service';
import { supabase } from '@/lib/supabase';
import Toast from 'react-native-toast-message';
import { DeviceSecurityService } from '@/lib/device-security-service';
import { StorageService } from '@/lib/storage-service';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  rating: number;
  profileImage?: string;
  authProvider?: 'email' | 'google' | 'phone';
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, phone: string, password: string, profileImage?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithPhone: (phoneNumber: string) => Promise<void>;
  verifyPhoneCode: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  googlePromptAsync: (() => Promise<void>) | null;
}

const AUTH_STORAGE_KEY = 'auth_user';
const TEST_RIDER_EMAIL = 'rider@test.com';
const TEST_RIDER_PASSWORD = 'test123';

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingPhoneNumber, setPendingPhoneNumber] = useState<string | null>(null);

  useEffect(() => {
    loadStoredUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('Auth Store: Supabase auth state changed:', session?.user?.id);

      if (!session?.user) {
        const storedUser = await AsyncStorage.getItem(AUTH_STORAGE_KEY).catch(() => null);
        if (storedUser) {
          const parsed = JSON.parse(storedUser) as User;
          if (parsed.id === 'test-rider') {
            setUser(parsed);
            setIsLoading(false);
            return;
          }
        }
        await AsyncStorage.removeItem(AUTH_STORAGE_KEY).catch(() => {});
        setUser(null);
        setIsLoading(false);
        return;
      }

      try {
        const profile = await AuthService.getUserProfile(session.user.id);
        const userData: User = {
          id: session.user.id,
          name: profile?.displayName || session.user.email?.split('@')[0] || 'User',
          email: session.user.email || '',
          phone: profile?.phoneNumber || '',
          rating: 5.0,
          profileImage: profile?.photoURL,
          authProvider: 'email',
        };
        await saveUser(userData);
      } catch {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadStoredUser = async () => {
    try {
      const storedUser = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (storedUser) setUser(JSON.parse(storedUser));
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const saveUser = async (userData: User) => {
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
    setUser(userData);
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      if (!email || !password) throw new Error('Please enter both email and password');
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) throw new Error('Please enter a valid email address.');

      await AsyncStorage.removeItem('driver_auth_user');

      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail === TEST_RIDER_EMAIL && password === TEST_RIDER_PASSWORD) {
        const testUserData: User = {
          id: 'test-rider', name: 'Test Rider', email: TEST_RIDER_EMAIL,
          phone: '+234 123 456 7890', rating: 5.0, authProvider: 'email',
        };
        await saveUser(testUserData);
        Toast.show({ type: 'success', text1: 'Welcome back!', text2: 'Logged in as Test Rider', position: 'top' });
        return;
      }

      const supabaseUser = await AuthService.signInWithEmail(email, password);
      if (!supabaseUser) throw new Error('Login failed — no user returned');

      let profile = await AuthService.getUserProfile(supabaseUser.id);
      if (!profile) {
        await AuthService.createMissingUserProfile(supabaseUser.id, email, supabaseUser.email?.split('@')[0] || 'User', 'rider');
        profile = await AuthService.getUserProfile(supabaseUser.id);
      }

      const userData: User = {
        id: supabaseUser.id,
        name: profile?.displayName || supabaseUser.email?.split('@')[0] || 'User',
        email: supabaseUser.email || email,
        phone: profile?.phoneNumber || '',
        rating: 5.0,
        profileImage: profile?.photoURL,
        authProvider: 'email',
      };
      await saveUser(userData);
      Toast.show({ type: 'success', text1: 'Welcome back!', text2: `Logged in as ${userData.name}`, position: 'top' });
    } catch (error: any) {
      const msg = error.message || 'Login failed. Please try again.';
      Toast.show({ type: 'error', text1: 'Login Failed', text2: msg, position: 'top', visibilityTime: 5000 });
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (name: string, email: string, phone: string, password: string, profileImage?: string) => {
    setIsLoading(true);
    try {
      const deviceFingerprint = await DeviceSecurityService.generateDeviceFingerprint();

      const supabaseUser = await AuthService.signUpWithEmail(email, password, name, 'rider');

      try {
        await DeviceSecurityService.registerDevice(deviceFingerprint, supabaseUser.id);
      } catch {
        console.warn('Device registration skipped');
      }

      let storedProfileImage = profileImage;
      if (profileImage && !profileImage.startsWith('http')) {
        const extension = profileImage.split('.').pop()?.split('?')[0] ?? 'jpg';
        storedProfileImage = await StorageService.uploadImage(`users/${supabaseUser.id}/profile.${extension}`, profileImage);
      }

      await AuthService.updateUserProfile(supabaseUser.id, { phoneNumber: phone, photoURL: storedProfileImage } as any);

      const userData: User = {
        id: supabaseUser.id, name, email, phone, rating: 5.0,
        profileImage: storedProfileImage, authProvider: 'email',
      };
      await saveUser(userData);
      Toast.show({ type: 'success', text1: 'Account Created!', text2: 'Welcome to the platform', position: 'top' });
    } catch (error: any) {
      const msg = error.message || 'Signup failed. Please try again.';
      Toast.show({ type: 'error', text1: 'Signup Failed', text2: msg, position: 'top', visibilityTime: 4000 });
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await AuthService.signOut();
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      await AsyncStorage.removeItem('driver_auth_user');
      setUser(null);
      Toast.show({ type: 'success', text1: 'Logged Out', text2: 'See you soon!', position: 'top' });
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Logout Failed', text2: error.message, position: 'top' });
      throw error;
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) return;

    if (user.id.startsWith('test-')) {
      await saveUser({ ...user, ...updates });
      return;
    }

    let nextProfileImage = updates.profileImage;
    if (nextProfileImage && !nextProfileImage.startsWith('http')) {
      const extension = nextProfileImage.split('.').pop()?.split('?')[0] ?? 'jpg';
      nextProfileImage = await StorageService.uploadImage(`users/${user.id}/profile.${extension}`, nextProfileImage);
    }

    const updatedUser = { ...user, ...updates, profileImage: nextProfileImage ?? updates.profileImage ?? user.profileImage };
    await AuthService.updateUserProfile(user.id, {
      displayName: updatedUser.name,
      phoneNumber: updatedUser.phone,
      photoURL: updatedUser.profileImage,
    } as any);
    await saveUser(updatedUser);
  };

  const loginWithGoogle = async () => {
    throw new Error('Google authentication is not yet configured. Please use email login instead.');
  };

  const loginWithPhone = async (phoneNumber: string) => {
    setIsLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 1000));
      setPendingPhoneNumber(phoneNumber);
      Toast.show({ type: 'success', text1: 'Verification Code Sent', text2: 'Please check your phone', position: 'top' });
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Phone Login Failed', text2: error.message, position: 'top' });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyPhoneCode = async (code: string) => {
    if (!pendingPhoneNumber) throw new Error('No pending phone verification');
    setIsLoading(true);
    try {
      if (code !== '123456') throw new Error('Invalid verification code.');
      await AsyncStorage.removeItem('driver_auth_user');
      const userData: User = {
        id: Date.now().toString(), name: 'Phone User', email: '',
        phone: pendingPhoneNumber, rating: 5.0, authProvider: 'phone',
      };
      await saveUser(userData);
      setPendingPhoneNumber(null);
      Toast.show({ type: 'success', text1: 'Verification Successful', text2: 'Welcome!', position: 'top' });
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Verification Failed', text2: error.message, position: 'top' });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    user, isLoading, isAuthenticated: !!user,
    login, signup, loginWithGoogle, loginWithPhone, verifyPhoneCode,
    logout, updateProfile, googlePromptAsync: null,
  };
});
