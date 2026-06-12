import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { AdminAuthService } from '@/lib/admin-auth-service';
import type { AdminUser } from '@/types';

interface AdminAuthState {
  adminUser: AdminUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const ADMIN_STORAGE_KEY = 'admin_auth_user';

export const [AdminAuthProvider, useAdminAuth] = createContextHook<AdminAuthState>(() => {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load cached admin from AsyncStorage immediately — no network needed
    const loadStoredAdmin = async () => {
      try {
        const stored = await AsyncStorage.getItem(ADMIN_STORAGE_KEY);
        if (stored) setAdminUser(JSON.parse(stored) as AdminUser);
      } catch {
        // ignore read errors
      } finally {
        setIsLoading(false);
      }
    };
    void loadStoredAdmin();

    // Keep in sync with live Supabase session in the background
    const unsubscribe = AdminAuthService.onAuthStateChanged((admin) => {
      setAdminUser(admin);
      if (admin) {
        AsyncStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(admin)).catch(() => {});
      } else {
        AsyncStorage.removeItem(ADMIN_STORAGE_KEY).catch(() => {});
      }
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const admin = await AdminAuthService.signInWithEmail(email, password);
      setAdminUser(admin);
      await AsyncStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(admin));
      return true;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(ADMIN_STORAGE_KEY);
    setAdminUser(null);
    try {
      await AdminAuthService.signOut();
    } catch {
      // session may already be expired or network unavailable — local state is cleared
    }
  }, []);

  return useMemo(() => ({
    adminUser,
    isLoading,
    isAuthenticated: !!adminUser,
    login,
    logout,
  }), [adminUser, isLoading, login, logout]);
});
