-- ============================================================
-- Pantra Ride App — Payment Event Processing/Audit Log (additive migration, Phase 2)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Run AFTER: supabase-schema-payment-intents.sql.
--
-- This is a payment event PROCESSING/AUDIT LOG, not an append-only
-- event-sourcing table — rows are updated (processingStatus/processedAt/
-- updatedAt/failureReason all change after insert) as a webhook/verify
-- attempt is worked through. One row per verification/webhook ATTEMPT (a
-- retried webhook delivery gets its own row, even if it ends up
-- 'ignored_duplicate' — this is an attempt history, not just a final-state
-- snapshot).
-- ============================================================

create table if not exists public.payment_events (
  "id"                uuid primary key default gen_random_uuid(),
  "paymentIntentId"   uuid references public.payment_intents("id") on delete restrict,
  "provider"          text not null check ("provider" in ('paystack','flutterwave')),
  "reference"         text not null,
  -- Provider's own event/transaction id (Paystack/Flutterwave data.id) when
  -- available — the basis of the webhook-dedup unique index below. Null for
  -- client-verification-sourced events (there's no separate "event id" for
  -- those, only the reference).
  "providerEventId"   text,
  "eventType"         text not null,
  "sourceChannel"     text not null check ("sourceChannel" in ('webhook','client_verification','admin_reconciliation')),
  -- 'successful'|'failed'|'pending'|'unknown' — see ProviderState in
  -- backend/lib/payment-providers.ts.
  "providerState"     text,
  "amount"            numeric(12,2),
  "currency"          text,
  "processingStatus"  text not null default 'received'
                       check ("processingStatus" in (
                         'received','processed','ignored_duplicate','rejected_invalid_signature',
                         'rejected_amount_mismatch','rejected_currency_mismatch','rejected_unmatched_intent',
                         'provider_pending','provider_failed','provider_unknown'
                       )),
  "failureReason"     text,
  -- Curated subset only (status/amount/currency/paidAt/channel) — NEVER the
  -- full raw provider payload, which for a card charge can include an
  -- "authorization" object with bin/last4/bank metadata. Extracted
  -- explicitly by the payment processor, never a raw JSON.stringify(payload).
  "safeMetadata"      jsonb,
  "createdAt"         timestamptz not null default now(),
  "processedAt"       timestamptz,
  "updatedAt"         timestamptz not null default now()
);

-- Webhook-delivery dedup: a duplicate delivery of the same provider event
-- hits this and short-circuits to 'ignored_duplicate' before even calling
-- the provider verify API again. NOT the primary concurrency guard — that's
-- add_wallet_transaction's existing partial unique index on
-- wallet_transactions("reference"), unchanged from Phase 1. This is a
-- second, audit-layer dedup on top, not a replacement.
create unique index if not exists idx_payment_events_provider_event_id
  on public.payment_events ("provider", "providerEventId")
  where "providerEventId" is not null;

create index if not exists idx_payment_events_reference on public.payment_events("reference");
create index if not exists idx_payment_events_intent    on public.payment_events("paymentIntentId");

alter table public.payment_events enable row level security;
-- No client-facing policy at all — admin/service-role only, same pattern as
-- driver_bank_accounts after Phase 1's encryption migration.
