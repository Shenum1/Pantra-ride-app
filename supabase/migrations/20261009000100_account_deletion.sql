-- Account deletion (Apple/Google/NDPA requirement) and a database-side rate limiter.
--
-- Deleting an account REMOVES THE PERSON, NOT THE MONEY TRAIL. Wallet, payout, refund and commission
-- records are protected by foreign keys on purpose (ON DELETE RESTRICT), and rides keep their fare
-- figures for accounting. So deletion means: erase every personal detail, keep the financial rows, and
-- make them point to an account that is no longer a real person. How long those rows are then kept is
-- a business/legal decision that is still open (docs/legal/privacy-policy.md section 7).
--
--   account_deletion_blockers(user)  what stops this account being deleted right now (empty = nothing)
--   anonymise_account(user)          erases the personal details in one transaction, returns what the
--                                    server must still remove from file storage
--   rate_limit_hit(key, limit, secs) counts a request and says whether the caller is over the limit
--
-- All three are for the backend only (service_role); the apps cannot call them.

-- 1. What stops an account being deleted ----------------------------------------------------------------------
create or replace function public.account_deletion_blockers(p_user_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_blockers text[] := '{}';
  v_driver_id uuid;
  v_net numeric;
begin
  select d."id" into v_driver_id from public.drivers d where d."userId" = p_user_id limit 1;

  -- Another admin has to remove an admin account first, so the platform is never left without one by accident.
  if exists (select 1 from public.user_roles ur where ur."userId" = p_user_id and ur."role" = 'admin') then
    v_blockers := array_append(v_blockers, 'ADMIN_ACCOUNT');
  end if;

  -- A trip that is still happening, as rider or driver.
  if exists (
    select 1 from public.rides r
    where r."status" in ('pending', 'accepted', 'in-progress')
      and (r."userId" = p_user_id or (v_driver_id is not null and r."driverId" = v_driver_id))
  ) then
    v_blockers := array_append(v_blockers, 'ACTIVE_RIDE');
  end if;

  -- Money still in the rider wallet: nobody loses money by deleting by accident.
  if exists (select 1 from public.wallets w where w."userId" = p_user_id and w."balance" > 0) then
    v_blockers := array_append(v_blockers, 'WALLET_BALANCE');
  end if;

  -- A refund that is still on its way to the rider.
  if exists (
    select 1 from public.refund_intents ri
    where ri."userId" = p_user_id and ri."status" in ('requested', 'processing', 'unknown')
  ) then
    v_blockers := array_append(v_blockers, 'PENDING_REFUND');
  end if;

  if v_driver_id is not null then
    -- A payout that has not finished.
    if exists (
      select 1 from public.driver_payouts p
      where p."driverId" = v_driver_id::text and p."status" in ('pending', 'processing', 'manual_review')
    ) then
      v_blockers := array_append(v_blockers, 'PENDING_PAYOUT');
    end if;

    -- Earnings still owed to the driver, or cash commission the driver still owes the platform.
    v_net := public.get_driver_net_balance(v_driver_id::text);
    if v_net >= 0.01 then
      v_blockers := array_append(v_blockers, 'DRIVER_EARNINGS_OWED');
    elsif v_net <= -0.01 then
      v_blockers := array_append(v_blockers, 'DRIVER_COMMISSION_OWED');
    end if;
  end if;

  return v_blockers;
end;
$$;

revoke all on function public.account_deletion_blockers(uuid) from public, anon, authenticated;
grant execute on function public.account_deletion_blockers(uuid) to service_role;

-- 2. Erase the personal details ----------------------------------------------------------------------------------
-- Safe to run again: a second run finds nothing left to erase. Refuses (with the blocker codes in the
-- error message) if the account cannot be deleted yet.
create or replace function public.anonymise_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_blockers text[];
  v_driver_id uuid;
  v_document_paths text[] := '{}';
begin
  if not exists (select 1 from public.users u where u."uid" = p_user_id) then
    raise exception 'ACCOUNT_NOT_FOUND';
  end if;

  v_blockers := public.account_deletion_blockers(p_user_id);
  if coalesce(array_length(v_blockers, 1), 0) > 0 then
    raise exception 'ACCOUNT_DELETION_BLOCKED:%', array_to_string(v_blockers, ',');
  end if;

  select d."id" into v_driver_id from public.drivers d where d."userId" = p_user_id limit 1;

  -- Rides keep their fares, times and status. A rider's side (places, routes, passenger details) is erased
  -- from the rider's own rides only, and a driver's side (their position) from the driver's own rides only,
  -- so deleting one account never wipes the other person's trip history.
  update public.rides set
    "pickupAddress" = null, "dropoffAddress" = null,
    "pickupLocation" = null, "dropoffLocation" = null,
    "passengerName" = null, "passengerPhone" = null, "sharedWith" = null,
    "cancelReasonDetails" = null
  where "userId" = p_user_id;
  if v_driver_id is not null then
    update public.rides set "driverLocation" = null where "driverId" = v_driver_id;
  end if;

  -- Chat: the words and the names go; the conversation shell stays (archived) so the other person's list is not broken.
  delete from public.messages m
  using public.conversations c
  where m."conversationId" = c."id"
    and (c."userId" = p_user_id or (v_driver_id is not null and c."driverId" = v_driver_id));
  update public.conversations set
    "userName" = case when "userId" = p_user_id then 'Deleted user' else "userName" end,
    "userPhone" = case when "userId" = p_user_id then null else "userPhone" end,
    "driverName" = case when v_driver_id is not null and "driverId" = v_driver_id then 'Deleted user' else "driverName" end,
    "driverPhone" = case when v_driver_id is not null and "driverId" = v_driver_id then null else "driverPhone" end,
    "lastMessage" = null,
    "status" = 'archived'
  where "userId" = p_user_id or (v_driver_id is not null and "driverId" = v_driver_id);

  -- Support: what they wrote and their name go; the ticket and its outcome stay.
  update public.support_ticket_messages set "text" = '[removed at the user''s request]'
  where "senderId" = p_user_id and "senderType" <> 'admin';
  update public.support_tickets set "filedByName" = 'Deleted user' where "filedByUserId" = p_user_id;

  -- Ratings the person wrote: the score stays (it belongs to the other person's record), the words go.
  update public.ratings set "comment" = null, "tags" = null where "userId" = p_user_id;

  -- Things that only mattered to this person.
  delete from public.saved_locations where "userId" = p_user_id;
  delete from public.family_members where "userId" = p_user_id;
  delete from public.payment_methods where "userId" = p_user_id;
  delete from public.wallet_bank_accounts where "userId" = p_user_id;
  delete from public.rider_preferences where "userId" = p_user_id;
  delete from public.password_reset_events where "userId" = p_user_id;
  delete from public.user_roles where "userId" = p_user_id;

  if v_driver_id is not null then
    select coalesce(array_agg(dd."documentUrl"), '{}') into v_document_paths
    from public.driver_documents dd
    where dd."driverId" = v_driver_id and dd."documentUrl" is not null;

    delete from public.driver_documents where "driverId" = v_driver_id;
    delete from public.driver_bank_accounts where "driverId" = v_driver_id::text;

    -- The driver profile: identity, licence, vehicle and contact details go, and the driver can no longer
    -- be dispatched. The row itself stays because payouts, ratings and the commission ledger point at it.
    update public.drivers set
      "name" = 'Deleted user', "fullLegalName" = null, "email" = null, "phone" = null,
      "profileImage" = null, "location" = null, "vehicle" = null, "documents" = null,
      "dateOfBirth" = null, "licenseNumber" = null, "licenseCategory" = null,
      "licenseIssueDate" = null, "licenseExpiryDate" = null, "vehiclePlateNumber" = null,
      "vehicleVin" = null, "vehicleEngineNumber" = null, "pushToken" = null,
      "isOnline" = false, "isVerified" = false
    where "id" = v_driver_id;
  end if;

  -- The profile itself.
  update public.users set
    "displayName" = 'Deleted user', "email" = null, "phoneNumber" = null, "photoURL" = null,
    "dateOfBirth" = null, "address" = null, "pushToken" = null
  where "uid" = p_user_id;

  -- The login itself: the email becomes an address that can never receive mail (so the person can later
  -- sign up again with their real one), the password, social logins and every signed-in session are
  -- removed, and the account is locked. The row stays because the records above point at it.
  update auth.users set
    "email" = 'deleted-' || p_user_id::text || '@deleted.invalid',
    "phone" = null,
    "encrypted_password" = '',
    "raw_user_meta_data" = '{}'::jsonb,
    "raw_app_meta_data" = '{"deleted": true}'::jsonb,
    "banned_until" = 'infinity'
  where "id" = p_user_id;
  delete from auth.identities where "user_id" = p_user_id;
  delete from auth.sessions where "user_id" = p_user_id;

  return jsonb_build_object(
    'driverId', v_driver_id,
    'documentPaths', to_jsonb(v_document_paths)
  );
end;
$$;

revoke all on function public.anonymise_account(uuid) from public, anon, authenticated;
grant execute on function public.anonymise_account(uuid) to service_role;

-- 3. A request counter for abuse limits ---------------------------------------------------------------------------
-- Serverless functions share no memory, so a counter kept in the function would not stop anyone. This one
-- lives in the database. Fixed windows: the first hit starts a window of p_window_seconds, later hits in the
-- window count up, and the (p_limit + 1)th returns false. It is one atomic statement, so two requests at the
-- same moment cannot both slip under the limit.
create table if not exists public.rate_limits (
  "key"         text        not null,
  "windowStart" timestamptz not null,
  "count"       integer     not null default 0,
  primary key ("key", "windowStart")
);

alter table public.rate_limits enable row level security;
-- No policies: apps cannot read or write it at all; only the backend (service_role) can.
revoke all on table public.rate_limits from public, anon, authenticated;

create or replace function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_count integer;
begin
  if p_key is null or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'rate_limit_hit: invalid arguments';
  end if;

  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits as rl ("key", "windowStart", "count")
  values (p_key, v_window, 1)
  on conflict ("key", "windowStart") do update set "count" = rl."count" + 1
  returning rl."count" into v_count;

  -- Old windows are removed now and then, so the table does not grow without end.
  if random() < 0.01 then
    delete from public.rate_limits where "windowStart" < now() - interval '1 day';
  end if;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
