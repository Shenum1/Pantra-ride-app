-- Direct-write audit fixes: every attack that worked before 20261008001300 must now fail or be neutralised.
-- Run with `bunx supabase test db`. One transaction, rolled back.
begin;
select plan(90);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);

insert into auth.users (id, email, instance_id, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'rider1@t.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'driver1@t.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'rider2@t.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('44444444-4444-4444-4444-444444444444', 'driver2@t.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('55555555-5555-5555-5555-555555555555', 'newdriver@t.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
insert into public.drivers (id, "userId", "isVerified", "verificationStatus", rating, "totalRatings", "totalRides") values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', true, 'VERIFIED', 4.5, 10, 10),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '44444444-4444-4444-4444-444444444444', true, 'VERIFIED', 4.9, 100, 100);
update public.users set rating = 4.0, "totalRatings" = 7 where uid = '11111111-1111-1111-1111-111111111111';

insert into public.rides (id, "userId", status, fare, "paymentMethod", "paymentStatus", "rideType", "dropoffLocation", "isPriority")
  values ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'pending', 1000, 'wallet', 'unpaid', 'standard', '{"lat":6.5,"lng":3.3}', false);
insert into public.rides (id, "userId", "driverId", status, fare, "paymentMethod", "paymentStatus", "rideType", "acceptedAt")
  values ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'accepted', 1000, 'wallet', 'unpaid', 'standard', now() - interval '30 minutes');
