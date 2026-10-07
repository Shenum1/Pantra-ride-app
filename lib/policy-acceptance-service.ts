import { Platform } from 'react-native';
import { supabase } from './supabase';
import { PolicyAcceptanceRecord, PolicyType } from './policy-acceptance';

// Reads/writes public.policy_acceptances (supabase-schema-policy-acceptances.sql).
// RLS only lets a signed-in user see and insert their own rows, so both calls
// need a live Supabase session for userId.
export class PolicyAcceptanceService {
  // null = couldn't read (offline, or the migration hasn't been run yet) —
  // callers treat that as "unknown" and must not block the user on it.
  static async getAcceptances(userId: string): Promise<PolicyAcceptanceRecord[] | null> {
    const { data, error } = await supabase
      .from('policy_acceptances')
      .select('policyType, policyVersion')
      .eq('userId', userId);
    if (error || !data) {
      if (error) console.warn('Policy acceptance: read failed:', error.message);
      return null;
    }
    return data as PolicyAcceptanceRecord[];
  }

  // Idempotent: the (userId, policyType, policyVersion) unique constraint plus
  // ignoreDuplicates makes re-recording an already-recorded version a no-op,
  // so a retry after a half-finished attempt is always safe. acceptedAt is
  // left to the column default (server clock).
  static async recordAcceptances(userId: string, versions: Partial<Record<PolicyType, string>>): Promise<void> {
    const rows = (Object.entries(versions) as [PolicyType, string][]).map(([policyType, policyVersion]) => ({
      userId,
      policyType,
      policyVersion,
      platform: Platform.OS,
    }));
    if (rows.length === 0) return;
    const { error } = await supabase
      .from('policy_acceptances')
      .upsert(rows, { onConflict: 'userId,policyType,policyVersion', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
}
