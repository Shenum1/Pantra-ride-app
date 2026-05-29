import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState } from 'react';
import { AuthService } from '@/lib/auth-service';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import Toast from 'react-native-toast-message';
import { parseFirebaseError } from '@/lib/auth-errors';
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
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      console.log('Auth Store: Firebase auth state changed:', firebaseUser?.uid);
      
      if (!firebaseUser) {
        const storedUser = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser) as User;
          if (parsedUser.id === 'test-rider') {
            setUser(parsedUser);
            setIsLoading(false);
            return;
          }
        }

        await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
        setUser(null);
        setIsLoading(false);
        return;
      }
      
      try {
        const userProfile = await AuthService.getUserProfile(firebaseUser.uid);
        if (userProfile) {
          const userData: User = {
            id: firebaseUser.uid,
            name: userProfile.displayName,
            email: firebaseUser.email || '',
            phone: userProfile.phoneNumber || '',
            rating: 5.0,
            profileImage: userProfile.photoURL,
            authProvider: 'email',
          };
          await saveUser(userData);
        }
      } catch (error) {
        console.error('Auth Store: Error loading user profile:', error);
      }
    });
    
    return () => unsubscribe();
  }, []);

  const loadStoredUser = async () => {
    try {
      const storedUser = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Error loading stored user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveUser = async (userData: User) => {
    try {
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      console.error('Error saving user:', error);
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      console.log('Auth Store: Starting user login process');
      
      if (!email || !password) {
        throw new Error('Please enter both email and password');
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Please enter a valid email address.');
      }
      
      await AsyncStorage.removeItem('driver_auth_user');

      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail === TEST_RIDER_EMAIL && password === TEST_RIDER_PASSWORD) {
        const testUserData: User = {
          id: 'test-rider',
          name: 'Test Rider',
          email: TEST_RIDER_EMAIL,
          phone: '+234 123 456 7890',
          rating: 5.0,
          authProvider: 'email',
        };

        await saveUser(testUserData);
        console.log('Auth Store: Test rider logged in successfully:', testUserData);
        Toast.show({
          type: 'success',
          text1: 'Welcome back!',
          text2: `Logged in as ${testUserData.name}`,
          position: 'top',
        });
        return;
      }
      
      const firebaseUser = await AuthService.signInWithEmail(email, password);
      let userProfile = await AuthService.getUserProfile(firebaseUser.uid);
      
      if (!userProfile) {
        console.log('Auth Store: User profile not found in Firestore, creating one...');
        try {
          await AuthService.createMissingUserProfile(
            firebaseUser.uid,
            email,
            firebaseUser.displayName || 'User',
            'rider'
          );
          userProfile = await AuthService.getUserProfile(firebaseUser.uid);
        } catch (profileError) {
          console.error('Auth Store: Failed to create user profile:', profileError);
        }
      }
      
      const userData: User = {
        id: firebaseUser.uid,
        name: userProfile?.displayName || firebaseUser.displayName || 'User',
        email: firebaseUser.email || email,
        phone: userProfile?.phoneNumber || '',
        rating: 5.0,
        profileImage: userProfile?.photoURL || undefined,
        authProvider: 'email',
      };
      
      await saveUser(userData);
      console.log('Auth Store: User logged in successfully:', userData);
      Toast.show({
        type: 'success',
        text1: 'Welcome back!',
        text2: `Logged in as ${userData.name}`,
        position: 'top',
      });
    } catch (error: any) {
      console.error('Auth Store: Login error:', error);
      const errorMessage = parseFirebaseError(error);
      
      const isInvalidCredential = error?.code === 'auth/invalid-credential' || 
                                  errorMessage.includes('Invalid email or password');
      
      const displayMessage = isInvalidCredential 
        ? 'Invalid email or password. Please check your credentials or sign up if you don\'t have an account.'
        : errorMessage;
      
      Toast.show({
        type: 'error',
        text1: 'Login Failed',
        text2: displayMessage,
        position: 'top',
        visibilityTime: 5000,
      });
      throw new Error(displayMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (name: string, email: string, phone: string, password: string, profileImage?: string) => {
    setIsLoading(true);
    try {
      console.log('Auth Store: Starting signup process');
      
      const deviceFingerprint = await DeviceSecurityService.generateDeviceFingerprint();
      console.log('Auth Store: Device fingerprint generated:', deviceFingerprint.deviceId);
      
      const firebaseUser = await AuthService.signUpWithEmail(email, password, name, 'rider');
      
      try {
        await DeviceSecurityService.registerDevice(deviceFingerprint, firebaseUser.uid);
        console.log('Auth Store: Device registered for user:', firebaseUser.uid);
      } catch (deviceError) {
        console.warn('Auth Store: Device registration skipped:', deviceError);
      }
      
      let storedProfileImage = profileImage;
      if (profileImage && !profileImage.startsWith('http')) {
        const extension = profileImage.split('.').pop()?.split('?')[0] ?? 'jpg';
        storedProfileImage = await StorageService.uploadImage(`users/${firebaseUser.uid}/profile.${extension}`, profileImage);
      }

      await AuthService.updateUserProfile(firebaseUser.uid, {
        phoneNumber: phone,
        photoURL: storedProfileImage,
      } as any);
      
      const userData: User = {
        id: firebaseUser.uid,
        name,
        email,
        phone,
        rating: 5.0,
        profileImage: storedProfileImage,
        authProvider: 'email',
      };
      
      await saveUser(userData);
      console.log('Auth Store: User signed up successfully:', userData);
      Toast.show({
        type: 'success',
        text1: 'Account Created!',
        text2: 'Welcome to the platform',
        position: 'top',
      });
    } catch (error: any) {
      console.error('Signup error:', error);
      
      let errorMessage = error.message || 'An unexpected error occurred';
      
      if (errorMessage.includes('This email is already registered')) {
        errorMessage = 'This email is already registered. Please log in instead.';
      } else if (!errorMessage.includes('auth/') && !errorMessage.includes('Firebase') && !errorMessage.includes('device')) {
        errorMessage = parseFirebaseError(error);
      }
      
      Toast.show({
        type: 'error',
        text1: 'Signup Failed',
        text2: errorMessage,
        position: 'top',
        visibilityTime: 4000,
      });
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      console.log('Auth Store: Starting logout process');
      await AuthService.signOut();
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      await AsyncStorage.removeItem('driver_auth_user');
      setUser(null);
      console.log('Auth Store: Logout completed successfully');
      Toast.show({
        type: 'success',
        text1: 'Logged Out',
        text2: 'See you soon!',
        position: 'top',
      });
    } catch (error) {
      console.error('Auth Store: Logout error:', error);
      const errorMessage = parseFirebaseError(error);
      Toast.show({
        type: 'error',
        text1: 'Logout Failed',
        text2: errorMessage,
        position: 'top',
      });
      throw error;
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) return;
    
    try {
      if (user.id.startsWith('test-')) {
        const updatedTestUser = { ...user, ...updates };
        await saveUser(updatedTestUser);
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
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  };

  const loginWithGoogle = async () => {
    throw new Error('Google authentication has been temporarily disabled. Please use email/phone login instead.');
  };

  const loginWithPhone = async (phoneNumber: string) => {
    setIsLoading(true);
    try {
      console.log('Auth Store: Sending verification code to:', phoneNumber);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setPendingPhoneNumber(phoneNumber);
      console.log('Auth Store: Verification code sent');
      Toast.show({
        type: 'success',
        text1: 'Verification Code Sent',
        text2: 'Please check your phone',
        position: 'top',
      });
    } catch (error) {
      console.error('Auth Store: Phone login error:', error);
      const errorMessage = parseFirebaseError(error);
      Toast.show({
        type: 'error',
        text1: 'Phone Login Failed',
        text2: errorMessage,
        position: 'top',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyPhoneCode = async (code: string) => {
    if (!pendingPhoneNumber) {
      throw new Error('No pending phone verification');
    }
    
    setIsLoading(true);
    try {
      console.log('Auth Store: Verifying code:', code);
      
      if (code !== '123456') {
        throw new Error('Invalid verification code. In production, this would verify with Firebase.');
      }
      
      await AsyncStorage.removeItem('driver_auth_user');
      
      const userData: User = {
        id: Date.now().toString(),
        name: 'Phone User',
        email: '',
        phone: pendingPhoneNumber,
        rating: 5.0,
        authProvider: 'phone',
      };
      
      await saveUser(userData);
      setPendingPhoneNumber(null);
      console.log('Auth Store: Phone verification successful (demo mode)');
      Toast.show({
        type: 'success',
        text1: 'Verification Successful',
        text2: 'Welcome!',
        position: 'top',
      });
    } catch (error) {
      console.error('Auth Store: Phone verification error:', error);
      const errorMessage = parseFirebaseError(error);
      Toast.show({
        type: 'error',
        text1: 'Verification Failed',
        text2: errorMessage,
        position: 'top',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    signup,
    loginWithGoogle,
    loginWithPhone,
    verifyPhoneCode,
    logout,
    updateProfile,
    googlePromptAsync: null,
  };
});
