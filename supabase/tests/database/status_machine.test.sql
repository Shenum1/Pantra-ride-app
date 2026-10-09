-- Ride status state machine + cancellation log (supabase/migrations/20261008001400_ride_status_machine.sql).
-- Run with `bunx supabase test db`. One transaction, rolled back.
begin;
select plan(59);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);

insert into auth.users (id, email, instance_id, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'rider1@t.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'driver1@t.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'rider2@t.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
insert into public.drivers (id, "userId", "isVerified", "verificationStatus") values ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', true, 'VERIFIED');

-- A known cancellation fee configuration, so the fee tests don't depend on what the table holds.
delete from public.cancellation_fee_config;
insert into public.cancellation_fee_config ("freeWindowSeconds", "afterAcceptFee", "afterArrivalFee") values (60, 321, 654);

insert into public.rides (id, "userId", "driverId", status, fare, "paymentMethod", "paymentStatus", "rideType", "acceptedAt") values ('a1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'accepted', 1000, 'wallet', 'unpaid', 'standard', now() - interval '30 minutes');
insert into public.rides (id, "userId", "driverId", status, fare, "paymentMethod", "paymentStatus", "rideType", "acceptedAt") values ('a1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'in-progress', 1000, 'wallet', 'unpaid', 'standard', now() - interval '30 minutes');
insert into public.rides (id, "userId", "driverId", status, fare, "paymentMethod", "paymentStatus", "rideType", "acceptedAt") values ('a1000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', null, 'pending', 1000, 'wallet', 'unpaid', 'standard', null);
insert into public.rides (id, "userId", "driverId", status, fare, "paymentMethod", "paymentStatus", "rideType", "acceptedAt") values ('a1000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'accepted', 1000, 'wallet', 'unpaid', 'standard', now() - interval '30 minutes');
insert into public.rides (id, "userId", "driverId", status, fare, "paymentMethod", "paymentStatus", "rideType", "acceptedAt") values ('a1000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'accepted', 1000, 'wallet', 'unpaid', 'standard', now() - interval '30 minutes');
insert into public.rides (id, "userId", "driverId", status, fare, "paymentMethod", "paymentStatus", "rideType", "acceptedAt") values ('a1000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'in-progress', 1000, 'wallet', 'unpaid', 'standard', now() - interval '30 minutes');
insert into public.rides (id, "userId", "driverId", status, fare, "paymentMethod", "paymentStatus", "rideType", "acceptedAt") values ('a1000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'accepted', 1000, 'wallet', 'unpaid', 'standard', now() - interval '30 minutes');
insert into public.rides (id, "userId", "driverId", status, fare, "paymentMethod", "paymentStatus", "rideType", "acceptedAt") values ('a1000000-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', null, 'pending', 1000, 'wallet', 'unpaid', 'standard', null);
insert into public.rides (id, "userId", "driverId", status, fare, "paymentMethod", "paymentStatus", "rideType", "acceptedAt", "arrivedAt") values ('a1000000-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'accepted', 1000, 'wallet', 'unpaid', 'standard', now() - interval '30 minutes', now() - interval '2 minutes');
insert into public.rides (id, "userId", "driverId", status, fare, "paymentMethod", "paymentStatus", "rideType", "acceptedAt") values ('a1000000-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'in-progress', 1000, 'wallet', 'unpaid', 'standard', now() - interval '30 minutes');
insert into public.rides (id, "userId", "driverId", status, fare, "paymentMethod", "paymentStatus", "rideType", "acceptedAt") values ('a1000000-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'accepted', 1000, 'wallet', 'unpaid', 'standard', now() - interval '30 minutes');
insert into public.rides (id, "userId", "driverId", status, fare, "paymentMethod", "paymentStatus", "rideType", "acceptedAt") values ('a1000000-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'accepted', 1000, 'wallet', 'unpaid', 'standard', now() - interval '30 minutes');
insert into public.rides (id, "userId", "driverId", status, fare, "paymentMethod", "paymentStatus", "rideType", "acceptedAt") values ('a1000000-0000-0000-0000-000000000013', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'accepted', 1000, 'wallet', 'unpaid', 'standard', now() - interval '30 minutes');
insert into public.rides (id, "userId", "driverId", status, fare, "paymentMethod", "paymentStatus", "rideType", "acceptedAt") values ('a1000000-0000-0000-0000-000000000014', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'accepted', 1000, 'wallet', 'unpaid', 'standard', now() - interval '30 minutes');
insert into public.rides (id, "userId", "driverId", status, fare, "paymentMethod", "paymentStatus", "rideType", "acceptedAt") values ('a1000000-0000-0000-0000-000000000015', '33333333-3333-3333-3333-333333333333', null, 'pending', 1000, 'wallet', 'unpaid', 'standard', null);
insert into public.rides (id, "userId", "driverId", status, fare, "paymentMethod", "paymentStatus", "rideType", "acceptedAt") values ('a1000000-0000-0000-0000-000000000016', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'accepted', 1000, 'wallet', 'unpaid', 'standard', now() - interval '30 minutes');
insert into public.rides (id, "userId", "driverId", status, fare, "paymentMethod", "paymentStatus", "rideType", "acceptedAt") values ('a1000000-0000-0000-0000-000000000017', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'in-progress', 1000, 'wallet', 'unpaid', 'standard', now() - interval '30 minutes');
insert into public.rides (id, "userId", "driverId", status, fare, "paymentMethod", "paymentStatus", "rideType", "acceptedAt") values ('a1000000-0000-0000-0000-000000000018', '22222222-2222-2222-2222-222222222222', null, 'pending', 1000, 'wallet', 'unpaid', 'standard', null);

-- Nothing moves backwards or sideways ------------------------------------------------------------------------
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set status = 'pending' where id = 'a1000000-0000-0000-0000-000000000001';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'a rider (stale local state) writes pending over an accepted ride');
select is((select status from public.rides where id = 'a1000000-0000-0000-0000-000000000001'), 'accepted', 'the ride is still accepted');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set status = 'pending', "statusText" = 'stale' where id = 'a1000000-0000-0000-0000-000000000002';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'a rider writes pending over a trip in progress');
select is((select status from public.rides where id = 'a1000000-0000-0000-0000-000000000002'), 'in-progress', 'the trip is still in progress');
select is((select "statusText" from public.rides where id = 'a1000000-0000-0000-0000-000000000002'), 'stale', '...but the harmless fields of that write were saved');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set status = 'completed' where id = 'a1000000-0000-0000-0000-000000000002';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'a rider tries to complete a trip in progress');
select is((select status from public.rides where id = 'a1000000-0000-0000-0000-000000000002'), 'in-progress', 'the trip is still in progress (only the driver completes)');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set status = 'accepted' where id = 'a1000000-0000-0000-0000-000000000002';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'a driver tries to regress a trip in progress to accepted');
select is((select status from public.rides where id = 'a1000000-0000-0000-0000-000000000002'), 'in-progress', 'the trip is still in progress');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set status = 'accepted' where id = 'a1000000-0000-0000-0000-000000000003';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'a rider tries pending -> accepted outside accept_ride');
select is((select status from public.rides where id = 'a1000000-0000-0000-0000-000000000003'), 'pending', 'the ride is still pending');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set status = 'in-progress' where id = 'a1000000-0000-0000-0000-000000000004';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'a rider tries to start the trip themselves');
select is((select status from public.rides where id = 'a1000000-0000-0000-0000-000000000004'), 'accepted', 'the ride is still accepted (only the driver starts it)');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set status = 'completed' where id = 'a1000000-0000-0000-0000-000000000007';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'a driver tries to jump from accepted straight to completed');
select is((select status from public.rides where id = 'a1000000-0000-0000-0000-000000000007'), 'accepted', 'the ride is still accepted');

-- The legitimate moves still work ---------------------------------------------------------------------------
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set status = 'in-progress' where id = 'a1000000-0000-0000-0000-000000000005';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'the assigned driver starts the trip');
select is((select status from public.rides where id = 'a1000000-0000-0000-0000-000000000005'), 'in-progress', 'the trip is in progress');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  set local role service_role;
  update public.rides set "paymentStatus" = 'paid' where id = 'a1000000-0000-0000-0000-000000000006';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'the backend confirms payment once the trip is in progress');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set status = 'completed' where id = 'a1000000-0000-0000-0000-000000000006';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'the assigned driver completes the trip');
select is((select status from public.rides where id = 'a1000000-0000-0000-0000-000000000006'), 'completed', 'the ride is completed');

-- Rules for every session, the backend included ---------------------------------------------------------------
select throws_matching($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  set local role service_role;
  update public.rides set status = 'completed' where id = 'a1000000-0000-0000-0000-000000000013';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'can only be completed from in-progress', 'the backend cannot complete a ride that never started');
select throws_matching($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  set local role service_role;
  update public.rides set "paymentStatus" = 'paid' where id = 'a1000000-0000-0000-0000-000000000014';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'payment can only be confirmed while the trip is in progress', 'the backend cannot confirm payment before the trip starts');
select throws_matching($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set "paymentStatus" = 'paid' where id = 'a1000000-0000-0000-0000-000000000014';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'payment can only be confirmed while the trip is in progress', 'a driver marking a not-yet-started ride paid is stopped by the state machine');
select throws_matching($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set "paymentStatus" = 'paid' where id = 'a1000000-0000-0000-0000-000000000002';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'this field can only be set by the server', 'and even mid-trip a driver cannot mark it paid: only the server can');

-- Cancellation is logged with the real state at that moment ------------------------------------------------
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set status = 'cancelled' where id = 'a1000000-0000-0000-0000-000000000008';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'the rider cancels a ride that is still pending');
select is((select "cancelledFromStatus" from public.rides where id = 'a1000000-0000-0000-0000-000000000008'), 'pending', 'logged as cancelled from pending');
select is((select "cancelledBy" from public.rides where id = 'a1000000-0000-0000-0000-000000000008'), 'rider', '...by the rider');
select is((select "cancelledAfterArrival" from public.rides where id = 'a1000000-0000-0000-0000-000000000008'), false, '...before any arrival');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set status = 'cancelled' where id = 'a1000000-0000-0000-0000-000000000009';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'the rider cancels after the driver arrived');
select is((select "cancelledFromStatus" from public.rides where id = 'a1000000-0000-0000-0000-000000000009'), 'accepted', 'logged as cancelled from accepted');
select is((select "cancelledAfterArrival" from public.rides where id = 'a1000000-0000-0000-0000-000000000009'), true, '...after arrival');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set status = 'cancelled' where id = 'a1000000-0000-0000-0000-000000000010';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'the driver cancels mid-trip');
select is((select "cancelledFromStatus" from public.rides where id = 'a1000000-0000-0000-0000-000000000010'), 'in-progress', 'logged as cancelled from in-progress');
select is((select "cancelledBy" from public.rides where id = 'a1000000-0000-0000-0000-000000000010'), 'driver', '...by the driver');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set status = 'cancelled' where id = 'a1000000-0000-0000-0000-000000000016';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'the driver cancels right after accepting');
select is((select "cancelledFromStatus" from public.rides where id = 'a1000000-0000-0000-0000-000000000016'), 'accepted', 'logged as cancelled from accepted');
select is((select "cancelledBy" from public.rides where id = 'a1000000-0000-0000-0000-000000000016'), 'driver', '...by the driver');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set status = 'cancelled' where id = 'a1000000-0000-0000-0000-000000000017';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'the rider tries to cancel mid-trip (an old app build still shows the button)');
select is((select status from public.rides where id = 'a1000000-0000-0000-0000-000000000017'), 'in-progress', 'the trip is still in progress: only the driver can end a trip that has started');
select is((select "cancelledBy" from public.rides where id = 'a1000000-0000-0000-0000-000000000017'), null::text, 'and nothing was logged as a cancellation');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  set local role service_role;
  update public.rides set status = 'cancelled' where id = 'a1000000-0000-0000-0000-000000000012';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'the backend cancels a ride');