insert into public.rides (id, "userId", status, fare, "paymentMethod", "paymentStatus", "rideType")
  values ('c0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'pending', 1000, 'wallet', 'unpaid', 'standard');
insert into public.rides (id, "userId", "driverId", status, fare, "paymentMethod", "paymentStatus", "rideType", "acceptedAt", "completedAt")
  values ('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'completed', 1000, 'wallet', 'paid', 'standard', now() - interval '2 hours', now() - interval '1 hour');
insert into public.promotions (id, code, description, "discountPercentage", "maxDiscountNGN", "maxUses", "usedCount", "isActive", "validFrom", "validUntil")
  values ('99999999-9999-9999-9999-999999999999', 'PROMO1', 'test', 10, 500, 100, 0, true, now() - interval '1 day', now() + interval '30 days');
insert into public.user_promo_uses ("userId", "promoId", "rideId") values ('11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'a0000000-0000-0000-0000-000000000001');

insert into public.points_transactions ("userId", amount, type, description, "expiresAt") values ('11111111-1111-1111-1111-111111111111', 500, 'task_reward', 'seed', now() + interval '90 days');
insert into public.rides (id, "userId", status, fare, "paymentMethod", "paymentStatus", "pointsUsed", "pointsValueNGN") values ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'pending', 1000, 'wallet', 'unpaid', 31, 496);
select public.reserve_ride_points('11111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-000000000001', 31);
insert into public.rides (id, "userId", "driverId", status, fare, "paymentMethod", "paymentStatus", "rideType", "acceptedAt") values
  ('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'accepted', 1000, 'wallet', 'unpaid', 'standard', now() - interval '30 minutes'),
  ('f0000000-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'accepted', 1000, 'wallet', 'unpaid', 'standard', now() - interval '5 minutes'),
  ('f0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'accepted', 1000, 'wallet', 'unpaid', 'standard', now() - interval '5 minutes'),
  ('f0000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'in-progress', 1000, 'wallet', 'unpaid', 'standard', now() - interval '20 minutes');
insert into public.rides (id, "userId", status, fare, "paymentMethod", "paymentStatus", "rideType")
  values ('f0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'pending', 1000, 'wallet', 'unpaid', 'standard');
update public.rides set status = 'accepted' where id = 'e0000000-0000-0000-0000-000000000001';
update public.rides set status = 'in-progress' where id = 'e0000000-0000-0000-0000-000000000001';
update public.rides set "paymentStatus" = 'paid' where id = 'e0000000-0000-0000-0000-000000000001';
update public.rides set status = 'completed' where id = 'e0000000-0000-0000-0000-000000000001';

-- A booked ride keeps the details it was priced for -------------------------------------------------------
select throws_matching($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set "dropoffLocation" = '{"lat":9.0,"lng":7.4}' where id = 'a0000000-0000-0000-0000-000000000001';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'the details of a booked ride cannot be changed', 'a rider cannot move the dropoff of a booked ride');
select throws_matching($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set "rideType" = 'xl' where id = 'a0000000-0000-0000-0000-000000000001';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'the details of a booked ride cannot be changed', 'a rider cannot change the ride class after booking');
select throws_matching($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set "isPriority" = true where id = 'a0000000-0000-0000-0000-000000000001';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'the details of a booked ride cannot be changed', 'a rider cannot switch priority on after booking');
select throws_matching($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set "paymentMethod" = 'cash' where id = 'a0000000-0000-0000-0000-000000000001';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'the details of a booked ride cannot be changed', 'a rider cannot change the payment method after booking');
select throws_matching($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set "userId" = '33333333-3333-3333-3333-333333333333' where id = 'a0000000-0000-0000-0000-000000000001';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'the details of a booked ride cannot be changed', 'a rider cannot hand the ride to another user');
select throws_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set fare = 1 where id = 'a0000000-0000-0000-0000-000000000001';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'P0001', null, 'a rider still cannot edit the fare');

-- Driver assignment and acceptance time belong to accept_ride ------------------------------------------
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set "driverId" = 'dddddddd-dddd-dddd-dddd-dddddddddddd', "acceptedAt" = now() where id = 'a0000000-0000-0000-0000-000000000001';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'the rider app can re-send driverId and acceptedAt without error');
select is((select "driverId" from public.rides where id = 'a0000000-0000-0000-0000-000000000001'), null::uuid, 'but a rider cannot assign a driver to their own ride');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set "acceptedAt" = now() where id = 'b0000000-0000-0000-0000-000000000001';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'a rider tries to reset acceptedAt to dodge the cancellation fee');
select is((select "acceptedAt" from public.rides where id = 'b0000000-0000-0000-0000-000000000001'), now() - interval '30 minutes', 'and acceptedAt is unchanged');

-- Arrival time is the database clock, set once --------------------------------------------------------------
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set "arrivedAt" = now() - interval '3 hours' where id = 'b0000000-0000-0000-0000-000000000001';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'a driver backdates arrivedAt by 3 hours');
select is((select "arrivedAt" from public.rides where id = 'b0000000-0000-0000-0000-000000000001'), now(), 'arrivedAt is the real time, not the backdated one');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set "arrivedAt" = now() - interval '1 day' where id = 'b0000000-0000-0000-0000-000000000001';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'a later write to arrivedAt');
select is((select "arrivedAt" from public.rides where id = 'b0000000-0000-0000-0000-000000000001'), now(), 'cannot move arrivedAt');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set status = 'in-progress', "startedAt" = now() - interval '5 hours' where id = 'b0000000-0000-0000-0000-000000000001';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'the driver starts the trip, also sending a backdated startedAt');
select is((select "waitingCharge" from public.rides where id = 'b0000000-0000-0000-0000-000000000001'), 0.00::numeric, 'no waiting charge was added');
select is((select fare from public.rides where id = 'b0000000-0000-0000-0000-000000000001'), 1000.00::numeric, 'the fare is unchanged');
select is((select "startedAt" from public.rides where id = 'b0000000-0000-0000-0000-000000000001'), now(), 'and startedAt is the real time');

-- Legitimate flows still work -------------------------------------------------------------------------------
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set "trackingStage" = 'driver_arrived', "statusText" = 'Your driver has arrived', "cancelReason" = null where id = 'a0000000-0000-0000-0000-000000000001';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'the rider app can still update tracking and status text');
select is((select "trackingStage" from public.rides where id = 'a0000000-0000-0000-0000-000000000001'), 'driver_arrived', 'and they are saved');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
  set local role authenticated;
  perform public.accept_ride('c0000000-0000-0000-0000-000000000001');
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'a verified driver accepts a pending ride with accept_ride');
select is((select "driverId" from public.rides where id = 'c0000000-0000-0000-0000-000000000001'), 'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 'the ride is assigned to that driver');
select is((select "acceptedAt" from public.rides where id = 'c0000000-0000-0000-0000-000000000001'), now(), 'and accepted at the real time');

-- Reputation numbers ----------------------------------------------------------------------------------------
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
  set local role authenticated;
  update public.drivers set rating = 5.0, "totalRatings" = 9999, "totalRides" = 9999 where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'a driver tries to write their own rating and ride count');
