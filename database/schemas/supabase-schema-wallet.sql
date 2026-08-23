-- ============================================================
-- Pantra Ride App — Wallet Schema (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Safe to run on top of supabase-schema.sql (does not touch
-- existing tables/policies).
-- ============================================================

-- 1. WALLETS table — one row per user, holds the running balance
create table if not exists public.wallets (
  "userId"    uuid primary key references public.users("uid") on delete cascade,
  "balance"   numeric not null default 0,
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now()
);

-- 2. WALLET TRANSACTIONS table — append-only ledger
create table if not exists public.wallet_transactions (
  "id"               uuid primary key default gen_random_uuid(),
  "userId"           uuid references public.users("uid") on delete cascade,
  "type"             text check ("type" in ('credit','debit','refund','cashback','ride_payment','add_money','withdraw')),
  "amount"           numeric not null,
  "description"      text,
  "status"           text check ("status" in ('completed','pending','failed')) default 'completed',
  "rideId"           uuid references public.rides("id"),
  "paymentMethodId"  text,
  "reference"        text,
  "metadata"         jsonb,
  "createdAt"        timestamptz default now()
);

-- 3. WALLET BANK ACCOUNTS table
create table if not exists public.wallet_bank_accounts (
  "id"                 uuid primary key default gen_random_uuid(),
  "userId"             uuid references public.users("uid") on delete cascade,
  "bankName"           text not null,
  "accountNumber"      text not null,
  "accountHolderName"  text not null,
  "ifscCode"           text,
  "swiftCode"          text,
  "type"               text check ("type" in ('savings','checking')) default 'savings',
  "isDefault"          boolean default false,
  "isVerified"         boolean default false,
  "createdAt"          timestamptz default now()
);

-- 4. INDEXES
create index if not exists idx_wallet_transactions_userId    on public.wallet_transactions("userId");
create index if not exists idx_wallet_transactions_createdAt on public.wallet_transactions("createdAt" desc);
create index if not exists idx_wallet_bank_accounts_userId   on public.wallet_bank_accounts("userId");

-- 5. ROW LEVEL SECURITY
alter table public.wallets             enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.wallet_bank_accounts enable row level security;

-- drop-then-create so this file is safe to re-run against a database that
-- already has these policies from a previous run.
drop policy if exists "Users can read own wallet" on public.wallets;
create policy "Users can read own wallet"
  on public.wallets for select using (auth.uid() = "userId");
drop policy if exists "Users can create own wallet" on public.wallets;
create policy "Users can create own wallet"
  on public.wallets for insert with check (auth.uid() = "userId");
drop policy if exists "Users can update own wallet" on public.wallets;
create policy "Users can update own wallet"
  on public.wallets for update using (auth.uid() = "userId");

drop policy if exists "Users can read own wallet transactions" on public.wallet_transactions;
create policy "Users can read own wallet transactions"
  on public.wallet_transactions for select using (auth.uid() = "userId");
drop policy if exists "Users can create own wallet transactions" on public.wallet_transactions;
create policy "Users can create own wallet transactions"
  on public.wallet_transactions for insert with check (auth.uid() = "userId");

drop policy if exists "Users can read own bank accounts" on public.wallet_bank_accounts;
create policy "Users can read own bank accounts"
  on public.wallet_bank_accounts for select using (auth.uid() = "userId");
drop policy if exists "Users can insert own bank accounts" on public.wallet_bank_accounts;
create policy "Users can insert own bank accounts"
  on public.wallet_bank_accounts for insert with check (auth.uid() = "userId");
drop policy if exists "Users can update own bank accounts" on public.wallet_bank_accounts;
create policy "Users can update own bank accounts"
  on public.wallet_bank_accounts for update using (auth.uid() = "userId");
drop policy if exists "Users can delete own bank accounts" on public.wallet_bank_accounts;
create policy "Users can delete own bank accounts"
  on public.wallet_bank_accounts for delete using (auth.uid() = "userId");

-- 6. ATOMIC TRANSACTION FUNCTION
-- Creates the wallet row if missing, applies the balance change,
-- inserts the ledger row, and rejects debits that would overdraw —
-- all in one statement so concurrent requests can't race the balance.
--
-- Callers, and what each may do:
--  - The service-role backend (payments.wallet.credit, after it has
--    re-verified a real payment with Paystack/Flutterwave server-side, or an
--    admin route) — may write any transaction type. This is the ONLY path
--    that may create wallet-crediting entries.
--  - The wallet owner's own authenticated session — may only write
--    self-service debits/movements they're entitled to trigger directly
--    (ride_payment, withdraw, debit). Credit types (add_money, refund,
--    cashback, credit) are rejected here: letting a plain authenticated
--    client call this RPC with an arbitrary add_money amount would mint
--    wallet balance with no real payment behind it.
create or replace function public.add_wallet_transaction(
  p_user_id uuid,
  p_type text,
  p_amount numeric,
  p_description text,
  p_status text default 'completed',
  p_ride_id uuid default null,
  p_payment_method_id text default null,
  p_reference text default null,
  p_metadata jsonb default null
) returns public.wallet_transactions
language plpgsql security definer as $$
declare
  v_balance numeric;
  v_txn public.wallet_transactions;
begin
  if auth.role() = 'service_role' then
    -- backend-authorized call (already re-verified the payment) — unrestricted
    null;
  elsif auth.uid() = p_user_id then
    if p_type in ('add_money', 'refund', 'cashback', 'credit') then
      raise exception 'credit transactions must be issued by the backend after payment verification';
    end if;
  else
    raise exception 'not authorized';
  end if;

  insert into public.wallets ("userId", "balance")
  values (p_user_id, 0)
  on conflict ("userId") do nothing;

  select "balance" into v_balance from public.wallets where "userId" = p_user_id for update;

  if p_amount < 0 and v_balance + p_amount < 0 then
    raise exception 'insufficient balance';
  end if;

  update public.wallets
  set "balance" = "balance" + p_amount, "updatedAt" = now()
  where "userId" = p_user_id;

  begin
    insert into public.wallet_transactions
      ("userId","type","amount","description","status","rideId","paymentMethodId","reference","metadata")
    values
      (p_user_id, p_type, p_amount, p_description, p_status, p_ride_id, p_payment_method_id, p_reference, p_metadata)
    returning * into v_txn;
  exception
    when unique_violation then
      -- Same payment reference credited twice (double-tap "Verify Payment",
      -- a re-fired deep-link callback, etc.) — the balance update above is
      -- rolled back automatically by this EXCEPTION block, so return the
      -- original transaction instead of crediting a second time.
      select * into v_txn
      from public.wallet_transactions
      where "reference" = p_reference and "type" = p_type
      limit 1;
  end;

  return v_txn;
end;
$$;

grant execute on function public.add_wallet_transaction(
  uuid, text, numeric, text, text, uuid, text, text, jsonb
) to authenticated, service_role;

-- Idempotency for verified-payment credits: the same payment reference can
-- never create two add_money/refund ledger rows. Partial (only applies to
-- credit types with a non-null reference) so ride_payment/withdraw/etc. —
-- which don't carry a provider reference — are unaffected.
create unique index if not exists idx_wallet_transactions_reference_credit
  on public.wallet_transactions ("reference")
  where "reference" is not null and "type" in ('add_money', 'refund');
