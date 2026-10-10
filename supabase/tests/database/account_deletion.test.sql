-- Account deletion + rate limiter (supabase/migrations/20261009000100_account_deletion.sql).
-- Run with `bunx supabase test db`. One transaction, rolled back.
begin;
select plan(47);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- R1 rider (will be deleted) · R2 rider (the other side of the trips) · D1 driver (will be deleted)
-- R3 rider with money · D2 driver with earnings owed · D3 driver who owes commission · A1 admin · R4 clean rider
insert into auth.users (id, email, instance_id, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'r1@t.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'r2@t.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'd1@t.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('44444444-4444-4444-4444-444444444444', 'r3@t.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('55555555-5555-5555-5555-555555555555', 'd2@t.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('66666666-6666-6666-6666-666666666666', 'd3@t.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('77777777-7777-7777-7777-777777777777', 'a1@t.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('88888888-8888-8888-8888-888888888888', 'r4@t.test', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

insert into auth.identities (provider_id, user_id, identity_data, provider) values ('g-1', '11111111-1111-1111-1111-111111111111', '{"sub":"g-1","email":"r1@t.test"}', 'google');
insert into auth.sessions (id, user_id) values (gen_random_uuid(), '11111111-1111-1111-1111-111111111111');

update public.users set "displayName" = 'Real Name', "phoneNumber" = '+2348000000000', "photoURL" = 'https://x.test/p.jpg',
  "address" = '1 Home Street', "dateOfBirth" = '1990-01-01', "pushToken" = 'tok'
  where "uid" = '11111111-1111-1111-1111-111111111111';

insert into public.drivers (id, "userId", name, email, phone, "isVerified", "isOnline", "verificationStatus", "fullLegalName", "licenseNumber", "vehiclePlateNumber", "vehicleVin", "profileImage")
values
  ('d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1', '33333333-3333-3333-3333-333333333333', 'Dee One', 'd1@t.test', '+2348111111111', true, true, 'VERIFIED', 'Dee One Legal', 'LIC-1', 'ABC-123', 'VIN1', 'https://x.test/d.jpg'),
  ('d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2', '55555555-5555-5555-5555-555555555555', 'Dee Two', 'd2@t.test', '+2348222222222', true, false, 'VERIFIED', null, null, null, null, null),
  ('d3d3d3d3-d3d3-4d3d-8d3d-d3d3d3d3d3d3', '66666666-6666-6666-6666-666666666666', 'Dee Three', 'd3@t.test', '+2348333333333', true, false, 'VERIFIED', null, null, null, null, null);

insert into public.user_roles ("userId", role) values ('77777777-7777-7777-7777-777777777777', 'admin') on conflict do nothing;

-- Fixtures: R1 has a finished ride with D1 (and one with R2's chat), saved places, a card, chat, support ----------------
insert into public.rides (id, "userId", "driverId", status, fare, "paymentMethod", "paymentStatus", "rideType", "pickupAddress", "dropoffAddress", "pickupLocation", "dropoffLocation", "driverLocation", "passengerName", "passengerPhone", "completedAt")
values ('a1000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'd1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1', 'completed', 2500, 'wallet', 'paid', 'standard',
  '1 Home Street', '9 Work Road', '{"latitude":6.5,"longitude":3.3}', '{"latitude":6.6,"longitude":3.4}', '{"latitude":6.55,"longitude":3.35}', 'Real Name', '+2348000000000', now());
-- a finished ride of R2 with D1: R2's trip history must survive D1 being deleted
insert into public.rides (id, "userId", "driverId", status, fare, "paymentMethod", "paymentStatus", "rideType", "pickupAddress", "dropoffAddress", "driverLocation", "completedAt")
values ('a1000000-0000-4000-8000-000000000002', '22222222-2222-2222-2222-222222222222', 'd1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1', 'completed', 1800, 'cash', 'paid', 'standard',
  'R2 Pickup', 'R2 Dropoff', '{"latitude":6.5,"longitude":3.3}', now());

insert into public.saved_locations ("userId", name, address, latitude, longitude, type) values ('11111111-1111-1111-1111-111111111111', 'Home', '1 Home Street', 6.5, 3.3, 'home');
insert into public.family_members ("userId", name, relationship, phone) values ('11111111-1111-1111-1111-111111111111', 'Mum', 'mother', '+2348999999999');
insert into public.payment_methods ("userId", type, name, "lastFour") values ('11111111-1111-1111-1111-111111111111', 'wallet', 'Wallet', '4242');
insert into public.wallet_bank_accounts ("userId", "bankName", "accountHolderName") values ('11111111-1111-1111-1111-111111111111', 'Bank', 'Real Name');
insert into public.rider_preferences ("userId") values ('11111111-1111-1111-1111-111111111111');
insert into public.wallet_transactions ("userId", type, amount, description) values ('11111111-1111-1111-1111-111111111111', 'ride_payment', -2500, 'Ride');
insert into public.wallets ("userId", balance) values ('11111111-1111-1111-1111-111111111111', 0) on conflict ("userId") do update set balance = 0;
insert into public.ratings ("rideId", "userId", "driverId", rating, comment, tags) values ('a1000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'd1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1', 5, 'Lovely driver', array['polite']);

insert into public.conversations (id, "userId", "userName", "userPhone", "driverId", "driverName", "driverPhone", "rideId", "lastMessage")
values ('conv-1', '11111111-1111-1111-1111-111111111111', 'Real Name', '+2348000000000', 'd1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1', 'Dee One', '+2348111111111', 'a1000000-0000-4000-8000-000000000001', 'see you');
insert into public.messages ("conversationId", "senderId", "senderType", text) values
  ('conv-1', '11111111-1111-1111-1111-111111111111', 'user', 'I am outside'),
  ('conv-1', '33333333-3333-3333-3333-333333333333', 'driver', 'coming');

insert into public.support_tickets (id, "filedByUserId", "filedByRole", "filedByName", subject) values ('c1000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'rider', 'Real Name', 'Lost item');
insert into public.support_ticket_messages ("ticketId", "senderType", "senderId", text) values
  ('c1000000-0000-4000-8000-000000000001', 'user', '11111111-1111-1111-1111-111111111111', 'my phone number is 0800'),
  ('c1000000-0000-4000-8000-000000000001', 'admin', '77777777-7777-7777-7777-777777777777', 'we are looking');

insert into public.driver_documents ("driverId", type, "documentUrl", status) values
  ('d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1', 'drivers_license_front', 'drivers/d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1/license_1', 'approved'),
  ('d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1', 'vehicle_registration', 'drivers/d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1/reg_1', 'approved');
insert into public.driver_bank_accounts ("driverId", "bankName", "accountName", "accountNumberLast4") values ('d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1', 'Bank', 'Dee One', '6789');

-- Blockers -----------------------------------------------------------------------------------------------------
select is(public.account_deletion_blockers('88888888-8888-8888-8888-888888888888'), '{}'::text[], 'a clean account has nothing blocking deletion');
select is(public.account_deletion_blockers('11111111-1111-1111-1111-111111111111'), '{}'::text[], 'a rider with only finished trips and an empty wallet can be deleted');
select is(public.account_deletion_blockers('33333333-3333-3333-3333-333333333333'), '{}'::text[], 'a driver who is square with the platform can be deleted');
select is(public.account_deletion_blockers('77777777-7777-7777-7777-777777777777'), array['ADMIN_ACCOUNT'], 'an admin account is blocked');

insert into public.rides (id, "userId", status, fare, "paymentMethod", "paymentStatus", "rideType") values ('a1000000-0000-4000-8000-000000000003', '88888888-8888-8888-8888-888888888888', 'pending', 1000, 'cash', 'unpaid', 'standard');
select is(public.account_deletion_blockers('88888888-8888-8888-8888-888888888888'), array['ACTIVE_RIDE'], 'a rider with a trip in progress or waiting is blocked');
delete from public.rides where id = 'a1000000-0000-4000-8000-000000000003';

insert into public.rides (id, "userId", "driverId", status, fare, "paymentMethod", "paymentStatus", "rideType", "acceptedAt") values ('a1000000-0000-4000-8000-000000000004', '22222222-2222-2222-2222-222222222222', 'd3d3d3d3-d3d3-4d3d-8d3d-d3d3d3d3d3d3', 'accepted', 1000, 'cash', 'unpaid', 'standard', now());
select is(public.account_deletion_blockers('66666666-6666-6666-6666-666666666666'), array['ACTIVE_RIDE'], 'a driver with an accepted trip is blocked');
delete from public.rides where id = 'a1000000-0000-4000-8000-000000000004';

insert into public.wallets ("userId", balance) values ('44444444-4444-4444-4444-444444444444', 150) on conflict ("userId") do update set balance = 150;
select is(public.account_deletion_blockers('44444444-4444-4444-4444-444444444444'), array['WALLET_BALANCE'], 'money left in the wallet blocks deletion');

insert into public.refund_intents ("originalPaymentType", "rideId", "userId", "refundReference", "originalAmount", amount, "refundType", "requestedBy", status, "idempotencyKey")
values ('ride_wallet_payment', 'a1000000-0000-4000-8000-000000000002', '88888888-8888-8888-8888-888888888888', 'rf-1', 500, 500, 'full', '77777777-7777-7777-7777-777777777777', 'processing', 'idem-1');
select is(public.account_deletion_blockers('88888888-8888-8888-8888-888888888888'), array['PENDING_REFUND'], 'a refund still on its way blocks deletion');
delete from public.refund_intents where "refundReference" = 'rf-1';

insert into public.rides (id, "userId", "driverId", status, fare, "paymentMethod", "paymentStatus", "rideType", "driverEarningsAmount") values ('a1000000-0000-4000-8000-000000000005', '22222222-2222-2222-2222-222222222222', 'd2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2', 'completed', 3000, 'wallet', 'paid', 'standard', 2400);
select is(public.account_deletion_blockers('55555555-5555-5555-5555-555555555555'), array['DRIVER_EARNINGS_OWED'], 'earnings not yet paid out block a driver');

insert into public.driver_payouts ("driverId", amount, status) values ('d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2', 2400, 'pending');
select is(public.account_deletion_blockers('55555555-5555-5555-5555-555555555555'), array['PENDING_PAYOUT'], 'a payout still in flight blocks a driver (and the earnings it covers are no longer owed)');
update public.driver_payouts set status = 'processing' where "driverId" = 'd2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2';
update public.driver_payouts set status = 'completed', "completedAt" = now() where "driverId" = 'd2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2';
select is(public.account_deletion_blockers('55555555-5555-5555-5555-555555555555'), '{}'::text[], 'once everything is paid out the driver can be deleted');

insert into public.driver_commission_ledger ("driverId", type, amount, reason) values ('d3d3d3d3-d3d3-4d3d-8d3d-d3d3d3d3d3d3', 'cash_commission_debit', -400, 'cash trip');
select is(public.account_deletion_blockers('66666666-6666-6666-6666-666666666666'), array['DRIVER_COMMISSION_OWED'], 'cash commission the driver still owes blocks deletion');

-- Deleting is refused while blocked ----------------------------------------------------------------------------
select throws_ok($$ select public.anonymise_account('44444444-4444-4444-4444-444444444444') $$, 'P0001', 'ACCOUNT_DELETION_BLOCKED:WALLET_BALANCE', 'deletion is refused while blocked, and says why');
select is((select "displayName" from public.users where "uid" = '44444444-4444-4444-4444-444444444444') is distinct from 'Deleted user', true, 'a refused deletion erases nothing');
select throws_ok($$ select public.anonymise_account('99999999-9999-9999-9999-999999999999') $$, 'P0001', 'ACCOUNT_NOT_FOUND', 'an unknown account is reported');

-- Deleting the rider -----------------------------------------------------------------------------------------------
select lives_ok($$ select public.anonymise_account('11111111-1111-1111-1111-111111111111') $$, 'a rider account can be deleted');
select is((select "displayName" from public.users where "uid" = '11111111-1111-1111-1111-111111111111'), 'Deleted user', 'the name is gone');
select is((select count(*)::int from public.users where "uid" = '11111111-1111-1111-1111-111111111111' and "email" is null and "phoneNumber" is null and "photoURL" is null and "address" is null and "dateOfBirth" is null and "pushToken" is null), 1, 'email, phone, photo, address, birth date and push token are gone');
select is((select count(*)::int from public.rides where id = 'a1000000-0000-4000-8000-000000000001' and fare = 2500 and status = 'completed' and "paymentStatus" = 'paid'), 1, 'the ride keeps its fare, status and payment state');
select is((select count(*)::int from public.rides where id = 'a1000000-0000-4000-8000-000000000001' and "pickupAddress" is null and "dropoffAddress" is null and "pickupLocation" is null and "dropoffLocation" is null and "passengerName" is null and "passengerPhone" is null), 1, 'the ride no longer says where it started or ended, or who rode');
select is((select count(*)::int from public.wallet_transactions where "userId" = '11111111-1111-1111-1111-111111111111'), 1, 'wallet transaction history is kept');
select is((select count(*)::int from public.wallets where "userId" = '11111111-1111-1111-1111-111111111111'), 1, 'the (empty) wallet row is kept');
select is((select count(*)::int from public.saved_locations where "userId" = '11111111-1111-1111-1111-111111111111') + (select count(*)::int from public.family_members where "userId" = '11111111-1111-1111-1111-111111111111') + (select count(*)::int from public.payment_methods where "userId" = '11111111-1111-1111-1111-111111111111') + (select count(*)::int from public.wallet_bank_accounts where "userId" = '11111111-1111-1111-1111-111111111111') + (select count(*)::int from public.rider_preferences where "userId" = '11111111-1111-1111-1111-111111111111'), 0, 'saved places, family, cards, bank accounts and preferences are gone');
select is((select count(*)::int from public.messages where "conversationId" = 'conv-1'), 0, 'the chat messages are gone');
select is((select count(*)::int from public.conversations where id = 'conv-1' and "userName" = 'Deleted user' and "userPhone" is null and "lastMessage" is null and status = 'archived' and "driverName" = 'Dee One'), 1, 'the conversation is archived and the rider details removed, without touching the driver side');
select is((select count(*)::int from public.support_ticket_messages where "senderId" = '11111111-1111-1111-1111-111111111111' and text like '[removed%'), 1, 'what they wrote to support is removed');
select is((select count(*)::int from public.support_ticket_messages where "senderId" = '77777777-7777-7777-7777-777777777777' and text = 'we are looking'), 1, 'what staff wrote stays');
select is((select "filedByName" from public.support_tickets where id = 'c1000000-0000-4000-8000-000000000001'), 'Deleted user', 'the ticket no longer carries the name');
select is((select count(*)::int from public.ratings where "userId" = '11111111-1111-1111-1111-111111111111' and rating = 5 and comment is null and tags is null), 1, 'the star score stays, the written comment goes');
select is((select count(*)::int from public.user_roles where "userId" = '11111111-1111-1111-1111-111111111111'), 0, 'the account holds no roles any more');
select is((select email from auth.users where id = '11111111-1111-1111-1111-111111111111'), 'deleted-11111111-1111-1111-1111-111111111111@deleted.invalid', 'the login email becomes an address that can never receive mail');
select is((select count(*)::int from auth.identities where user_id = '11111111-1111-1111-1111-111111111111') + (select count(*)::int from auth.sessions where user_id = '11111111-1111-1111-1111-111111111111'), 0, 'social logins and signed-in sessions are removed');
select is((select banned_until from auth.users where id = '11111111-1111-1111-1111-111111111111'), 'infinity'::timestamptz, 'the login is locked');
select lives_ok($$ select public.anonymise_account('11111111-1111-1111-1111-111111111111') $$, 'running it a second time is harmless');

-- Deleting the driver --------------------------------------------------------------------------------------------------
select is((select public.anonymise_account('33333333-3333-3333-3333-333333333333')->'documentPaths'), '["drivers/d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1/license_1","drivers/d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1/reg_1"]'::jsonb, 'deleting a driver hands back the stored document files to remove');
select is((select count(*)::int from public.drivers where id = 'd1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1' and name = 'Deleted user' and email is null and phone is null and "fullLegalName" is null and "licenseNumber" is null and "vehiclePlateNumber" is null and "vehicleVin" is null and "profileImage" is null and "isOnline" = false and "isVerified" = false), 1, 'the driver profile is erased and the driver can no longer be dispatched');
select is((select count(*)::int from public.driver_documents where "driverId" = 'd1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1') + (select count(*)::int from public.driver_bank_accounts where "driverId" = 'd1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1'), 0, 'documents and bank details are gone');
select is((select count(*)::int from public.rides where id = 'a1000000-0000-4000-8000-000000000002' and "pickupAddress" = 'R2 Pickup' and "dropoffAddress" = 'R2 Dropoff' and "driverLocation" is null), 1, 'another rider''s trip history survives the driver being deleted');

-- Not for the apps ------------------------------------------------------------------------------------------------------
select lives_ok($$ do $x$ begin
  perform set_config('request.jwt.claims', '{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated"}', true);
  set local role authenticated;
  begin
    perform public.anonymise_account('88888888-8888-8888-8888-888888888888');
    raise exception 'was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.account_deletion_blockers('88888888-8888-8888-8888-888888888888');
    raise exception 'was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.rate_limit_hit('k', 1, 60);
    raise exception 'was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.rate_limits;
    raise exception 'was allowed';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $x$ $$, 'a signed-in app cannot delete accounts, read blockers or touch the rate limiter');
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- Rate limiter ----------------------------------------------------------------------------------------------------------
select is(public.rate_limit_hit('test:a', 3, 3600), true, 'hit 1 is allowed');
select is(public.rate_limit_hit('test:a', 3, 3600), true, 'hit 2 is allowed');
select is(public.rate_limit_hit('test:a', 3, 3600), true, 'hit 3 (the limit) is allowed');
select is(public.rate_limit_hit('test:a', 3, 3600), false, 'hit 4 is refused');
select is(public.rate_limit_hit('test:a', 3, 3600), false, 'and stays refused');
select is(public.rate_limit_hit('test:b', 3, 3600), true, 'another key has its own count');
select throws_ok($$ select public.rate_limit_hit('x', 0, 60) $$, 'P0001', 'rate_limit_hit: invalid arguments', 'a limit below 1 is rejected');
select is((select count from public.rate_limits where key = 'test:a'), 5, 'the count is recorded');

select * from finish();
rollback;