select is((select "cancelledBy" from public.rides where id = 'a1000000-0000-0000-0000-000000000012'), 'system', 'logged as cancelled by the system');
select is((select "cancelledFromStatus" from public.rides where id = 'a1000000-0000-0000-0000-000000000012'), 'accepted', '...from accepted');

-- The cancellation-fee dodge no longer works ---------------------------------------------------------------
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set status = 'pending' where id = 'a1000000-0000-0000-0000-000000000011';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'a rider regresses an accepted ride to pending, hoping cancelling from pending is free');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set status = 'cancelled' where id = 'a1000000-0000-0000-0000-000000000011';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, '...then cancels it');
select is((select "cancelledFromStatus" from public.rides where id = 'a1000000-0000-0000-0000-000000000011'), 'accepted', 'it is logged as cancelled from ACCEPTED, not pending');
select is((select "cancellationFee" from public.rides where id = 'a1000000-0000-0000-0000-000000000011'), 321.00::numeric, 'and the after-accept cancellation fee from the configuration was charged (30 minutes after acceptance)');

-- The log and other people's rides cannot be tampered with -------------------------------------------------
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set "cancelledFromStatus" = 'pending', "cancelledBy" = 'driver', "cancelledAfterArrival" = false where id = 'a1000000-0000-0000-0000-000000000009';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'a rider tries to rewrite the cancellation log of their cancelled ride');
select is((select "cancelledFromStatus" from public.rides where id = 'a1000000-0000-0000-0000-000000000009'), 'accepted', 'the log is unchanged (from)');
select is((select "cancelledBy" from public.rides where id = 'a1000000-0000-0000-0000-000000000009'), 'rider', 'the log is unchanged (by)');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set "cancelledBy" = 'driver' where id = 'a1000000-0000-0000-0000-000000000001';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'a rider tries to pre-set the log on a ride that is not cancelled');
select is((select "cancelledBy" from public.rides where id = 'a1000000-0000-0000-0000-000000000001'), null::text, 'nothing was recorded');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set status = 'cancelled' where id = 'a1000000-0000-0000-0000-000000000015';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'row security: a different rider cannot reach another riders ride at all');
select is((select status from public.rides where id = 'a1000000-0000-0000-0000-000000000015'), 'pending', 'the ride is untouched');

-- A driver cannot take their own ride -----------------------------------------------------------------------
select throws_matching($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
  set local role authenticated;
  perform public.accept_ride('a1000000-0000-0000-0000-000000000018');
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'RIDE_NOT_AVAILABLE', 'a driver cannot accept a ride booked by their own account');
select is((select status from public.rides where id = 'a1000000-0000-0000-0000-000000000018'), 'pending', 'the self-ride is still pending and unassigned');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
  set local role authenticated;
  perform set_config('test.own_ride_listed', (select count(*) from public.get_pending_rides_for_driver() where "id" = 'a1000000-0000-0000-0000-000000000018')::text, true);
   perform set_config('test.other_ride_listed', (select count(*) from public.get_pending_rides_for_driver() where "id" = 'a1000000-0000-0000-0000-000000000003')::text, true);
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'the driver loads their list of available rides');
select is(current_setting('test.own_ride_listed')::int, 0, 'their own request is not in the list');
select is(current_setting('test.other_ride_listed')::int, 1, 'a different riders pending request still is');

select * from finish();
rollback;
