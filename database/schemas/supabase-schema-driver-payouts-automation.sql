-- ============================================================
-- Pantra Ride App — Automatic Driver Payouts + Manual Fallback (Phase 3A)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Run AFTER: supabase-schema-driver-payouts.sql,
--            supabase-schema-driver-bank-accounts-encryption.sql,
--            supabase-schema-payment-reconciliation.sql.
--
-- Today driver_payouts is entirely manual: an admin reveals the decrypted
-- account number, wires money outside Pantra, then flips status straight to
-- 'completed' via a generic setter (admin/payouts/update-status). This
-- migration adds the columns/tables needed for Paystack Transfer API
-- automation to become the default path, while turning that generic setter
-- into a controlled, audited manual-fallback flow instead of removing manual
-- payouts altogether. Existing columns, the balance-check trigger, and the
-- advisory-lock concurrency guard on INSERT are all left exactly as they
-- are — this is additive.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. driver_payouts: new states + automation bookkeeping columns
-- ----------------------------------------------------------------

alter table public.driver_payouts add column if not exists "payoutMethod" text not null default 'automatic';
alter table public.driver_payouts add column if not exists "provider" text;
alter table public.driver_payouts add column if not exists "providerTransferReference" text;
alter table public.driver_payouts add column if not exists "providerTransferCode" text;
alter table public.driver_payouts add column if not exists "processingStartedAt" timestamptz;
alter table public.driver_payouts add column if not exists "updatedAt" timestamptz not null default now();

-- Widen the status CHECK to add 'manual_review'/'reversed' without guessing
-- Postgres's auto-generated constraint name — discover and drop whatever
-- check constraint currently governs the "status" column, then recreate it.
-- pg_get_constraintdef omits quotes around a plain lowercase identifier like
-- "status" (no case-sensitivity to preserve), so the match is deliberately
-- unquoted here — unlike the "mismatchType" block below, where the
-- camelCase column name DOES need quoting to render, and so does the match.
do $$
declare con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.driver_payouts'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.driver_payouts drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.driver_payouts
  add constraint driver_payouts_status_check
  check ("status" in ('pending','processing','manual_review','completed','failed','reversed'));

alter table public.driver_payouts
  drop constraint if exists driver_payouts_payoutmethod_check;
alter table public.driver_payouts
  add constraint driver_payouts_payoutmethod_check
  check ("payoutMethod" in ('automatic','manual'));

alter table public.driver_payouts
  drop constraint if exists driver_payouts_provider_check;
alter table public.driver_payouts
  add constraint driver_payouts_provider_check
  check ("provider" is null or "provider" in ('paystack','flutterwave'));

create unique index if not exists idx_driver_payouts_provider_transfer_reference
  on public.driver_payouts ("providerTransferReference") where "providerTransferReference" is not null;

-- Explicit state-machine enforcement, same pattern as
-- payment_intents_lock_terminal_guard — unconditional, no service-role
-- bypass, because every write to this table already comes from service-role
-- code (drivers only ever SELECT/INSERT their own rows via RLS; no client
-- UPDATE policy has ever existed on this table). A same-value update (no
-- actual transition) is always allowed and is a no-op for this check.
create or replace function public.driver_payouts_validate_transition()
returns trigger
language plpgsql as $$
begin
  if NEW."status" is distinct from OLD."status" then
    if not (
      (OLD."status" = 'pending'        and NEW."status" in ('processing', 'manual_review')) or
      (OLD."status" = 'processing'     and NEW."status" in ('completed', 'failed', 'manual_review')) or
      (OLD."status" = 'manual_review'  and NEW."status" in ('processing', 'completed', 'failed')) or
      -- A 'failed' payout may only re-enter via a NEW authorized attempt
      -- (admin.payouts.retry, which re-initiates the automatic path) — never
      -- silently, and never straight to 'completed'.
      (OLD."status" = 'failed'         and NEW."status" = 'processing') or
      -- A completed payout may only ever be reversed — never resurrected
      -- into any other state.
      (OLD."status" = 'completed'      and NEW."status" = 'reversed')
    ) then
      raise exception 'driver_payouts %: invalid status transition % -> %', OLD."id", OLD."status", NEW."status";
    end if;
  end if;
  NEW."updatedAt" := now();
  return NEW;
end;
$$;

