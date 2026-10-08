import type { SupabaseClient } from "@supabase/supabase-js";

// Append-only record of an admin viewing sensitive data (decrypted bank
// details, rider/driver personal data). Table: public.admin_access_log —
// see database/schemas/supabase-schema-backend-hardening.sql (RLS on, no
// client policies: only the service role can read or write it).
//
// Records WHO looked at WHAT, never the data itself: metadata must hold only
// non-PII facts (counts, flags) — no names, numbers, addresses, URLs.
//
// Logging is non-fatal by design: a failure to write the log must not block
// an admin mid-task (e.g. paying a driver manually), but it is always
// reported via console.error so a broken audit trail is visible in logs.

export type AdminAccessAction = "reveal_bank_account" | "view_rider_detail" | "view_driver_verification_detail";
export type AdminAccessSubjectType = "driver_bank_account" | "rider" | "driver";

export interface AdminAccessEntry {
  adminUserId: string;
  action: AdminAccessAction;
  subjectType: AdminAccessSubjectType;
  subjectId: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export async function recordAdminAccess(db: SupabaseClient, entry: AdminAccessEntry): Promise<boolean> {
  try {
    const { error } = await db.from("admin_access_log").insert({
      adminUserId: entry.adminUserId,
      action: entry.action,
      subjectType: entry.subjectType,
      subjectId: entry.subjectId,
      metadata: entry.metadata ?? {},
    });
    if (error) {
      console.error(
        `[admin-access-log] FAILED to record ${entry.action} on ${entry.subjectType}:${entry.subjectId} by admin ${entry.adminUserId}: ${error.message}`
      );
      return false;
    }
    return true;
  } catch (e) {
    console.error(
      `[admin-access-log] FAILED to record ${entry.action} on ${entry.subjectType}:${entry.subjectId} by admin ${entry.adminUserId}:`,
      e
    );
    return false;
  }
}
