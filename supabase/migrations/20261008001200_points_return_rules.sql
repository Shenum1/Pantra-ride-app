-- ============================================================
-- Returned points: keep their original expiry, and partial refunds return a share
-- ============================================================
-- Owner decisions (2026-10-09):
--   1. Points returned for a cancelled / refunded ride keep their ORIGINAL expiry,
--      so booking-and-cancelling can't keep points alive. Grace: if the original
--      expiry is less than 7 days away (or has already passed), the returned
--      points last exactly 7 days from the return.
--   2. A partial refund returns points in proportion to the share of the ride's
--      wallet payment refunded, rounded DOWN to whole points, counted
--      cumulatively so several partial refunds never over- or under-return.
--
-- A ride's points can come from several earned batches (lots) with different
-- expiry dates, so the return is split the same way the spend used them
-- (earliest-expiring first, as in points_balance). Re-runnable.
-- ============================================================

-- Several return rows per ride are now normal (one per lot, and one per partial
-- refund); the total is capped inside refund_ride_points instead.
drop index if exists public.idx_points_one_refund_per_ride;
create index if not exists idx_points_refund_by_ride
  on public.points_transactions ("referenceId") where type = 'ride_refund';

-- Which lots a ride's points were taken from, in the order they were used.
create or replace function public.ride_redemption_pieces(p_user_id text, p_ride_id uuid)
returns table (piece_order integer, piece_points integer, piece_expiry timestamptz)
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
  v_n integer := 0;
  v_is_target boolean;
begin
  for r in
    select "amount", "expiresAt", "createdAt", "type", "referenceId"
    from public.points_transactions
    where "userId" = p_user_id
    order by "createdAt", ("amount" > 0) desc, "id"
  loop
    if r."amount" > 0 then
      lot_amount := lot_amount || r."amount";
      lot_expiry := lot_expiry || coalesce(r."expiresAt", 'infinity'::timestamptz);
    elsif r."amount" < 0 then
      v_is_target := (r."type" = 'ride_redemption' and r."referenceId" = p_ride_id::text);
      v_need := -r."amount";
      while v_need > 0 loop
        select t.ord::integer into v_idx
        from unnest(lot_expiry, lot_amount) with ordinality as t(e, a, ord)
        where t.a > 0 and t.e > r."createdAt"
        order by t.e, t.ord
        limit 1;

        exit when v_idx is null;

        v_take := least(v_need, lot_amount[v_idx]);
        lot_amount[v_idx] := lot_amount[v_idx] - v_take;
        v_need := v_need - v_take;

        if v_is_target then
          v_n := v_n + 1;
          piece_order := v_n;
          piece_points := v_take;
          piece_expiry := lot_expiry[v_idx];
          return next;
        end if;
        v_idx := null;
      end loop;

      if v_is_target then
        return;
      end if;
    end if;
  end loop;
end;
$$;

revoke all on function public.ride_redemption_pieces(text, uuid) from public, anon, authenticated;
grant execute on function public.ride_redemption_pieces(text, uuid) to service_role;

-- Return a ride's points. With no amounts: all of them (cancellation, full refund).
-- With p_refunded / p_original (the cumulative wallet refund and the original wallet
-- payment for the ride): the proportional share, rounded down. Idempotent and
-- cumulative: it only returns what is still owed. Returns how many points this call returned.
drop function if exists public.refund_ride_points(uuid);

create or replace function public.refund_ride_points(
  p_ride_id uuid,
  p_refunded numeric default null,
  p_original numeric default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.points_transactions;
  v_points integer;
  v_fraction numeric;
  v_target integer;
  v_already integer;
  v_give integer;
  v_skip integer;
  v_returned integer := 0;
  v_take integer;
  v_expiry timestamptz;
  p record;
begin
  select * into v_row
  from public.points_transactions
  where "referenceId" = p_ride_id::text and "type" = 'ride_redemption';

  if not found then
    return 0;
  end if;

  perform pg_advisory_xact_lock(hashtext('points:' || v_row."userId"));

  v_points := -v_row."amount";

  if p_refunded is null or p_original is null or p_original <= 0 then
    v_fraction := 1;
  else
    v_fraction := least(greatest(p_refunded / p_original, 0), 1);
  end if;

  v_target := floor(v_points * v_fraction)::integer;

  select coalesce(sum("amount"), 0)::integer into v_already
  from public.points_transactions
  where "referenceId" = p_ride_id::text and "type" = 'ride_refund';

  v_give := v_target - v_already;
  if v_give <= 0 then
    return 0;
  end if;

  -- Walk the lots this ride used, skip the points already returned, and return the
  -- rest to lots that keep their original expiry (minimum 7 days from now).
  v_skip := v_already;
  for p in select * from public.ride_redemption_pieces(v_row."userId", p_ride_id) order by piece_order loop
    if v_skip >= p.piece_points then
      v_skip := v_skip - p.piece_points;
      continue;
    end if;

    v_take := least(p.piece_points - v_skip, v_give - v_returned);
    v_skip := 0;

    v_expiry := case
      when p.piece_expiry = 'infinity'::timestamptz then null
      else greatest(p.piece_expiry, now() + interval '7 days')
    end;

    insert into public.points_transactions ("userId", "amount", "type", "referenceId", "description", "expiresAt")
    values (v_row."userId", v_take, 'ride_refund', p_ride_id::text,
            'Points returned — ride cancelled or refunded', v_expiry);

    v_returned := v_returned + v_take;
    exit when v_returned >= v_give;
  end loop;

  return v_returned;
end;
$$;

revoke all on function public.refund_ride_points(uuid, numeric, numeric) from public, anon, authenticated;
grant execute on function public.refund_ride_points(uuid, numeric, numeric) to service_role;

-- The cancel trigger calls refund_ride_points(NEW.id): all points, default arguments.