select is((select rating from public.drivers where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'), 4.5::numeric, 'the rating is unchanged');
select is((select "totalRides" from public.drivers where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'), 10, 'and so is the ride count');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.users set rating = 5.0, "totalRatings" = 9999 where uid = '11111111-1111-1111-1111-111111111111';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'a rider tries to write their own rating');
select is((select rating from public.users where uid = '11111111-1111-1111-1111-111111111111'), 4.0::numeric, 'the rider rating is unchanged');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
  set local role authenticated;
  insert into public.drivers (id, "userId", rating, "totalRatings", "totalRides", "isVerified", "verificationStatus") values ('ffffffff-ffff-ffff-ffff-ffffffffffff', '55555555-5555-5555-5555-555555555555', 5.0, 500, 500, false, 'PENDING');
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'a new driver signs up claiming a 5.0 rating');
select is((select rating from public.drivers where id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'), null::numeric, 'they start with no rating');
select is((select "totalRides" from public.drivers where id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'), 0, 'and no rides');

-- Promotions ------------------------------------------------------------------------------------------------
select throws_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  delete from public.user_promo_uses where "userId" = '11111111-1111-1111-1111-111111111111';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, '42501', null, 'a rider cannot delete their promo-use record to reuse a code');
select throws_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  insert into public.user_promo_uses ("userId", "promoId") values ('11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999');
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, '42501', null, 'a rider cannot write promo-use records');
select throws_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  perform public.increment_promo_use('99999999-9999-9999-9999-999999999999');
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, '42501', null, 'a logged-out caller cannot burn a promo');
select throws_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
  set local role authenticated;
  perform public.increment_promo_use('99999999-9999-9999-9999-999999999999');
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, '42501', null, 'a signed-in user cannot burn a promo either');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  set local role service_role;
  perform public.increment_promo_use('99999999-9999-9999-9999-999999999999');
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'the backend can still record promo usage');
select is((select "usedCount" from public.promotions where id = '99999999-9999-9999-9999-999999999999'), 1, 'and it counted once');

-- The rating a rider gave a driver is written only by submit_rating --------------------------------------------
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set "driverRating" = 5 where id = 'd0000000-0000-0000-0000-000000000001';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'a driver tries to write the rating on their own completed ride');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set "driverRating" = 1 where id = 'd0000000-0000-0000-0000-000000000001';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'a rider tries to write it too');
select is((select "driverRating" from public.rides where id = 'd0000000-0000-0000-0000-000000000001'), null::numeric, 'driverRating is still empty');

-- The real writes the apps make still work ----------------------------------------------------------------------
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set status = 'cancelled', "trackingStage" = null, "statusText" = 'Ride cancelled', "cancelReason" = 'changed_mind', "cancelReasonDetails" = null, "driverLocation" = '{"latitude":6.5,"longitude":3.3}'::jsonb, fare = 0, "cancellationFee" = 0 where id = 'f0000000-0000-0000-0000-000000000001';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'the rider cancels an accepted ride with the payload the app sends');
select is((select status from public.rides where id = 'f0000000-0000-0000-0000-000000000001'), 'cancelled', 'the ride is cancelled');
select is((select "cancelledAt" from public.rides where id = 'f0000000-0000-0000-0000-000000000001'), now(), 'the cancellation time is the database clock');
select is((select "cancellationFee" from public.rides where id = 'f0000000-0000-0000-0000-000000000001'), 200.00::numeric, 'the fee was worked out by the database, not taken from the phone');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set status = 'in-progress', "startedAt" = now() where id = 'f0000000-0000-0000-0000-000000000002';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'the driver starts the trip with the payload the app sends');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  set local role service_role;
  update public.rides set "paymentStatus" = 'paid' where id = 'f0000000-0000-0000-0000-000000000002';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'the backend confirms payment (as rides.confirmPayment does)');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set status = 'completed', "completedAt" = now() - interval '9 hours', "platformCommissionRate" = 0.1, "platformCommissionAmount" = 100, "driverEarningsAmount" = 900 where id = 'f0000000-0000-0000-0000-000000000002';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'the driver completes the ride with the payload the app sends');
