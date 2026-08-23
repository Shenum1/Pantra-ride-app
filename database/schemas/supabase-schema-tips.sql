-- ============================================================
-- Pantra Ride App — Driver Tips Schema (additive migration)
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- Prerequisite: supabase-schema-wallet.sql AND
-- supabase-schema-driver-payouts.sql must already be applied — this file
-- CREATE OR REPLACEs functions first defined there. Safe to re-run.
-- ============================================================

-- 1. TIPS table — its own transaction identity, separate from
-- wallet_transactions/rides. A tip is a 100%-driver / 0%-platform payment,
-- never folded into ride fare or commission (see create_tip() below).
create table if not exists public.tips (
  "id"               uuid primary key default gen_random_uuid(),
  "rideId"           uuid not null references public.rides("id"),
  "riderId"          uuid not null references public.users("uid"),
  "driverId"         uuid not null references public.drivers("id"),
  "amount"           numeric not null check ("amount" > 0),
  "currency"         text not null default 'NGN',
  -- Only 'wallet' is a real, live payment method today (online card payment
  -- isn't wired into ride checkout anywhere in this app) — structured as a
  -- CHECK list, not a single hardcoded assumption, so a second method can be
  -- added later without a schema rewrite.
  "paymentMethod"    text not null check ("paymentMethod" in ('wallet')),
  "paymentReference" text,
  "idempotencyKey"   uuid not null,
  "status"           text not null check ("status" in ('pending','successful','failed','cancelled','refunded')) default 'pending',
  "createdAt"        timestamptz not null default now(),
  "updatedAt"        timestamptz not null default now()
);

-- Accidental-duplicate guard only — NOT a one-tip-per-ride constraint. The
-- client generates one idempotencyKey per tip *attempt* and reuses it across
-- retries of that same attempt (see app/tip-driver.tsx); a later, genuinely
-- separate tip on the same ride uses a fresh key and is not blocked here.
create unique index if not exists idx_tips_rider_idempotency
  on public.tips ("riderId", "idempotencyKey");

create index if not exists idx_tips_rideId   on public.tips ("rideId");
create index if not exists idx_tips_driverId on public.tips ("driverId", "status");

-- 2. RLS — read-only for everyone. No insert/update/delete policy exists for
-- either rider or driver: every write goes through create_tip() below
-- (security definer, grantable only to service_role), the same shape
-- add_wallet_transaction already uses to govern wallet_transactions. This is
-- what actually enforces "rider cannot mark a tip successful / change its
-- amount / create a fake tip for another rider's ride" — RLS alone can't
-- express the ride-ownership/status/window checks that require reading
-- another table.
alter table public.tips enable row level security;

drop policy if exists "Riders can view own tips" on public.tips;
create policy "Riders can view own tips"
  on public.tips for select using (auth.uid() = "riderId");

drop policy if exists "Drivers can view own tips" on public.tips;
create policy "Drivers can view own tips"
  on public.tips for select using (
    auth.uid() in (select "userId" from public.drivers where "id" = "driverId")
  );

-- 3. Widen wallet_transactions.type to allow 'tip'. Resolved via the
-- column's actual attnum (pg_constraint.conkey / pg_attribute), not by
-- string-matching pg_get_constraintdef()'s rendered text — a sibling
-- migration (supabase-schema-driver-verification-v2.sql) hit exactly this
-- bug: an unreserved lowercase column like "type" is never quoted in the
-- rendered definition, so a literal '%"type"%' pattern silently matches
-- nothing on a re-run and leaves a stale constraint in place.
do $$
declare
  v_conname text;
begin
  select con.conname into v_conname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'wallet_transactions'
    and con.contype = 'c'
    and con.conkey = (
      select array_agg(attnum order by attnum)
      from pg_attribute
      where attrelid = rel.oid and attname = 'type'
    );

  if v_conname is not null then
    execute format('alter table public.wallet_transactions drop constraint %I', v_conname);
  end if;
end $$;

alter table public.wallet_transactions
  add constraint wallet_transactions_type_check
  check ("type" in ('credit','debit','refund','cashback','ride_payment','add_money','withdraw','tip'));

-- 4. Re-declare add_wallet_transaction (canonical definition:
-- supabase-schema-wallet.sql) — widening ONLY the self-caller-blocked type
-- list to also include 'tip', so a rider's own session can never directly
-- debit their wallet as type='tip' bypassing ride/window/amount validation;
-- only create_tip(), running as service_role, may write a tip-type wallet
-- transaction. Everything else in this function is unchanged.
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
    if p_type in ('add_money', 'refund', 'cashback', 'credit', 'tip') then
      raise exception 'credit/tip transactions must be issued by the backend after verification';
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

-- 5. create_tip() — the sole write path onto public.tips, and the only
-- function allowed to create a tip-type wallet_transactions row.
create or replace function public.create_tip(
  p_rider_id uuid,
  p_ride_id uuid,
  p_driver_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_idempotency_key uuid
) returns public.tips
language plpgsql security definer as $$
declare
  v_min_amount   constant numeric := 50;    -- keep in sync with TIP_CONFIG.minAmount, lib/pricing-config.ts
  v_max_amount   constant numeric := 50000; -- keep in sync with TIP_CONFIG.maxAmount, lib/pricing-config.ts
  v_window_hours constant numeric := 72;    -- keep in sync with TIP_CONFIG.windowHours, lib/pricing-config.ts
  v_ride record;
  v_wallet_txn public.wallet_transactions;
  v_tip public.tips;
begin
  if auth.role() <> 'service_role' then
    raise exception 'not authorized';
  end if;

  -- Idempotency short-circuit, backed by an advisory lock so two concurrent
  -- calls with the identical key (a double-tap that both got past the UI's
  -- own debounce, a retried request after a timeout) can't both pass this
  -- check and both debit the wallet — the unique index on
  -- (riderId, idempotencyKey) alone isn't enough, because by the time it
  -- would fire the wallet debit already happened and can't be undone from
  -- inside this function. Same technique already used by
  -- driver_payouts_check_balance().
  perform pg_advisory_xact_lock(hashtext(p_rider_id::text || ':' || p_idempotency_key::text));

  select * into v_tip from public.tips
  where "riderId" = p_rider_id and "idempotencyKey" = p_idempotency_key;
  if found then
    return v_tip;
  end if;

  if p_payment_method not in ('wallet') then
    raise exception 'unsupported payment method: %', p_payment_method;
  end if;

  if p_amount is null or p_amount <> trunc(p_amount) or p_amount < v_min_amount or p_amount > v_max_amount then
    raise exception 'invalid tip amount: %', p_amount;
  end if;

  select "id","userId","driverId","status","paymentStatus","completedAt"
    into v_ride from public.rides where "id" = p_ride_id for update;

  if not found then
    raise exception 'ride not found';
  end if;
  if v_ride."userId" is distinct from p_rider_id then
    raise exception 'ride does not belong to this rider';
  end if;
  if v_ride."driverId" is distinct from p_driver_id then
    raise exception 'driver does not match this ride';
  end if;
  if v_ride."status" <> 'completed' then
    raise exception 'ride is not completed';
  end if;
  if v_ride."paymentStatus" <> 'paid' then
    raise exception 'ride payment is not settled';
  end if;
  if v_ride."completedAt" is null or v_ride."completedAt" < (now() - (v_window_hours || ' hours')::interval) then
    raise exception 'tip window has closed for this ride';
  end if;
  if not exists (select 1 from public.drivers where "id" = p_driver_id) then
    raise exception 'driver not found';
  end if;

  -- The ONLY money movement a tip causes. rides.fare / platformCommission* /
  -- driverEarningsAmount are never read or written here — a tip is a
  -- separate, 100%-driver / 0%-platform transaction by construction (this
  -- function never computes a commission for it at all, not via a zero
  -- rate). Reuses the existing atomic, overdraft-safe debit; insufficient
  -- balance raises here and aborts the whole function, so no tips row and
  -- no partial debit ever result — the same idempotencyKey can then be
  -- safely retried after the rider tops up.
  select * into v_wallet_txn from public.add_wallet_transaction(
    p_rider_id, 'tip', -p_amount, 'Tip for ride ' || p_ride_id::text,
    'completed', p_ride_id, p_payment_method, p_idempotency_key::text,
    jsonb_build_object('driverId', p_driver_id)
  );

  insert into public.tips
    ("rideId","riderId","driverId","amount","currency","paymentMethod","paymentReference","idempotencyKey","status")
  values
    (p_ride_id, p_rider_id, p_driver_id, p_amount, 'NGN', p_payment_method, v_wallet_txn."id"::text, p_idempotency_key, 'successful')
  returning * into v_tip;

  return v_tip;
end;
$$;

-- Only the service-role backend may call this — never a plain rider
-- session, even though the function re-validates ride ownership internally
-- as defense in depth.
revoke all on function public.create_tip(uuid, uuid, uuid, numeric, text, uuid) from public, authenticated;
grant execute on function public.create_tip(uuid, uuid, uuid, numeric, text, uuid) to service_role;

-- 6. Fold successful tips into the driver's withdrawable balance — the only
-- payment rail this codebase has for actually paying a driver out. Ride
-- earnings and tips remain separate everywhere they're DISPLAYED
-- (DriverStats/DriverEarnings, driver-earnings.tsx, wallet.tsx); this
-- function only answers "how much can be withdrawn right now."
create or replace function public.get_driver_available_balance(driver_id text)
returns numeric
language sql stable as $$
  select greatest(
    coalesce((
      select sum(r."driverEarningsAmount")
      from public.rides r
      where r."driverId"::text = driver_id
        and r."status" = 'completed'
        and r."paymentStatus" = 'paid'
    ), 0)
    + coalesce((
      select sum(t."amount")
      from public.tips t
      where t."driverId"::text = driver_id
        and t."status" = 'successful'
    ), 0)
    - coalesce((
      select sum(p."amount")
      from public.driver_payouts p
      where p."driverId" = driver_id
        and p."status" in ('pending', 'processing', 'completed')
    ), 0),
    0
  );
$$;

-- ============================================================
-- Refunds: tips.status already includes 'refunded' so the schema can
-- support it, but no refund-triggering code exists yet in this pass — same
-- treatment as wallet_transactions.type including 'refund' with no
-- execution path. Document as future work, do not fake a refund by just
-- flipping this status column.
-- ============================================================
