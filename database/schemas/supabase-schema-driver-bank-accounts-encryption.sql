-- ============================================================
-- Pantra Ride App — Bank Account Encryption at Rest (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Run AFTER: supabase-schema-driver-payouts.sql.
--
-- driver_bank_accounts.accountNumber was plaintext TEXT, written and read
-- directly from the driver's own client session via RLS (no backend route
-- existed in this path at all). This migration adds the columns needed for
-- Node-side AES-256-GCM encryption (backend/lib/bank-account-crypto.ts) and
-- revokes direct client table access entirely — all reads/writes now go
-- through new backend/trpc/routes/driver/bank-accounts/{list,add,remove}
-- routes and backend/trpc/routes/admin/payouts/reveal-bank-account.
--
-- "accountNumber" (plaintext) is kept nullable, NOT dropped yet, as a
-- rollback safety net for existing rows until
-- scripts/backfill-bank-account-encryption.ts has been run and verified
-- (select count(*) from driver_bank_accounts where "accountNumberEncrypted"
-- is null must return 0) — see the plan's migration-sequencing notes. Drop
-- it in a separate follow-up migration only after that check passes.
-- ============================================================

alter table public.driver_bank_accounts add column if not exists "accountNumberEncrypted" text;
alter table public.driver_bank_accounts add column if not exists "accountNumberLast4" text;
alter table public.driver_bank_accounts alter column "accountNumber" drop not null;

-- Direct client access is revoked entirely (no replacement policy — RLS
-- stays enabled with zero policies, so only the service-role client, used by
-- the new backend routes, can touch this table going forward).
drop policy if exists "driver_bank_accounts_own" on public.driver_bank_accounts;