select is((select status from public.rides where id = 'f0000000-0000-0000-0000-000000000002'), 'completed', 'the ride is completed');
select is((select "completedAt" from public.rides where id = 'f0000000-0000-0000-0000-000000000002'), now(), 'completedAt is the database clock, not the phone');
select is((select "driverEarningsAmount" from public.rides where id = 'f0000000-0000-0000-0000-000000000002'), 900.00::numeric, 'the driver earnings were worked out by the database');

-- Arrival is stamped by the rider app, only while a driver is on the way --------------------------------------
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set "arrivedAt" = now() - interval '10 seconds', "trackingStage" = 'driver_arrived' where id = 'f0000000-0000-0000-0000-000000000003';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'the rider app stamps arrival on an accepted ride (using the phone clock)');
select is((select "arrivedAt" from public.rides where id = 'f0000000-0000-0000-0000-000000000003'), now(), 'arrival is saved, as the database clock');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set "driverId" = null, "statusText" = 'x' where id = 'f0000000-0000-0000-0000-000000000003';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'the rider app re-sends driverId as NULL on an assigned ride');
select is((select "driverId" from public.rides where id = 'f0000000-0000-0000-0000-000000000003'), 'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 'the driver is still assigned');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set "arrivedAt" = now() where id = 'f0000000-0000-0000-0000-000000000004';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'an arrival write on a ride that is still pending');
select is((select "arrivedAt" from public.rides where id = 'f0000000-0000-0000-0000-000000000004'), null::timestamptz, 'is ignored');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set "arrivedAt" = now() where id = 'f0000000-0000-0000-0000-000000000005';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'an arrival write on a ride already in progress');
select is((select "arrivedAt" from public.rides where id = 'f0000000-0000-0000-0000-000000000005'), null::timestamptz, 'is ignored too (no waiting charge; this can never overcharge)');

