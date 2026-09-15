-- ============================================================
-- Pantra Ride App — Payment Intents (additive migration, Phase 2)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Run AFTER: supabase-schema.sql, supabase-schema-money-precision.sql.
--
-- Anchors "what we expect to receive" at initialize time, before any
-- provider interaction completes. Nothing today persists this — the
-- backend currently only learns about a payment via whatever the client
-- reports after checkout, which is exactly the reliability gap Phase 2
-- closes with webhooks. This table is what a webhook or client-verify call
-- validates the provider's confirmed amount/currency against.
-- ============================================================

create table if not exists public.payment_intents (
  "id"                    uuid primary key default gen_random_uuid(),
  "userId"                uuid not null references public.users("uid") on delete restrict,
  "provider"              text not null check ("provider" in ('paystack','flutterwave')),
  -- Generated server-side (PANTRA-<uuid>, see generatePaymentReference() in
  -- backend/lib/payment-providers.ts), handed to the provider as their own
  -- "reference"/"tx_ref", and echoed back verbatim by both providers on
  -- verify/webhook — this one string serves as both our internal reference
  -- and the provider's reference; no separate scheme is needed since we
  -- control what string the provider is given in the first place.
  "reference"             text not null unique,
  -- The provider's OWN internal transaction id (Paystack/Flutterwave
  -- data.id) — distinct from "reference", filled in once verified.
  "providerTransactionId" text,
  "purpose"               text not null default 'wallet_funding',
  "expectedAmount"        numeric(12,2) not null check ("expectedAmount" > 0),
  "currency"              text not null default 'NGN',
  "paymentMethodId"       text,
  -- 'successful' and 'failed' are the only TRUE terminal states (see the
  -- trigger below) — both are only ever set from a provider-CONFIRMED
  -- outcome. 'cancelled'/'expired' are Pantra's own administrative/
  -- idle-timeout markers, not provider-confirmed, so they remain able to
  -- transition to 'successful' if a late webhook/reconciliation pass finds
  -- the provider actually did succeed. A transient verification failure
  -- (network error, malformed response) becomes/stays 'unknown', never
  -- 'failed' — only an explicit provider failure status does that.
  "status"                text not null default 'initialized'
                           check ("status" in ('initialized','pending','successful','failed','cancelled','expired','unknown')),
  "createdAt"             timestamptz not null default now(),
  "updatedAt"             timestamptz not null default now()
);

create index if not exists idx_payment_intents_userId on public.payment_intents("userId");
create index if not exists idx_payment_intents_status  on public.payment_intents("status");

alter table public.payment_intents enable row level security;

drop policy if exists "Users can read own payment intents" on public.payment_intents;
create policy "Users can read own payment intents" on public.payment_intents
  for select using (auth.uid() = "userId");
-- No insert/update policy for any client role — only the service-role
-- client (initialize routes, the payment processor) ever writes this table.

-- Unconditional — NO auth.role() = 'service_role' bypass, unlike most other
-- Phase-1 triggers. Every single write to this table already comes from
-- service-role code (there is no client-facing write policy at all above),
-- so a bypass here would make the guard a complete no-op. Blocks any change
-- AWAY FROM 'successful' or 'failed' — those are the only two states this
-- function ever refuses to leave. Every other state (including
-- 'cancelled'/'expired') can still become 'successful' later, so a late
-- provider confirmation is never silently discarded.
create or replace function public.payment_intents_lock_terminal()
returns trigger
language plpgsql as $$
begin
  if OLD."status" in ('successful', 'failed') and NEW."status" is distinct from OLD."status" then
    raise exception 'payment_intents %: status is terminal (%) and cannot change', OLD."id", OLD."status";
  end if;
  return NEW;
end;
$$;

drop trigger if exists payment_intents_lock_terminal_guard on public.payment_intents;
create trigger payment_intents_lock_terminal_guard
  before update on public.payment_intents
  for each row execute function public.payment_intents_lock_terminal();
