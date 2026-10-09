-- Rewards points: lockdown, task claims, watch timer, paying rides, driver settlement.
-- Run with `bunx supabase test db` (needs the local database: `supabase start`).
-- Everything runs in one transaction that is rolled back at the end.
begin;
select plan(47);

-- Fixtures: a rider, a driver, 500 points for the rider, two tasks. ---------------------------------
insert into auth.users (id, email, instance_id, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'rider@test.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'driver@test.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
insert into public.drivers (id, "userId") values ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222');
insert into public.points_transactions ("userId", amount, type, description, "expiresAt")
  values ('11111111-1111-1111-1111-111111111111', 500, 'task_reward', 'seed', now() + interval '90 days');
insert into public.reward_tasks (id, type, title, description, "pointsReward", "minWatchSeconds", "maxCompletionsPerUser", "totalMaxCompletions") values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'youtube_video', 'video', 'd', 500, 120, 1, 2),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'social_share', 'share', 'd', 50, null, 1, null);

-- The tests below act as the backend (service role) unless they say otherwise.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- Lockdown: an app session cannot write points or call backend-only functions -----------------------
select throws_ok(
  $$ do $x$ begin
       set local role authenticated;
       perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
       insert into public.points_transactions ("userId", amount, type, description)
         values ('11111111-1111-1111-1111-111111111111', 999999, 'task_reward', 'cheat');
     end $x$ $$,
  '42501', null, 'an app session cannot give itself points');