-- Whole-profile saves (upserts) ---------------------------------------------------------------------------------
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
  set local role authenticated;
  insert into public.drivers (id, "userId", name, rating, "totalRatings", "totalRides") values ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', 'New Name', 1.0, 1, 1) on conflict (id) do update set name = excluded.name, rating = excluded.rating, "totalRatings" = excluded."totalRatings", "totalRides" = excluded."totalRides";
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'the driver app saves its whole profile, re-sending reputation numbers');
select is((select name from public.drivers where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'), 'New Name', 'the profile edit is saved');
select is((select "totalRides" from public.drivers where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'), 10, 'but the reputation numbers are not overwritten');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  insert into public.users (uid, email, "displayName", rating, "totalRatings") values ('11111111-1111-1111-1111-111111111111', 'rider1@t.test', 'Rider One', 1.0, 1) on conflict (uid) do update set "displayName" = excluded."displayName", rating = excluded.rating, "totalRatings" = excluded."totalRatings";
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'the rider app saves its whole profile, re-sending reputation numbers');
select is((select "displayName" from public.users where uid = '11111111-1111-1111-1111-111111111111'), 'Rider One', 'the rider profile edit is saved too');
select is((select "totalRatings" from public.users where uid = '11111111-1111-1111-1111-111111111111'), 7, 'and the rider rating numbers are not overwritten');

-- Ratings ---------------------------------------------------------------------------------------------------
select throws_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
  set local role authenticated;
  perform public.submit_rating('fake-ride-1', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 1);
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'P0001', null, 'a rating for a made-up ride id is rejected');
select throws_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
  set local role authenticated;
  perform public.submit_rating('d0000000-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 1);
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'P0001', null, 'a rider cannot rate a ride they did not take');
select throws_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  perform public.submit_rating('d0000000-0000-0000-0000-000000000001', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 1);
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'P0001', null, 'a rider cannot rate a driver who was not on their ride');
select throws_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  perform public.submit_rating('b0000000-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 1);
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'P0001', null, 'a rider cannot rate a ride that is not completed');
select throws_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  perform public.submit_rating('d0000000-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 5);
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, '42501', null, 'a logged-out caller cannot rate');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  perform public.submit_rating('d0000000-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 5);
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'the rider of a completed ride can rate its driver');
select is((select rating from public.drivers where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'), 5.0::numeric, 'the driver rating is now computed from the ratings');
select throws_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  perform public.submit_rating('d0000000-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 1);
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'P0001', null, 'and cannot rate the same ride twice');
select throws_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
  set local role authenticated;
  perform public.submit_rider_rating('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 1);
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'P0001', null, 'a driver cannot rate a rider from a ride they did not drive');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
  set local role authenticated;
  perform public.submit_rider_rating('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 4);
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'the driver of a completed ride can rate its rider');
select is((select rating from public.users where uid = '11111111-1111-1111-1111-111111111111'), 4.0::numeric, 'the rider rating is now computed from the ratings drivers gave (one rating of 4)');
select is((select "totalRatings" from public.users where uid = '11111111-1111-1111-1111-111111111111'), 1, '...and counts them');

-- A settled ride stays settled --------------------------------------------------------------------------------
select throws_matching($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set status = 'pending' where id = 'e0000000-0000-0000-0000-000000000001';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'its status cannot change', 'a rider cannot reopen a completed ride');
select throws_matching($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  update public.rides set status = 'cancelled' where id = 'e0000000-0000-0000-0000-000000000001';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'its status cannot change', 'a rider cannot cancel a completed ride');
select throws_matching($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  set local role service_role;
  update public.rides set status = 'pending' where id = 'e0000000-0000-0000-0000-000000000001';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'its status cannot change', 'even the backend cannot change the status of a settled ride');
select is(public.points_balance('11111111-1111-1111-1111-111111111111'), 469, 'the points paid for the completed ride stay spent (500 - 31)');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  set local role service_role;
  update public.rides set "driverRating" = 4 where id = 'e0000000-0000-0000-0000-000000000001';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'harmless updates to a completed ride (like a rating) still work');

-- Online sessions and privileges ----------------------------------------------------------------------------
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
  set local role authenticated;
  insert into public.driver_online_sessions ("driverId", "startedAt", "endedAt") values ('dddddddd-dddd-dddd-dddd-dddddddddddd', now() - interval '100 hours', now());
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'a driver invents a 100-hour online session');
select is((select count(*)::int from public.driver_online_sessions where "driverId" = 'dddddddd-dddd-dddd-dddd-dddddddddddd' and "startedAt" = now() and "endedAt" is null), 1, 'it starts at the real time and is still open');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
  set local role authenticated;
  update public.driver_online_sessions set "endedAt" = now() - interval '2 hours' where "driverId" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'the driver ends the session the way the app does (sending a past end time)');
select is((select count(*)::int from public.driver_online_sessions where "driverId" = 'dddddddd-dddd-dddd-dddd-dddddddddddd' and "endedAt" = now()), 1, 'the session ended at the real time');
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
  set local role authenticated;
  update public.driver_online_sessions set "endedAt" = null, "startedAt" = now() - interval '300 hours' where "driverId" = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, 'then tries to reopen it and move its start');
select is((select count(*)::int from public.driver_online_sessions where "driverId" = 'dddddddd-dddd-dddd-dddd-dddddddddddd' and "endedAt" = now() and "startedAt" = now()), 1, 'the session stays closed, with its original start');
select throws_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  perform public.add_wallet_transaction('11111111-1111-1111-1111-111111111111', 'credit', 100, 'x');
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, '42501', null, 'a logged-out caller cannot run the wallet function');
select throws_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  truncate public.points_transactions;
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, '42501', null, 'a signed-in user cannot TRUNCATE a table');
select throws_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  insert into public.saved_locations ("userId", name) values ('11111111-1111-1111-1111-111111111111', 'x');
  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
end $x$ $$, '42501', null, 'a logged-out user cannot write to a table');

select * from finish();
rollback;
