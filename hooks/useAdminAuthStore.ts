import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AdminUser } from '@/types';

interface AdminAuthState {
  adminUser: AdminUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
}

export const [AdminAuthProvider, useAdminAuth] = createContextHook<AdminAuthState>(() => {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = adminUser !== null;

  const checkAuthStatus = useCallback(async () => {
    try {
      // Mock storage - replace with actual storage implementation
      const storedAdmin = null; // await storage.getItem('admin_user');
      if (storedAdmin) {
        setAdminUser(JSON.parse(storedAdmin));
      }
    } catch (error) {
      console.error('Error checking admin auth status:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      // Mock admin login - replace with actual API call
      if (email === 'admin@rideapp.com' && password === 'admin123') {
        const mockAdmin: AdminUser = {
          id: '1',
          name: 'Super Admin',
          email: 'admin@rideapp.com',
          role: 'super_admin',
          department: 'management',
          permissions: [
            {
              id: '1',
              name: 'Full Access',
              resource: 'users',
              actions: ['create', 'read', 'update', 'delete', 'approve']
            }
          ],
          isActive: true,
          lastLogin: new Date(),
          createdAt: new Date('2024-01-01')
        };
        
        setAdminUser(mockAdmin);
        // await storage.setItem('admin_user', JSON.stringify(mockAdmin));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Admin login error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setAdminUser(null);
      // await storage.removeItem('admin_user');
    } catch (error) {
      console.error('Admin logout error:', error);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  return useMemo(() => ({
    adminUser,
    isLoading,
    isAuthenticated,
    login,
    logout,
    checkAuthStatus
  }), [adminUser, isLoading, isAuthenticated, login, logout, checkAuthStatus]);
});