select throws_ok(
  $$ do $x$ begin
       set local role authenticated;
       perform public.claim_reward_task('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
     end $x$ $$,
  '42501', null, 'an app session cannot call claim_reward_task');

select throws_ok(
  $$ do $x$ begin
       set local role anon;
       perform count(*) from public.user_points_balance;
     end $x$ $$,
  '42501', null, 'anonymous callers cannot read the points balance view');

-- Task claims ---------------------------------------------------------------------------------------
select throws_ok(
  $$ select public.claim_reward_task('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  'P0001', 'TASK_NOT_WATCHED', 'a video cannot be claimed without starting it');

select is((select required_seconds from public.start_reward_task('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')),
  120, 'starting a video reports the required wait');

select throws_ok(
  $$ select public.claim_reward_task('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  'P0001', 'TASK_NOT_WATCHED', 'a video cannot be claimed straight after starting');

update public.reward_task_starts set "startedAt" = now() - interval '100 seconds';
select ok((select remaining_seconds from public.start_reward_task('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')) between 19 and 21,
  'starting again does not reset the clock');

update public.reward_task_starts set "startedAt" = now() - interval '121 seconds';
select is(public.claim_reward_task('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 500,
  'a video can be claimed after the required time, for the tasks own amount');

select throws_ok(
  $$ select public.claim_reward_task('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  'P0001', 'TASK_ALREADY_CLAIMED', 'a task cannot be claimed twice');

select is(public.claim_reward_task('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 50,
  'a share task needs no wait');

select is((select sum(amount)::int from public.points_transactions where "userId" = '11111111-1111-1111-1111-111111111111'), 1050,
  'balance is the seed (500) + video (500) + share (50)');

-- Paying a ride with points: reserve, cap on balance, idempotent, return on cancel ---------------------
-- Reset to a known 500-point balance for the ride scenarios.
delete from public.points_transactions where "userId" = '11111111-1111-1111-1111-111111111111';
insert into public.points_transactions ("userId", amount, type, description, "expiresAt")
  values ('11111111-1111-1111-1111-111111111111', 500, 'task_reward', 'seed', now() + interval '90 days');

insert into public.rides (id, "userId", status, fare, "paymentMethod", "paymentStatus", "pointsUsed", "pointsValueNGN")
  values ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'pending', 2000, 'wallet', 'unpaid', 62, 992);

select lives_ok($$ select public.reserve_ride_points('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 62) $$,
  'points can be reserved for a ride');
select is((select sum(amount)::int from public.points_transactions where "userId" = '11111111-1111-1111-1111-111111111111'), 438,
  'reserving 62 points leaves 438');

select lives_ok($$ select public.reserve_ride_points('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 62) $$,
  'reserving the same ride again is harmless');
select is((select count(*)::int from public.points_transactions where type = 'ride_redemption'), 1,
  'a ride is charged its points only once');

select throws_ok(
  $$ select public.reserve_ride_points('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000002', 9999) $$,
  'P0001', 'INSUFFICIENT_POINTS', 'you cannot reserve more points than you have');

select throws_ok(
  $$ do $x$ begin
       set local role authenticated;
       perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
       update public.rides set "pointsUsed" = 0, "pointsValueNGN" = 0 where id = 'a0000000-0000-0000-0000-000000000001';
     end $x$ $$,
  'P0001', null, 'a rider cannot rewrite the points on their own ride');

update public.rides set status = 'cancelled' where id = 'a0000000-0000-0000-0000-000000000001';
select is((select sum(amount)::int from public.points_transactions where "userId" = '11111111-1111-1111-1111-111111111111'), 500,
  'cancelling a ride returns its points');
select is(public.refund_ride_points('a0000000-0000-0000-0000-000000000001'), 0,
  'points are returned only once');

-- Driver settlement ---------------------------------------------------------------------------------
-- Cash ride: fare 1000, 31 points = 496, commission 10% = 100.
insert into public.rides (id, "userId", "driverId", status, fare, "paymentMethod", "paymentStatus", "pointsUsed", "pointsValueNGN")
  values ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'pending', 1000, 'cash', 'unpaid', 31, 496);
update public.rides set status = 'accepted', "acceptedAt" = now() where id = 'b0000000-0000-0000-0000-000000000001';
update public.rides set status = 'in-progress' where id = 'b0000000-0000-0000-0000-000000000001';
update public.rides set "paymentStatus" = 'paid' where id = 'b0000000-0000-0000-0000-000000000001';
update public.rides set status = 'completed' where id = 'b0000000-0000-0000-0000-000000000001';

select is((select amount from public.driver_commission_ledger where "rideId" = 'b0000000-0000-0000-0000-000000000001' and type = 'points_credit'),
  496.00, 'cash ride: Pantra credits the driver the points part');
select is((select amount from public.driver_commission_ledger where "rideId" = 'b0000000-0000-0000-0000-000000000001' and type = 'cash_commission_debit'),
  -100.00, 'cash ride: the commission is still owed');
select is(public.get_driver_available_balance('dddddddd-dddd-dddd-dddd-dddddddddddd'), 396.00,
  'cash ride: balance = points credit - commission, so cash collected (504) + balance (396) = fare - commission (900)');

-- Wallet ride: same fare and points; the driver is paid as before and no ledger entries are added.
insert into public.rides (id, "userId", "driverId", status, fare, "paymentMethod", "paymentStatus", "pointsUsed", "pointsValueNGN")
  values ('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'pending', 1000, 'wallet', 'unpaid', 31, 496);
update public.rides set status = 'accepted', "acceptedAt" = now() where id = 'c0000000-0000-0000-0000-000000000001';
update public.rides set status = 'in-progress' where id = 'c0000000-0000-0000-0000-000000000001';
update public.rides set "paymentStatus" = 'paid' where id = 'c0000000-0000-0000-0000-000000000001';
update public.rides set status = 'completed' where id = 'c0000000-0000-0000-0000-000000000001';

select is((select "driverEarningsAmount" from public.rides where id = 'c0000000-0000-0000-0000-000000000001'), 900.00,
  'wallet ride: driver earnings are unchanged by points');
select is((select count(*)::int from public.driver_commission_ledger where "rideId" = 'c0000000-0000-0000-0000-000000000001'), 0,
  'wallet ride: no ledger entries are added');

-- A full refund of a completed ride returns its points once (the backend calls this after the refund).
select lives_ok($$ select public.reserve_ride_points('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-000000000001', 31) $$,
  'points for the wallet ride were reserved');
select is(public.refund_ride_points('c0000000-0000-0000-0000-000000000001'), 31, 'a refunded ride gets its points back');
select is(public.refund_ride_points('c0000000-0000-0000-0000-000000000001'), 0, 'and only once');

-- Balance rules: spent points never come back to life or expire twice -------------------------------
-- 1. Earn 100 (expires 10 days ago), spend it before it expired, then earn 100 more:
--    the old spend must not eat the new points.
insert into public.points_transactions ("userId", amount, type, description, "createdAt", "expiresAt") values
  ('33333333-3333-3333-3333-333333333333', 100, 'task_reward', 'old earn', now() - interval '100 days', now() - interval '10 days'),
  ('33333333-3333-3333-3333-333333333333', -100, 'ride_redemption', 'spent before expiry', now() - interval '95 days', null),
  ('33333333-3333-3333-3333-333333333333', 100, 'task_reward', 'new earn', now() - interval '1 day', now() + interval '89 days');
select is(public.points_balance('33333333-3333-3333-3333-333333333333'), 100,
  'points spent before they expired do not swallow later earnings');

-- 2. Spending uses the earliest-expiring points first.
insert into public.points_transactions ("userId", amount, type, description, "createdAt", "expiresAt") values
  ('44444444-4444-4444-4444-444444444444', 50, 'task_reward', 'A (expires first)', now() - interval '20 days', now() - interval '1 day'),
  ('44444444-4444-4444-4444-444444444444', 50, 'task_reward', 'B (expires later)', now() - interval '19 days', now() + interval '70 days'),
  ('44444444-4444-4444-4444-444444444444', -50, 'ride_redemption', 'spend', now() - interval '10 days', null);
select is(public.points_balance('44444444-4444-4444-4444-444444444444'), 50,
  'a spend uses the earliest-expiring points, leaving the later ones');

-- 3. Returned points (a cancelled ride) are a new lot and are not lost to the old spend.
insert into public.points_transactions ("userId", amount, type, description, "createdAt", "expiresAt") values
  ('55555555-5555-5555-5555-555555555555', 100, 'task_reward', 'earn', now() - interval '100 days', now() - interval '10 days'),
  ('55555555-5555-5555-5555-555555555555', -100, 'ride_redemption', 'spend', now() - interval '95 days', null),
  ('55555555-5555-5555-5555-555555555555', 100, 'ride_refund', 'returned', now() - interval '50 days', now() + interval '40 days');
select is(public.points_balance('55555555-5555-5555-5555-555555555555'), 100,
  'points returned after a cancellation are fully available');

-- 4. Never negative.
insert into public.points_transactions ("userId", amount, type, description)
  values ('66666666-6666-6666-6666-666666666666', -50, 'ride_redemption', 'orphan spend');
select is(public.points_balance('66666666-6666-6666-6666-666666666666'), 0, 'the balance is never negative');

-- 5. A signed-in user can only ask about their own balance.
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is(public.points_balance('33333333-3333-3333-3333-333333333333'), 100, 'a user can read their own balance');
select is(public.points_balance('44444444-4444-4444-4444-444444444444'), 0, 'a user cannot read someone elses balance');
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- 6. Anonymous callers cannot run the balance function at all.
select throws_ok(
  $$ do $x$ begin
       set local role anon;
       perform public.points_balance('33333333-3333-3333-3333-333333333333');
     end $x$ $$,
  '42501', null, 'anonymous callers cannot call points_balance');

-- 7. Reserving only counts points that are still valid: 40 valid + 60 expired = 40 spendable.
insert into public.points_transactions ("userId", amount, type, description, "createdAt", "expiresAt") values
  ('77777777-7777-7777-7777-777777777777', 60, 'task_reward', 'expired', now() - interval '100 days', now() - interval '10 days'),
  ('77777777-7777-7777-7777-777777777777', 40, 'task_reward', 'valid', now() - interval '5 days', now() + interval '85 days');
select throws_ok(
  $$ select public.reserve_ride_points('77777777-7777-7777-7777-777777777777', 'a0000000-0000-0000-0000-0000000000a1', 41) $$,
  'P0001', 'INSUFFICIENT_POINTS', 'expired points cannot be spent');
select lives_ok(
  $$ select public.reserve_ride_points('77777777-7777-7777-7777-777777777777', 'a0000000-0000-0000-0000-0000000000a2', 40) $$,
  'the valid points can be spent');

-- Returned points: original expiry (7-day minimum), proportional partial refunds, several lots -----------
-- Keep the original expiry.
insert into public.points_transactions ("userId", amount, type, description, "createdAt", "expiresAt")
  values ('88888888-8888-8888-8888-888888888888', 100, 'task_reward', 'earn', now() - interval '10 days', now() + interval '30 days');
select public.reserve_ride_points('88888888-8888-8888-8888-888888888888', 'e0000000-0000-0000-0000-000000000001', 40);
select is(public.refund_ride_points('e0000000-0000-0000-0000-000000000001'), 40, 'a cancelled ride returns all its points');
select is((select "expiresAt" from public.points_transactions where "referenceId" = 'e0000000-0000-0000-0000-000000000001' and type = 'ride_refund'),
  now() + interval '30 days', 'returned points keep their original expiry');

-- Less than 7 days left: they get exactly 7 days from the return.
insert into public.points_transactions ("userId", amount, type, description, "createdAt", "expiresAt")
  values ('99999999-9999-9999-9999-999999999999', 100, 'task_reward', 'earn', now() - interval '20 days', now() + interval '2 days');
select public.reserve_ride_points('99999999-9999-9999-9999-999999999999', 'e0000000-0000-0000-0000-000000000002', 40);
select public.refund_ride_points('e0000000-0000-0000-0000-000000000002');
select is((select "expiresAt" from public.points_transactions where "referenceId" = 'e0000000-0000-0000-0000-000000000002' and type = 'ride_refund'),
  now() + interval '7 days', 'points about to expire get a 7-day grace period');

-- Partial refunds return a share, rounded down, cumulatively (10 points spent, ride paid 100 from the wallet).
insert into public.points_transactions ("userId", amount, type, description, "createdAt", "expiresAt")
  values ('aaaaaaaa-0000-0000-0000-00000000000a', 200, 'task_reward', 'earn', now() - interval '1 day', now() + interval '60 days');
select public.reserve_ride_points('aaaaaaaa-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-000000000003', 10);
select is(public.refund_ride_points('e0000000-0000-0000-0000-000000000003', 25, 100), 2, 'a 25% refund returns 25% of 10 points, rounded down (2)');
select is(public.refund_ride_points('e0000000-0000-0000-0000-000000000003', 50, 100), 3, 'refunds are cumulative: 50% in total means 5 points, so 3 more');
select is(public.refund_ride_points('e0000000-0000-0000-0000-000000000003', 100, 100), 5, 'refunded in full, the remaining 5 come back');
select is(public.refund_ride_points('e0000000-0000-0000-0000-000000000003', 100, 100), 0, 'and nothing more is ever returned');
select is((select sum(amount)::int from public.points_transactions where "referenceId" = 'e0000000-0000-0000-0000-000000000003' and type = 'ride_refund'),
  10, 'exactly the points that were spent come back in total');

-- Points that came from two earned batches go back to two batches with their own expiry.
insert into public.points_transactions ("userId", amount, type, description, "createdAt", "expiresAt") values
  ('bbbbbbbb-0000-0000-0000-00000000000b', 30, 'task_reward', 'batch A', now() - interval '30 days', now() + interval '20 days'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 70, 'task_reward', 'batch B', now() - interval '29 days', now() + interval '60 days');
select public.reserve_ride_points('bbbbbbbb-0000-0000-0000-00000000000b', 'e0000000-0000-0000-0000-000000000004', 50);
select is(public.refund_ride_points('e0000000-0000-0000-0000-000000000004'), 50, 'all 50 points come back');
select is((select amount from public.points_transactions where "referenceId" = 'e0000000-0000-0000-0000-000000000004' and type = 'ride_refund' and "expiresAt" = now() + interval '20 days'),
  30, 'the 30 points taken from batch A go back with batch As expiry');
select is((select amount from public.points_transactions where "referenceId" = 'e0000000-0000-0000-0000-000000000004' and type = 'ride_refund' and "expiresAt" = now() + interval '60 days'),
  20, 'the 20 points taken from batch B go back with batch Bs expiry');

select * from finish();
rollback;
