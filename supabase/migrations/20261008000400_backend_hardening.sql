-- Migration copy of database/schemas/supabase-schema-backend-hardening.sql (wave 1, 2026-10-07).
-- The source file stays in database/schemas/ for history and the unit tests that read it.
-- Ignore its "Run this in: SQL Editor" line: this file is applied with `supabase db push`.

-- ============================================================
-- Pantra Ride App — Backend hardening (additive, idempotent)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Run AFTER: supabase-schema-wallet.sql, supabase-schema-rider-wallet-lockdown.sql,
--            supabase-schema-driver-bank-accounts-encryption.sql
--
-- Safe to re-run. Destroys no data. Follow-up steps, in order:
--   1. this file
--   2. bun scripts/backfill-bank-account-encryption.ts --dry-run, then without --dry-run
--      (needs EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BANK_ACCOUNT_ENCRYPTION_KEY)
--   3. supabase-schema-bank-accounts-drop-plaintext.sql  (ONLY after step 2 exits 0)
-- ============================================================

-- ----------------------------------------------------------------
-- 1. Rider bank accounts: encryption at rest
-- ----------------------------------------------------------------
-- wallet_bank_accounts stored "accountNumber" as plaintext. Riders no longer
-- add bank accounts (feature removed — see
-- supabase-schema-rider-wallet-lockdown.sql), but any existing rows still
-- hold plaintext numbers. Same scheme as driver_bank_accounts: Node-side
-- AES-256-GCM (backend/lib/bank-account-crypto.ts) into
-- "accountNumberEncrypted", plus a display-only "accountNumberLast4".
-- The plaintext column is made nullable here and DROPPED by the separate
-- post-backfill migration.
alter table public.wallet_bank_accounts add column if not exists "accountNumberEncrypted" text;
alter table public.wallet_bank_accounts add column if not exists "accountNumberLast4" text;
alter table public.wallet_bank_accounts alter column "accountNumber" drop not null;

-- No client session may write account numbers. Re-asserted here (the
-- lockdown migration already dropped these) so this holds even if that file
-- was never run, and backed by table privileges so a future permissive
-- policy can't silently re-open it. Any future rider bank-account write must
-- go through a backend route that encrypts (service role bypasses both).
drop policy if exists "Users can insert own bank accounts" on public.wallet_bank_accounts;
drop policy if exists "Users can update own bank accounts" on public.wallet_bank_accounts;
revoke insert, update on public.wallet_bank_accounts from anon, authenticated;

-- ----------------------------------------------------------------
-- 2. Admin access audit log
-- ----------------------------------------------------------------
-- Who viewed what sensitive data, written by the backend
-- (backend/lib/admin-access-log.ts) from:
--   admin.payouts.revealBankAccount            -> reveal_bank_account / driver_bank_account
--   admin.riders.getDetail                     -> view_rider_detail / rider
--   admin.driverVerification.getDriverDetail   -> view_driver_verification_detail / driver
-- Holds identifiers only — never the PII values themselves.
--
-- No FK on "adminUserId": the audit trail must outlive the admin account.
create table if not exists public.admin_access_log (
  "id"           uuid primary key default gen_random_uuid(),
  "adminUserId"  uuid not null,
  "action"       text not null check ("action" in (
                   'reveal_bank_account',
                   'view_rider_detail',
                   'view_driver_verification_detail'
                 )),
  "subjectType"  text not null check ("subjectType" in ('driver_bank_account', 'rider', 'driver')),
  "subjectId"    text not null,
  "metadata"     jsonb not null default '{}'::jsonb,
  "createdAt"    timestamptz not null default now()
);

create index if not exists idx_admin_access_log_admin   on public.admin_access_log ("adminUserId", "createdAt" desc);
create index if not exists idx_admin_access_log_subject on public.admin_access_log ("subjectType", "subjectId", "createdAt" desc);

-- Service role only: RLS on with NO policies, and no table privileges for
-- client roles. (The service role bypasses RLS.)
alter table public.admin_access_log enable row level security;
revoke all on public.admin_access_log from anon, authenticated;
