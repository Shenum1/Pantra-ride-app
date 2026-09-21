-- ============================================================
-- Pantra Ride App — Flutterwave Refund Identifier Storage (Phase 3B hardening)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Run AFTER: supabase-schema-refunds.sql.
--
-- refund_intents.providerRefundId already stores the refund's own id
-- (Paystack's `id`, or Flutterwave's `id`). Flutterwave ALSO returns a
-- separate `flw_ref` string on every refund — a second identifier used for
-- provider-side lookups (GET /v3/refunds?flw_ref=...) that this migration
-- gives its own column, rather than overloading providerRefundId with two
-- different meanings depending on provider.
-- ============================================================

alter table public.refund_intents add column if not exists "providerRefundReference" text;

create index if not exists idx_refund_intents_provider_refund_reference
  on public.refund_intents ("providerRefundReference") where "providerRefundReference" is not null;
