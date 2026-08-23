import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useDriverVerification } from '@/hooks/useDriverVerification';
import { useTheme } from '@/hooks/useThemeStore';
import { Skeleton, SkeletonLine, ShimmerGroup } from '@/components/skeletons';

// Wraps (driver-tabs) so a driver who never finished the registration wizard (signed
// up, closed the app mid-way, then logged back in later) is sent back into it instead
// of landing on the dashboard with nothing to do. verificationStatus === 'PENDING'
// (see backend/services/verification/engine.ts's recomputeDriverVerificationStatus)
// means the driver's profile and/or required documents are still incomplete — every
// other status (DOCUMENTS_SUBMITTED, VERIFYING, MANUAL_REVIEW, VERIFIED, REJECTED)
// means they've already submitted something, so they belong on the dashboard, which
// surfaces the current status/next step itself (see the verification banner there).
export const DriverVerificationGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { verificationStatus, isLoading } = useDriverVerification();
  const { colors } = useTheme();

  const needsWizard = !isLoading && verificationStatus === 'PENDING';

  useEffect(() => {
    if (needsWizard) {
      router.replace('/driver-verification/personal-info' as any);
    }
  }, [needsWizard]);

  if (isLoading || needsWizard) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ShimmerGroup>
          <SkeletonLine width="50%" height={20} style={styles.shellHeader} />
          <Skeleton width="100%" height={120} borderRadius={16} style={styles.shellBlock} />
          <Skeleton width="100%" height={64} borderRadius={12} style={styles.shellBlock} />
        </ShimmerGroup>
      </View>
    );
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
