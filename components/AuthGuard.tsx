import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuthStore';
import { useDriverAuth } from '@/hooks/useDriverAuthStore';
import { useTheme } from '@/hooks/useThemeStore';

interface AuthGuardProps {
  children: React.ReactNode;
  requireDriver?: boolean;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children, requireDriver = false }) => {
  const { isAuthenticated: userAuthenticated, isLoading: userLoading } = useAuth();
  const { isAuthenticated: driverAuthenticated, isLoading: driverLoading } = useDriverAuth();
  const { colors } = useTheme();

  const isLoading = userLoading || driverLoading;
  const isAuthenticated = requireDriver ? driverAuthenticated : userAuthenticated;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      console.log('AuthGuard: User not authenticated, redirecting to role selection');
      // Use a small delay to ensure state is stable
      const timer = setTimeout(() => {
        router.replace('/role-selection');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});