-- ============================================================
-- Pantra Ride App — Rider wallet lockdown (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Run AFTER: supabase-schema-wallet.sql, supabase-schema-tips.sql
--            (redefines add_wallet_transaction from the tips version).
--
-- 1. Riders can no longer withdraw from their wallet to a bank account.
--    The app's withdraw screens were removed; this makes it impossible at
--    the database level too. (The old flow never actually sent money — it
--    only deducted the balance and recorded a 'pending' withdrawal nothing
--    ever processed. Checked before removal: no rider had used it, and no
--    rider bank accounts were saved.)
--
-- 2. Riders could change their own wallet balance directly. The original
--    wallet migration let a rider's own app session:
--      - UPDATE their wallets row (i.e. set any balance),
--      - INSERT their wallets row with any starting balance,
--      - INSERT wallet_transactions rows directly, and
--      - call add_wallet_transaction with a POSITIVE amount under a
--        "self-service" type (ride_payment / debit / withdraw), which
--        credits the wallet — bypassing the rule that only the backend may
--        credit after verifying a real payment.
--    All balance changes now go through add_wallet_transaction, where a
--    rider's own session may only ever DEBIT (ride payments). Credits stay
--    backend-only, exactly as before.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. add_wallet_transaction: own-session callers may only debit
-- ----------------------------------------------------------------
-- Identical to the supabase-schema-tips.sql version except the
-- authorization block. service_role (the backend) is unchanged and may
-- still write any type.
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
    null;
  elsif auth.uid() = p_user_id then
    if p_type = 'withdraw' then
      raise exception 'withdrawals from a rider wallet are not supported';
    end if;
    if p_type not in ('ride_payment', 'debit') then
      raise exception 'credit/tip transactions must be issued by the backend after verification';
    end if;
    if p_amount is null or p_amount >= 0 then
      raise exception 'a rider may only debit their own wallet';
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

-- ----------------------------------------------------------------
-- 2. Close direct writes to balances and the ledger
-- ----------------------------------------------------------------
-- add_wallet_transaction is SECURITY DEFINER, so it doesn't need these
-- policies to work; nothing else in the app writes these tables directly.
drop policy if exists "Users can update own wallet" on public.wallets;
drop policy if exists "Users can create own wallet transactions" on public.wallet_transactions;

-- The app creates an empty wallet on first open (lib/wallet-service.ts) —
-- still allowed, but only ever at a zero balance.
drop policy if exists "Users can create own wallet" on public.wallets;
create policy "Users can create own wallet"
  on public.wallets for insert
  with check (auth.uid() = "userId" and "balance" = 0);

-- ----------------------------------------------------------------
-- 3. Rider bank accounts: no longer collected
-- ----------------------------------------------------------------
-- Left in place (read/delete still allowed) rather than dropped, so this
-- migration never destroys data; it held no rows when the feature was
-- removed. Drivers' bank accounts are a separate table and unaffected.
drop policy if exists "Users can insert own bank accounts" on public.wallet_bank_accounts;
drop policy if exists "Users can update own bank accounts" on public.wallet_bank_accounts;
