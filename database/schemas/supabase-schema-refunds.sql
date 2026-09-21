-- ============================================================
-- Pantra Ride App — Refund Infrastructure (Phase 3B, additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Run AFTER: supabase-schema-payment-intents.sql, supabase-schema-wallet.sql,
--            supabase-schema-ride-payment-status.sql,
--            supabase-schema-driver-payouts-automation.sql.
--
-- Scope, determined by inspection: the only two payment types Pantra can
-- currently refund are (1) a wallet top-up (payment_intents, provider-backed
-- via Paystack/Flutterwave) and (2) a ride paid from wallet balance
-- (wallet_transactions type='ride_payment'). Cash rides have no captured
-- Pantra-held transaction to refund; card/online ride payments don't exist
-- yet (Phase 3C). A refund is a NEW financial event linked to the original —
-- it never rewrites a historical successful payment or a settled ride's
-- (already-immutable, per rides_settle_guard) fare/commission/earnings.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. refund_intents
-- ----------------------------------------------------------------
create table if not exists public.refund_intents (
  "id"                            uuid primary key default gen_random_uuid(),
  -- Exactly one of paymentIntentId/rideId is set, matching originalPaymentType.
  "originalPaymentType"           text not null check ("originalPaymentType" in ('wallet_topup', 'ride_wallet_payment')),
  "paymentIntentId"                uuid references public.payment_intents("id") on delete restrict,
  "rideId"                         uuid references public.rides("id") on delete restrict,
  "originalWalletTransactionId"   uuid references public.wallet_transactions("id") on delete restrict,
  "userId"                         uuid not null references public.users("uid") on delete restrict,
  "provider"                       text check ("provider" is null or "provider" in ('paystack', 'flutterwave')),
  -- Generated once (PANTRA-REFUND-<uuid>), reused as: the add_wallet_transaction
  -- p_reference for the wallet-side movement, AND the provider refund API's own
  -- reference where a provider call is involved — one idempotency key, two uses.
  "refundReference"                text not null unique,
  "providerRefundId"               text,
  "originalAmount"                 numeric(12,2) not null check ("originalAmount" > 0),
  "amount"                         numeric(12,2) not null check ("amount" > 0),
  "currency"                       text not null default 'NGN',
  "reason"                         text,
  "refundType"                     text not null check ("refundType" in ('full', 'partial')),
  "requestedBy"                    uuid not null references public.users("uid") on delete restrict,
  -- No 'manual_review' state: a refund is already an admin-initiated action,
  -- so there is no "escalate to a human" step the way an unattended
  -- automatic payout needs one. requested/processing/completed/failed/
  -- cancelled/reversed/unknown exactly matches the spec's minimum set.
  "status"                         text not null default 'requested'
                                    check ("status" in ('requested', 'processing', 'completed', 'failed', 'cancelled', 'reversed', 'unknown')),
  -- One admin-supplied key per logical refund ATTEMPT (not per retry) — a
  -- duplicate submission with the same key returns the existing row instead
  -- of creating a second one. Distinct from refundReference, which is
  -- Pantra's own generated identifier for the money-movement side.
  "idempotencyKey"                 text not null unique,
  "walletTransactionId"            uuid references public.wallet_transactions("id") on delete restrict,
  -- Informational only — see the trigger/processor comments for why this is
  -- never auto-applied. Proportional share of driverEarningsAmount this
  -- refund corresponds to, computed from the ride's own (already-locked)
  -- settlement figures, purely so an admin can see the business impact.
  "driverImpactAmount"             numeric(12,2),
  "requiresDriverAdjustmentReview" boolean not null default false,
  "failureReason"                  text,
  "createdAt"                      timestamptz not null default now(),
  "updatedAt"                      timestamptz not null default now()
);

alter table public.refund_intents
  add constraint refund_intents_source_check
  check (
    ("originalPaymentType" = 'wallet_topup' and "paymentIntentId" is not null and "rideId" is null) or
    ("originalPaymentType" = 'ride_wallet_payment' and "rideId" is not null and "paymentIntentId" is null)
  );

alter table public.refund_intents
  add constraint refund_intents_amount_within_original
  check ("amount" <= "originalAmount");

create index if not exists idx_refund_intents_payment_intent on public.refund_intents("paymentIntentId");
create index if not exists idx_refund_intents_ride            on public.refund_intents("rideId");
create index if not exists idx_refund_intents_user            on public.refund_intents("userId");
create index if not exists idx_refund_intents_status          on public.refund_intents("status");

alter table public.refund_intents enable row level security;

drop policy if exists "Users can read own refunds" on public.refund_intents;
create policy "Users can read own refunds" on public.refund_intents
  for select using (auth.uid() = "userId");
-- No insert/update policy for any client role — only service-role (the
-- admin refund routes and the refund processor) ever writes this table.

-- State-machine enforcement, same unconditional pattern as
-- payment_intents_lock_terminal_guard / driver_payouts_transition_guard —
-- every write already comes from service-role code.
create or replace function public.refund_intents_validate_transition()
returns trigger
language plpgsql as $$
begin
  if NEW."status" is distinct from OLD."status" then
    if not (
      (OLD."status" = 'requested'  and NEW."status" in ('processing', 'cancelled', 'failed')) or
      (OLD."status" = 'processing' and NEW."status" in ('completed', 'failed', 'unknown')) or
      (OLD."status" = 'unknown'    and NEW."status" in ('completed', 'failed')) or
      -- A completed refund may only ever be reversed — never resurrected
      -- into any other state, and never silently rewritten back to failed.
      (OLD."status" = 'completed'  and NEW."status" = 'reversed')
    ) then
      raise exception 'refund_intents %: invalid status transition % -> %', OLD."id", OLD."status", NEW."status";
    end if;
  end if;
  NEW."updatedAt" := now();
  return NEW;
end;
$$;

drop trigger if exists refund_intents_transition_guard on public.refund_intents;
create trigger refund_intents_transition_guard
  before update on public.refund_intents
  for each row execute function public.refund_intents_validate_transition();

-- Concurrency/amount-cap guard — the direct counterpart of
-- driver_payouts_check_balance: an advisory lock keyed by the ORIGINAL
-- payment (payment_intents.id or rides.id, whichever applies) serializes
-- concurrent refund requests against the same source, and the cap check
-- inside that lock is what actually prevents two concurrent partial refunds
-- from together exceeding the original amount (e.g. two ₦4,000 refunds
-- against a ₦5,000 payment) — a plain CHECK constraint on this table alone
-- cannot see other rows, so this has to be a trigger.
--
-- 'failed'/'cancelled'/'reversed' refunds do NOT count against the cap —
-- money was never actually removed (failed/cancelled) or was given back
-- again (reversed) in each of those cases, so that refundable room is
-- genuinely free again.
create or replace function public.refund_intents_check_amount()
returns trigger
language plpgsql as $$
declare
  v_lock_key text;
  v_already_refunded numeric;
begin
  v_lock_key := coalesce(NEW."paymentIntentId"::text, NEW."rideId"::text);
  perform pg_advisory_xact_lock(hashtext(v_lock_key));

  select coalesce(sum(r."amount"), 0) into v_already_refunded
  from public.refund_intents r
  where (
      (NEW."paymentIntentId" is not null and r."paymentIntentId" = NEW."paymentIntentId") or
      (NEW."rideId" is not null and r."rideId" = NEW."rideId")
    )
    and r."status" in ('requested', 'processing', 'unknown', 'completed')
    and r."id" is distinct from NEW."id";

  if v_already_refunded + NEW."amount" > NEW."originalAmount" then
    raise exception 'refund amount % would exceed the refundable balance (already refunded/in-flight: %, original: %)',
      NEW."amount", v_already_refunded, NEW."originalAmount";
  end if;

  return NEW;
end;
$$;

drop trigger if exists refund_intents_amount_guard on public.refund_intents;
create trigger refund_intents_amount_guard
  before insert on public.refund_intents
  for each row execute function public.refund_intents_check_amount();

-- ----------------------------------------------------------------
-- 2. refund_provider_attempts — the refund-specific idempotency ledger
-- ----------------------------------------------------------------
-- Same role as payout_provider_attempts: at most one in-flight attempt to
-- call a provider's refund API per refund_intents row. A wallet-only
-- refund (ride_wallet_payment) never uses this table at all — its
-- idempotency comes entirely from add_wallet_transaction's own
-- reference-based unique index plus this table's parent-row status guard.
create table if not exists public.refund_provider_attempts (
  "id"                 uuid primary key default gen_random_uuid(),
  "refundId"           uuid not null references public.refund_intents("id") on delete restrict,
  "provider"           text not null check ("provider" in ('paystack', 'flutterwave')),
  "refundReference"    text not null,
  "attemptStatus"      text not null default 'call_initiated'
                        check ("attemptStatus" in (
                          'call_initiated', 'call_succeeded', 'call_failed_network',
                          'call_failed_duplicate_reference', 'call_timeout', 'call_rejected'
                        )),
  "httpStatus"         integer,
  "failureReason"      text,
  "createdAt"          timestamptz not null default now(),
  "updatedAt"          timestamptz not null default now()
);

create index if not exists idx_refund_provider_attempts_refund on public.refund_provider_attempts("refundId");

create unique index if not exists idx_refund_provider_attempts_inflight
  on public.refund_provider_attempts("refundId") where "attemptStatus" = 'call_initiated';

alter table public.refund_provider_attempts enable row level security;
-- No client-facing policy — service-role only.

-- ----------------------------------------------------------------
-- 3. refund_events — provider refund webhook processing/audit log
-- ----------------------------------------------------------------
create table if not exists public.refund_events (
  "id"                 uuid primary key default gen_random_uuid(),
  "refundId"           uuid references public.refund_intents("id") on delete restrict,
  "provider"           text not null check ("provider" in ('paystack', 'flutterwave')),
  "refundReference"    text,
  "providerEventId"    text,
  "eventType"          text not null,
  "providerState"      text,
  "amount"             numeric(12,2),
  "currency"           text,
  "processingStatus"   text not null default 'received'
                        check ("processingStatus" in (
                          'received', 'processed', 'ignored_duplicate',
                          'rejected_unmatched_refund', 'rejected_amount_mismatch',
                          'rejected_currency_mismatch'
                        )),
  "failureReason"      text,
  "safeMetadata"       jsonb,
  "createdAt"           timestamptz not null default now(),
  "processedAt"         timestamptz
);

create unique index if not exists idx_refund_events_provider_event_id
  on public.refund_events ("provider", "providerEventId") where "providerEventId" is not null;
create index if not exists idx_refund_events_refund on public.refund_events("refundId");

alter table public.refund_events enable row level security;
-- No client-facing policy — service-role only.

-- ----------------------------------------------------------------
-- 4. payment_reconciliation_records — extended to cover refunds
-- ----------------------------------------------------------------
alter table public.payment_reconciliation_records
  add column if not exists "refundId" uuid references public.refund_intents("id") on delete restrict;

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
    -- Payment-side (Phase 2)
    'amount_mismatch', 'currency_mismatch',
    'unmatched_provider_transaction', 'pantra_success_provider_failed',
    -- Payout-side (Phase 3A)
    'payout_amount_mismatch', 'payout_currency_mismatch',
    'payout_unmatched_provider_transaction', 'payout_provider_reversed',
    'payout_unresolved_after_timeout',
    -- Refund-side (Phase 3B)
    'refund_amount_mismatch', 'refund_currency_mismatch',
    'refund_unmatched_provider_transaction', 'refund_reversed'
  ));

create index if not exists idx_payment_reconciliation_refund on public.payment_reconciliation_records("refundId");
