import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuthStore';
import { useDriverAuth } from '@/hooks/useDriverAuthStore';
import { useTheme } from '@/hooks/useThemeStore';
import { Skeleton, SkeletonLine, ShimmerGroup } from '@/components/skeletons';

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
        <ShimmerGroup>
          <SkeletonLine width="50%" height={20} style={styles.shellHeader} />
          <Skeleton width="100%" height={120} borderRadius={16} style={styles.shellBlock} />
          <Skeleton width="100%" height={64} borderRadius={12} style={styles.shellBlock} />
          <Skeleton width="100%" height={64} borderRadius={12} style={styles.shellBlock} />
        </ShimmerGroup>
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
    paddingHorizontal: 24,
  },
  shellHeader: {
    marginBottom: 20,
    alignSelf: 'center',
  },
  shellBlock: {
    marginBottom: 12,
  },
});