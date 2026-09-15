-- ============================================================
-- Pantra Ride App — Payment Reconciliation Records (additive migration, Phase 2)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Run AFTER: supabase-schema-payment-events.sql.
--
-- Only genuinely-unresolvable-by-code mismatches ever get a row here.
-- "Provider success + wallet already credited" and "provider success +
-- wallet credit missing" both self-heal via processVerifiedPayment (the
-- same idempotent function every caller uses) and never produce a record —
-- only amount/currency mismatches, an unmatched provider reference, or a
-- successful Pantra payment the provider later disowns require a human to
-- look at them.
-- ============================================================

create table if not exists public.payment_reconciliation_records (
  "id"                   uuid primary key default gen_random_uuid(),
  "paymentIntentId"      uuid references public.payment_intents("id") on delete restrict,
  "provider"             text not null,
  "reference"            text not null,
  "expectedAmount"       numeric(12,2),
  "providerAmount"       numeric(12,2),
  "currency"             text,
  "pantraStatus"         text,
  "providerStatus"       text,
  "mismatchType"         text not null check ("mismatchType" in (
                           'amount_mismatch','currency_mismatch',
                           'unmatched_provider_transaction','pantra_success_provider_failed'
                         )),
  "reconciliationStatus" text not null default 'open' check ("reconciliationStatus" in ('open','resolved','ignored')),
  "detectedAt"           timestamptz not null default now(),
  "resolvedAt"           timestamptz,
  "notes"                text
);

create index if not exists idx_payment_reconciliation_status on public.payment_reconciliation_records("reconciliationStatus");

alter table public.payment_reconciliation_records enable row level security;
-- No client-facing policy — admin/service-role only.