drop trigger if exists driver_payouts_transition_guard on public.driver_payouts;
create trigger driver_payouts_transition_guard
  before update on public.driver_payouts
  for each row execute function public.driver_payouts_validate_transition();

-- A payout only permanently consumes the driver's earnings once it actually
-- lands ('completed'). 'pending'/'processing'/'manual_review' still reserve
-- the amount (so a driver can't file two withdrawals against the same
-- earnings while one is in flight). 'failed' and 'reversed' both release the
-- reservation — the driver never ended up with the money either way, so it
-- becomes withdrawable again. Historical ride earnings are never touched.
CREATE OR REPLACE FUNCTION public.get_driver_available_balance(driver_id text)
RETURNS numeric
LANGUAGE sql STABLE AS $$
  SELECT GREATEST(
    COALESCE((
      SELECT SUM(r."driverEarningsAmount")
      FROM public.rides r
      WHERE r."driverId"::text = driver_id
        AND r."status" = 'completed'
        AND r."paymentStatus" = 'paid'
    ), 0)
    - COALESCE((
      SELECT SUM(p."amount")
      FROM public.driver_payouts p
      WHERE p."driverId" = driver_id
        AND p."status" IN ('pending', 'processing', 'manual_review', 'completed')
    ), 0),
    0
  );
$$;

-- ----------------------------------------------------------------
-- 2. driver_payouts RLS: revoke direct client INSERT
-- ----------------------------------------------------------------
-- Payout requests now go through backend/trpc/routes/driver/payouts/request
-- (service-role), which performs the same balance-checked INSERT this policy
-- used to allow directly, then immediately attempts automatic initiation in
-- the same request. Direct client inserts are no longer needed and are
-- revoked so a payout can never be created without that orchestration
-- running. SELECT-own stays (harmless defense-in-depth; the driver-facing
-- read path already goes through driver.payouts.list via service-role too).
drop policy if exists "driver_payouts_insert_own" on public.driver_payouts;

-- ----------------------------------------------------------------
-- 3. driver_bank_accounts: provider recipient/beneficiary fields
-- ----------------------------------------------------------------
-- "Pantra driver bank account -> provider recipient -> provider recipient ID
-- stored by Pantra." bankCode is resolved server-side from the existing
-- free-text bankName (see backend/lib/nigerian-banks.ts) — no mobile UI
-- change needed. paystackRecipientCode is created once (at add-bank-account
-- time, best-effort, or lazily at first payout attempt) and reused for every
-- future payout to the same account.
alter table public.driver_bank_accounts add column if not exists "bankCode" text;
alter table public.driver_bank_accounts add column if not exists "paystackRecipientCode" text;
alter table public.driver_bank_accounts add column if not exists "recipientVerifiedAt" timestamptz;
alter table public.driver_bank_accounts add column if not exists "recipientInvalidatedAt" timestamptz;

-- ----------------------------------------------------------------
-- 4. payout_provider_attempts — the payout-specific idempotency ledger
-- ----------------------------------------------------------------
-- One row per attempt to call Paystack's transfer API for a given payout.
-- The partial unique index below is the concurrency guard: a second,
-- simultaneous initiation attempt for the SAME payout (double-tap, client
-- retry racing a slow first request, two server processes) fails to insert
-- its own 'call_initiated' claim row and must not call the provider again —
-- this is the database-level protection the spec requires beyond the
-- advisory lock (which only protects the original balance-checked INSERT,
-- not a later retry of the transfer call itself).
create table if not exists public.payout_provider_attempts (
  "id"                          uuid primary key default gen_random_uuid(),
  "payoutId"                    uuid not null references public.driver_payouts("id") on delete restrict,
  "provider"                    text not null check ("provider" in ('paystack','flutterwave')),
  "providerTransferReference"   text not null,
  "providerTransferCode"        text,
  "attemptStatus"               text not null default 'call_initiated'
                                 check ("attemptStatus" in (
                                   'call_initiated','call_succeeded','call_failed_network',
                                   'call_failed_duplicate_reference','call_timeout','call_rejected'
                                 )),
  "httpStatus"                  integer,
  "failureReason"               text,
  "createdAt"                   timestamptz not null default now(),
  "updatedAt"                   timestamptz not null default now()
);

create index if not exists idx_payout_provider_attempts_payout on public.payout_provider_attempts("payoutId");

create unique index if not exists idx_payout_provider_attempts_inflight
  on public.payout_provider_attempts("payoutId") where "attemptStatus" = 'call_initiated';

