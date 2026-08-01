-- ============================================================
-- Pantra Ride App — Payment Methods Schema (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Safe to run on top of supabase-schema.sql (does not touch
-- existing tables/policies).
-- ============================================================

-- 1. PAYMENT METHODS table — cards/wallet entries per user
-- Note: only non-sensitive card metadata is stored (last 4 digits,
-- expiry, cardholder name). Full card numbers and CVVs are never
-- persisted anywhere in this app.
create table if not exists public.payment_methods (
  "id"         uuid primary key default gen_random_uuid(),
  "userId"     uuid references public.users("uid") on delete cascade,
  "type"       text check ("type" in ('card','cash','wallet')) not null,
  "name"       text not null,
  "lastFour"   text,
  "expiryDate" text,
  "isDefault"  boolean default false,
  "icon"       text,
  "createdAt"  timestamptz default now()
);

-- 2. INDEXES
create index if not exists idx_payment_methods_userId on public.payment_methods("userId");

-- 3. ROW LEVEL SECURITY
alter table public.payment_methods enable row level security;

create policy "Users can read own payment methods"
  on public.payment_methods for select using (auth.uid() = "userId");
create policy "Users can insert own payment methods"
  on public.payment_methods for insert with check (auth.uid() = "userId");
create policy "Users can update own payment methods"
  on public.payment_methods for update using (auth.uid() = "userId");
create policy "Users can delete own payment methods"
  on public.payment_methods for delete using (auth.uid() = "userId");
