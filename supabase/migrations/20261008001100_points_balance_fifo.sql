-- ============================================================
-- Points balance: spent points can no longer be "un-spent" by expiry
-- ============================================================
-- The old balance was "sum of every unexpired row". Earned points expire after
-- 90 days but a spend row (a negative amount) never does, so once the earned
-- points a rider had spent reached their expiry date, their balance dropped by
-- the spent amount a second time and quietly swallowed their next earnings.
-- Returned points (cancelled / refunded rides) hit the same problem.
--
-- Rule now: points are lots (each earn or return row, with its own expiry).
-- A spend uses up lots that are still valid at the time of the spend,
-- earliest expiry first. Points that were used up never expire again. The
-- balance is what remains in lots that are still valid now. It is never
-- negative.
--
-- points_balance() is the single source of truth: the user_points_balance
-- view (the app's balance), reserve_ride_points() and rides.create all use it.
-- A returned ride's points still get a fresh 90 days (they are a new lot),
-- which means cancelling a ride can extend the life of points that were about
-- to expire; accepted as the simplest fair rule, flagged for the owner.
-- Re-runnable.
-- ============================================================

create or replace function public.points_balance(p_user_id text)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r record;
  lot_amount integer[] := '{}';
  lot_expiry timestamptz[] := '{}';
  v_need integer;
  v_take integer;
  v_idx integer;
  v_total integer := 0;
  i integer;
begin
  -- The backend may ask about anyone; a signed-in user only about themselves.
  if auth.role() is distinct from 'service_role'
     and auth.uid()::text is distinct from p_user_id
  then
    return 0;
  end if;

  for r in
    select "amount", "expiresAt", "createdAt"
    from public.points_transactions
    where "userId" = p_user_id
    -- At the same instant, earns come before spends, so a spend can always use points earned at that moment.
    order by "createdAt", ("amount" > 0) desc, "id"
  loop
    if r."amount" > 0 then
      lot_amount := lot_amount || r."amount";
      lot_expiry := lot_expiry || coalesce(r."expiresAt", 'infinity'::timestamptz);
    elsif r."amount" < 0 then
      v_need := -r."amount";
      while v_need > 0 loop
        select t.ord::integer into v_idx
        from unnest(lot_expiry, lot_amount) with ordinality as t(expiry, amount, ord)
        where t.amount > 0 and t.expiry > r."createdAt"
        order by t.expiry, t.ord
        limit 1;

        exit when v_idx is null;

        v_take := least(v_need, lot_amount[v_idx]);
        lot_amount[v_idx] := lot_amount[v_idx] - v_take;
        v_need := v_need - v_take;
        v_idx := null;
      end loop;
    end if;
  end loop;

  for i in 1 .. coalesce(array_length(lot_amount, 1), 0) loop
    if lot_expiry[i] > now() then
      v_total := v_total + lot_amount[i];
    end if;
  end loop;

  return v_total;
end;
$$;

revoke all on function public.points_balance(text) from public, anon;
grant execute on function public.points_balance(text) to authenticated, service_role;

-- The app's balance view keeps its name and columns; it is now correct and
-- never negative. security_invoker: a signed-in user only sees their own row.
create or replace view public.user_points_balance
with (security_invoker = true) as
select u."userId", public.points_balance(u."userId") as balance
from (select distinct "userId" from public.points_transactions) u;

revoke all on table public.user_points_balance from anon, authenticated;
grant select on table public.user_points_balance to authenticated;

-- reserve_ride_points: same as before, but the balance comes from points_balance().
create or replace function public.reserve_ride_points(p_user_id text, p_ride_id uuid, p_points integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_points is null or p_points <= 0 then
    return;
  end if;

  -- One rider's reservations run one at a time, so two bookings can't spend the same points.
  perform pg_advisory_xact_lock(hashtext('points:' || p_user_id));

  v_balance := public.points_balance(p_user_id);

  if v_balance < p_points then
    raise exception 'INSUFFICIENT_POINTS';
  end if;

  -- clock_timestamp(), not now(): the spend is stamped when it really happens, after the lock.
  insert into public.points_transactions ("userId", "amount", "type", "referenceId", "description", "expiresAt", "createdAt")
  values (p_user_id, -p_points, 'ride_redemption', p_ride_id::text,
          'Ride payment — ' || p_points || ' points', null, clock_timestamp())
  on conflict ("referenceId") where type = 'ride_redemption' do nothing;
end;
$$;

revoke all on function public.reserve_ride_points(text, uuid, integer) from public, anon, authenticated;
grant execute on function public.reserve_ride_points(text, uuid, integer) to service_role;
