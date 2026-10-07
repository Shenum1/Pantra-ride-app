import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { ChevronRight, FileText } from 'lucide-react-native';
import { useTheme } from '@/hooks/useThemeStore';
import { useAuth } from '@/hooks/useAuthStore';
import { useDriverAuth } from '@/hooks/useDriverAuthStore';
import { useTermsStore } from '@/hooks/useTermsStore';
import { supabase } from '@/lib/supabase';
import { PolicyAcceptanceService } from '@/lib/policy-acceptance-service';
import {
  CURRENT_POLICY_VERSIONS,
  isPolicyUpdate,
  PolicyAcceptanceRecord,
  PolicyType,
  PolicyVersions,
  pendingAcceptanceMatches,
  policiesNeedingAcceptance,
  unrecordedVersions,
} from '@/lib/policy-acceptance';

// Keeps public.policy_acceptances in step with what the signed-in user has
// agreed to, and blocks the app until they've accepted the current version of
// every policy their role needs (constants/legal-versions.ts). On every app
// start / sign-in:
//   1. Writes any acceptance cached locally at signup (useTermsStore's
//      pending acceptance) that isn't on the server yet — the retry path for
//      a signup whose insert couldn't happen or failed.
//   2. Shows a blocking prompt for anything still outstanding: a new version,
//      or an account that never accepted (e.g. created via Google from the
//      login screen, or older than this record).
// If the record can't be read (offline, migration not yet run) the user is
// never blocked — the check simply runs again next start.

const LEGAL_PATHS = ['/terms-and-conditions', '/privacy-policy'];

const POLICY_LINKS: Record<PolicyType, { label: string; path: '/terms-and-conditions' | '/privacy-policy' }> = {
  terms: { label: 'Terms and Conditions', path: '/terms-and-conditions' },
  privacy: { label: 'Privacy Policy', path: '/privacy-policy' },
  // Driver obligations are part of the main Terms (section 7) — there's no
  // separate driver terms document yet.
  driver_terms: { label: 'Driver Terms (Terms and Conditions, section 7)', path: '/terms-and-conditions' },
};

const toRecords = (versions: Partial<PolicyVersions>): PolicyAcceptanceRecord[] =>
  (Object.entries(versions) as [PolicyType, string][]).map(([policyType, policyVersion]) => ({ policyType, policyVersion }));

export function PolicyAcceptanceGate() {
  const { colors } = useTheme();
  const { logout: riderLogout } = useAuth();
  const { driver, logout: driverLogout } = useDriverAuth();
  const pathname = usePathname();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  // null = not known (signed out, or couldn't be read) — never blocks.
  const [records, setRecords] = useState<PolicyAcceptanceRecord[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Only a real Supabase session counts: RLS needs it for both the read and
  // the insert, and an email signup awaiting its verification code has none.
  useEffect(() => {
    let active = true;
    const apply = (user: { id: string; email?: string | null } | null | undefined) => {
      if (!active) return;
      setAccountId(user?.id ?? null);
      setAccountEmail(user?.email ?? null);
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session?.user)).catch(() => {});
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Deferred for the same reason as useAuthStore's listener: supabase-js
      // awaits this callback inside signIn/signUp.
      setTimeout(() => apply(session?.user), 0);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!accountId) {
      setRecords(null);
      return;
    }
    let cancelled = false;

    const sync = async () => {
      let current = await PolicyAcceptanceService.getAcceptances(accountId);
      if (current === null) {
        if (!cancelled) setRecords(null);
        return;
      }

      const terms = useTermsStore.getState();
      const pending = await terms.loadPendingAcceptance();
      if (pending && pendingAcceptanceMatches(pending.email, accountEmail)) {
        const missing = unrecordedVersions(pending.versions, current);
        try {
          await PolicyAcceptanceService.recordAcceptances(accountId, missing);
          await terms.clearPendingAcceptance();
        } catch (error: any) {
          // Typically the users row isn't there yet, or the network dropped.
          // The user did accept, so don't prompt them again — the pending
          // acceptance stays cached and this retries on the next start.
          console.warn('Policy acceptance: sync failed, will retry next start:', error?.message);
        }
        current = [...current, ...toRecords(missing)];
      }

      if (!cancelled) setRecords(current);
    };

    void sync();
    return () => {
      cancelled = true;
    };
  }, [accountId, accountEmail]);

  const outstanding = useMemo(
    () => (records ? policiesNeedingAcceptance(records, !!driver) : []),
    [records, driver]
  );

  const handleAccept = async () => {
    if (!accountId || !records || isSubmitting) return;
    setIsSubmitting(true);
    const versions: Partial<PolicyVersions> = {};
    for (const policy of outstanding) versions[policy] = CURRENT_POLICY_VERSIONS[policy];
    const terms = useTermsStore.getState();
    try {
      // Cache first, so a failed insert below is retried on next start
      // rather than lost.
      await terms.acceptTerms(outstanding, accountEmail ?? undefined);
      try {
        await PolicyAcceptanceService.recordAcceptances(accountId, versions);
        await terms.clearPendingAcceptance();
      } catch (error: any) {
        console.warn('Policy acceptance: record failed, will retry next start:', error?.message);
      }
      setRecords([...records, ...toRecords(versions)]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setRecords(null);
    await Promise.allSettled([riderLogout(), driverLogout()]);
    router.replace('/role-selection');
  };

  // Hidden (not dismissed) while the user reads a linked policy, so they can
  // come back and accept.
  const visible = outstanding.length > 0 && !LEGAL_PATHS.includes(pathname);
  const isUpdate = records ? isPolicyUpdate(records, outstanding) : false;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={[styles.iconContainer, { backgroundColor: colors.primaryLight }]}>
            <FileText size={28} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            {isUpdate ? "We've updated our terms" : 'Review our terms'}
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            {isUpdate
              ? 'Please review and accept the updated policies below to keep using Pantra.'
              : 'Please review and accept the policies below to continue using Pantra.'}
          </Text>

          <View style={[styles.links, { borderColor: colors.border }]}>
            {outstanding.map((policy, i) => (
              <Pressable
                key={policy}
                style={[styles.linkRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
                onPress={() => router.push(POLICY_LINKS[policy].path)}
                testID={`policy-link-${policy}`}
              >
                <Text style={[styles.linkText, { color: colors.primary }]}>{POLICY_LINKS[policy].label}</Text>
                <ChevronRight size={18} color={colors.gray} />
              </Pressable>
            ))}
          </View>

          <Text style={[styles.fineprint, { color: colors.textSecondary }]}>
            By tapping Accept, you agree to the policies listed above.
          </Text>

          <Pressable
            style={[styles.acceptButton, { backgroundColor: colors.primary }, isSubmitting && { opacity: 0.6 }]}
            onPress={handleAccept}
            disabled={isSubmitting}
            testID="policy-accept-button"
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={[styles.acceptText, { color: colors.white }]}>Accept</Text>
            )}
          </Pressable>

          <Pressable style={styles.signOutButton} onPress={handleSignOut} disabled={isSubmitting} testID="policy-sign-out-button">
            <Text style={[styles.signOutText, { color: colors.textSecondary }]}>Sign out</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 20,
  },
  links: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 16,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  linkText: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  fineprint: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 16,
  },
  acceptButton: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptText: {
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
