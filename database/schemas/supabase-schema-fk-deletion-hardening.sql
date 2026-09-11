-- ============================================================
-- Pantra Ride App — Financial-Ledger Deletion Protection (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Run AFTER: supabase-schema.sql, supabase-schema-wallet.sql.
--
-- wallets/wallet_transactions/wallet_bank_accounts all currently
-- ON DELETE CASCADE from users — meaning a deleted user's entire wallet
-- ledger (including their transaction history) would be silently destroyed.
-- No user-deletion flow exists anywhere in this codebase today (no admin
-- route, no self-service screen, no soft-delete flag), so this fires never
-- right now — it's a purely defensive posture change: if a real deletion
-- flow is ever built, RESTRICT forces an explicit anonymize/soft-delete
-- decision at that time rather than allowing a silent cascade now.
--
-- Postgres has no ALTER CONSTRAINT ... ON DELETE — each change below is
-- drop-then-recreate of the constraint. Constraint names follow Postgres's
-- default <table>_<column>_fkey auto-naming (verify via
-- `select conname from pg_constraint where conrelid = 'public.wallets'::regclass;`
-- — or the equivalent for wallet_transactions/wallet_bank_accounts — before
-- running this against a project where the constraint was created with an
-- explicit custom name).
--
-- rides."userId"/"driverId" and tips."rideId"/"riderId"/"driverId" are
-- already NO ACTION (Postgres default when no ON DELETE clause is given,
-- which already blocks the delete like RESTRICT) — no migration needed
-- there, already safe.
--
-- NOT included in this pass: driver_bank_accounts.driverId /
-- driver_payouts.driverId have no FK constraint to drivers.id at all today
-- (both are bare TEXT vs. drivers.id's uuid). Adding one requires a type
-- migration that could fail on live data in ways static code review can't
-- verify — run this pre-flight check against production first if that's
-- ever attempted:
--   select count(*) from driver_bank_accounts
--     where "driverId" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
--        or "driverId"::uuid not in (select id from drivers);
--   select count(*) from driver_payouts
--     where "driverId" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
--        or "driverId"::uuid not in (select id from drivers);
-- Both must return 0 before attempting the type change + FK addition.
-- ============================================================

alter table public.wallets
  drop constraint if exists "wallets_userId_fkey",
  add constraint "wallets_userId_fkey"
    foreign key ("userId") references public.users("uid") on delete restrict;

alter table public.wallet_transactions
  drop constraint if exists "wallet_transactions_userId_fkey",
  add constraint "wallet_transactions_userId_fkey"
    foreign key ("userId") references public.users("uid") on delete restrict;

alter table public.wallet_bank_accounts
  drop constraint if exists "wallet_bank_accounts_userId_fkey",
  add constraint "wallet_bank_accounts_userId_fkey"
    foreign key ("userId") references public.users("uid") on delete restrict;
