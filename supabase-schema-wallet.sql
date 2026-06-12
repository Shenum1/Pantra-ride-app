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

create policy "Users can read own wallet"
  on public.wallets for select using (auth.uid() = "userId");
create policy "Users can create own wallet"
  on public.wallets for insert with check (auth.uid() = "userId");
create policy "Users can update own wallet"
  on public.wallets for update using (auth.uid() = "userId");

create policy "Users can read own wallet transactions"
  on public.wallet_transactions for select using (auth.uid() = "userId");
create policy "Users can create own wallet transactions"
  on public.wallet_transactions for insert with check (auth.uid() = "userId");

create policy "Users can read own bank accounts"
  on public.wallet_bank_accounts for select using (auth.uid() = "userId");
create policy "Users can insert own bank accounts"
  on public.wallet_bank_accounts for insert with check (auth.uid() = "userId");
create policy "Users can update own bank accounts"
  on public.wallet_bank_accounts for update using (auth.uid() = "userId");
create policy "Users can delete own bank accounts"
  on public.wallet_bank_accounts for delete using (auth.uid() = "userId");

-- 6. ATOMIC TRANSACTION FUNCTION
-- Creates the wallet row if missing, applies the balance change,
-- inserts the ledger row, and rejects debits that would overdraw —
-- all in one statement so concurrent requests can't race the balance.
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
  if auth.uid() is distinct from p_user_id then
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

  insert into public.wallet_transactions
    ("userId","type","amount","description","status","rideId","paymentMethodId","reference","metadata")
  values
    (p_user_id, p_type, p_amount, p_description, p_status, p_ride_id, p_payment_method_id, p_reference, p_metadata)
  returning * into v_txn;

  return v_txn;
end;
$$;

grant execute on function public.add_wallet_transaction(
  uuid, text, numeric, text, text, uuid, text, text, jsonb
) to authenticated;