alter table public.payout_provider_attempts enable row level security;
-- No client-facing policy — service-role only.

-- ----------------------------------------------------------------
-- 5. payout_events — Paystack transfer webhook processing/audit log
-- ----------------------------------------------------------------
-- Same shape and purpose as payment_events (Phase 2): a processing/audit log
-- (mutable processingStatus/processedAt, not append-only), one row per
-- verification/webhook attempt, deduplicated on (provider, providerEventId).
create table if not exists public.payout_events (
  "id"                          uuid primary key default gen_random_uuid(),
  "payoutId"                    uuid references public.driver_payouts("id") on delete restrict,
  "provider"                    text not null check ("provider" in ('paystack','flutterwave')),
  "providerTransferReference"   text,
  "providerEventId"             text,
  "eventType"                   text not null,
  "providerState"               text,
  "amount"                      numeric(12,2),
  "currency"                    text,
  "processingStatus"            text not null default 'received'
                                 check ("processingStatus" in (
                                   'received','processed','ignored_duplicate',
                                   'rejected_unmatched_payout','rejected_amount_mismatch',
                                   'rejected_currency_mismatch','flagged_for_manual_review'
                                 )),
  "failureReason"               text,
  "safeMetadata"                jsonb,
  "createdAt"                   timestamptz not null default now(),
  "processedAt"                 timestamptz
);

create unique index if not exists idx_payout_events_provider_event_id
  on public.payout_events ("provider", "providerEventId") where "providerEventId" is not null;
create index if not exists idx_payout_events_payout on public.payout_events("payoutId");

alter table public.payout_events enable row level security;
-- No client-facing policy — service-role only.

-- ----------------------------------------------------------------
-- 6. payout_manual_actions — immutable manual-fallback audit trail
-- ----------------------------------------------------------------
-- adminUserId is nullable: a system-initiated move to manual_review (e.g.
-- the automatic path failing/timing out) records action=
-- 'moved_to_manual_review' with adminUserId null; every admin-triggered
-- action (manual_completed/manual_failed/retry_initiated, and an
-- admin-initiated move-to-manual-review) always carries a real adminUserId.
-- Append-only by construction: no UPDATE/DELETE policy exists for anyone,
-- including the admin routes, which only ever INSERT here.
create table if not exists public.payout_manual_actions (
  "id"                 uuid primary key default gen_random_uuid(),
  "payoutId"           uuid not null references public.driver_payouts("id") on delete restrict,
  "adminUserId"        uuid references public.users("uid") on delete restrict,
  "action"             text not null check ("action" in (
                          'moved_to_manual_review','manual_completed','manual_failed','retry_initiated'
                        )),
  "externalReference"  text,
  "notes"              text,
  "createdAt"          timestamptz not null default now()
);

create index if not exists idx_payout_manual_actions_payout on public.payout_manual_actions("payoutId");

alter table public.payout_manual_actions enable row level security;
-- No client-facing policy — service-role only, insert-only in practice.

-- ----------------------------------------------------------------
-- 7. payment_reconciliation_records — extended to cover payouts
-- ----------------------------------------------------------------
-- Reused rather than duplicated (Part 13 of the spec: "prefer extending the
-- current architecture over unnecessary new tables"). paymentIntentId stays
-- payment-specific; payoutId is the payout-specific counterpart — exactly
-- one of the two is ever set per row, distinguished by which mismatchType
-- fired (the payment-side values never overlap with the payout-side ones).
alter table public.payment_reconciliation_records
  add column if not exists "payoutId" uuid references public.driver_payouts("id") on delete restrict;

do $$
declare con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.payment_reconciliation_records'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%"mismatchType"%'
  loop
    execute format('alter table public.payment_reconciliation_records drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.payment_reconciliation_records
  add constraint payment_reconciliation_records_mismatchtype_check
  check ("mismatchType" in (
    -- Payment-side (Phase 2, unchanged)
    'amount_mismatch','currency_mismatch',
    'unmatched_provider_transaction','pantra_success_provider_failed',
    -- Payout-side (Phase 3A)
    'payout_amount_mismatch','payout_currency_mismatch',
    'payout_unmatched_provider_transaction','payout_provider_reversed',
    'payout_unresolved_after_timeout'
  ));

create index if not exists idx_payment_reconciliation_payout on public.payment_reconciliation_records("payoutId");
