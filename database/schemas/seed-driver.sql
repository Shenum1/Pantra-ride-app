-- Run in Supabase SQL Editor to create a test driver.
-- Each run creates a new unique driver. Credentials are printed in the output.

DO $$
DECLARE
  new_uid      uuid := gen_random_uuid();
  driver_email text := 'driver_' || substring(gen_random_uuid()::text, 1, 8) || '@pantra.com';
BEGIN

  -- 1. Auth user (auto-confirmed, password: driver123)
  INSERT INTO auth.users (
    instance_id, id, aud, role,
    email, encrypted_password,
    email_confirmed_at, confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    is_super_admin
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_uid, 'authenticated', 'authenticated',
    driver_email,
    crypt('driver123', gen_salt('bf')),
    now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"displayName":"Test Driver","role":"driver"}',
    now(), now(),
    false
  );

  -- 2. public.users row (trigger handle_new_user auto-creates this,
  --    but we update role to driver in case trigger runs after this block)
  UPDATE public.users SET "role" = 'driver' WHERE "uid" = new_uid;

  -- 3. Driver profile (isVerified: true so they appear in getNearbyDrivers)
  INSERT INTO public.drivers (
    "userId", "name", "email", "phone",
    "vehicle", "documents",
    "isVerified", "isOnline", "earnings", "rating"
  ) VALUES (
    new_uid,
    'Test Driver',
    driver_email,
    '+2348000000001',
    '{"make":"Toyota","model":"Corolla","year":2020,"licensePlate":"LG-001-AA","color":"Silver","type":"Standard"}',
    '{"driverLicense":"DL123456"}',
    true, false,
    '{"today":0,"thisWeek":0,"thisMonth":0,"total":0}',
    5.0
  );

  RAISE NOTICE '---------------------------------------------';
  RAISE NOTICE 'Driver created successfully';
  RAISE NOTICE 'Email:    %', driver_email;
  RAISE NOTICE 'Password: driver123';
  RAISE NOTICE '---------------------------------------------';
END $$;
