import { useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { trpc } from '@/lib/trpc';
import { useDriverAuth } from './useDriverAuthStore';

// Client-side view of driver verification state. Every mutation here goes through a
// tRPC procedure backed by the service-role client server-side (see
// backend/trpc/routes/driver-verification/*) — this hook never writes
// verificationStatus/isVerified itself, it only reflects what the server decided.
// Replaces lib/driver-verification-service.ts, which wrote directly to Supabase from
// the client and is deleted as part of this rebuild.
export const [DriverVerificationProvider, useDriverVerification] = createContextHook(() => {
  const { driver, isAuthenticated } = useDriverAuth();

  const statusQuery = trpc.driverVerification.getStatus.useQuery(undefined, {
    enabled: isAuthenticated && !!driver?.id,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const utils = trpc.useUtils();
  const invalidate = () => void utils.driverVerification.getStatus.invalidate();

  const submitProfileMutation = trpc.driverVerification.submitProfile.useMutation({
    onSuccess: invalidate,
  });
  const submitDocumentMutation = trpc.driverVerification.submitDocument.useMutation({
    onSuccess: invalidate,
  });
  const syncAuthMutation = trpc.driverVerification.syncAuthVerificationStatus.useMutation({
    onSuccess: invalidate,
  });
  const checkExpiryMutation = trpc.driverVerification.checkExpiry.useMutation({
    onSuccess: invalidate,
  });

  const verificationStatus = statusQuery.data?.verificationStatus ?? 'PENDING';
  const isVerified = verificationStatus === 'VERIFIED';

  return useMemo(
    () => ({
      status: statusQuery.data,
      verificationStatus,
      isVerified,
      isLoading: statusQuery.isLoading,
      error: statusQuery.error,
      refetch: statusQuery.refetch,
      submitProfile: submitProfileMutation.mutateAsync,
      isSubmittingProfile: submitProfileMutation.isPending,
      submitDocument: submitDocumentMutation.mutateAsync,
      isSubmittingDocument: submitDocumentMutation.isPending,
      syncAuthVerificationStatus: syncAuthMutation.mutateAsync,
      checkExpiry: checkExpiryMutation.mutateAsync,
    }),
    [
      statusQuery.data,
      statusQuery.isLoading,
      statusQuery.error,
      statusQuery.refetch,
      verificationStatus,
      isVerified,
      submitProfileMutation.mutateAsync,
      submitProfileMutation.isPending,
      submitDocumentMutation.mutateAsync,
      submitDocumentMutation.isPending,
      syncAuthMutation.mutateAsync,
      checkExpiryMutation.mutateAsync,
    ]
  );
});
