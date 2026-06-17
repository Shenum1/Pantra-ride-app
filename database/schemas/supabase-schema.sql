-- ============================================================
-- Pantra Ride App — Supabase Schema
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- 1. USERS table (linked to Supabase auth.users)
create table if not exists public.users (
  "uid"          uuid primary key references auth.users(id) on delete cascade,
  "email"        text,
  "displayName"  text,
  "photoURL"     text,
  "phoneNumber"  text,
  "role"         text check ("role" in ('rider', 'driver', 'admin')) default 'rider',
  "rating"       numeric default 5.0,
  "createdAt"    timestamptz default now(),
  "updatedAt"    timestamptz default now()
);

-- 2. DRIVERS table
create table if not exists public.drivers (
  "id"           uuid primary key default gen_random_uuid(),
  "userId"       uuid references public.users("uid") on delete cascade unique,
  "name"         text,
  "email"        text,
  "phone"        text,
  "rating"       numeric default 5.0,
  "totalRides"   integer default 0,
  "isOnline"     boolean default false,
  "isVerified"   boolean default false,
  "profileImage" text,
  "location"     jsonb,
  "vehicle"      jsonb,
  "documents"    jsonb,
  "earnings"     jsonb default '{"today":0,"thisWeek":0,"thisMonth":0,"total":0}',
  "createdAt"    timestamptz default now(),
  "lastActiveAt" timestamptz default now()
);

-- 3. RIDES table
create table if not exists public.rides (
  "id"                   uuid primary key default gen_random_uuid(),
  "userId"               uuid references public.users("uid"),
  "driverId"             uuid references public.drivers("id"),
  "pickupLocation"       jsonb,
  "dropoffLocation"      jsonb,
  "pickupAddress"        text,
  "dropoffAddress"       text,
  "rideType"             text default 'standard',
  "status"               text check ("status" in ('pending','accepted','in-progress','completed','cancelled')) default 'pending',
  "fare"                 numeric default 0,
  "baseFare"             numeric default 0,
  "minFare"              numeric default 0,
  "maxFare"              numeric default 0,
  "fareAdjustmentPercent" numeric default 0,
  "distance"             numeric default 0,
  "duration"             integer default 0,
  "trackingStage"        text,
  "statusText"           text,
  "driverLocation"       jsonb,
  "paymentMethod"        text,
  "promoCode"            text,
  "isShared"             boolean default false,
  "sharedWith"           text[],
  "scheduledTime"        timestamptz,
  "cancelReason"         text,
  "cancelReasonDetails"  text,
  "acceptedAt"           timestamptz,
  "startedAt"            timestamptz,
  "completedAt"          timestamptz,
  "cancelledAt"          timestamptz,
  "driverRating"         numeric,
  "createdAt"            timestamptz default now(),
  "updatedAt"            timestamptz default now()
);

-- 4. INDEXES
create index if not exists idx_rides_userId     on public.rides("userId");
create index if not exists idx_rides_driverId   on public.rides("driverId");
create index if not exists idx_rides_status     on public.rides("status");
create index if not exists idx_rides_createdAt  on public.rides("createdAt" desc);
create index if not exists idx_drivers_isOnline on public.drivers("isOnline");

-- 5. ROW LEVEL SECURITY
alter table public.users   enable row level security;
alter table public.drivers enable row level security;
alter table public.rides   enable row level security;

-- Users policies
create policy "Users can read own profile"
  on public.users for select using (auth.uid() = "uid");
create policy "Users can update own profile"
  on public.users for update using (auth.uid() = "uid");
create policy "Allow insert on signup"
  on public.users for insert with check (true);

-- Drivers policies
create policy "Anyone can read drivers"
  on public.drivers for select using (true);
create policy "Driver can update own row"
  on public.drivers for update using (
    auth.uid() in (select "uid" from public.users where "uid" = "userId")
  );
create policy "Allow driver insert"
  on public.drivers for insert with check (true);

-- Rides policies
create policy "Rider can read own rides"
  on public.rides for select using (
    auth.uid() = "userId" or
    auth.uid() in (select "userId" from public.drivers where "id" = "driverId")
  );
create policy "Rider can create rides"
  on public.rides for insert with check (auth.uid() = "userId");
create policy "Rider or driver can update ride"
  on public.rides for update using (
    auth.uid() = "userId" or
    auth.uid() in (select "userId" from public.drivers where "id" = "driverId")
  );

-- 6. AUTO-CREATE user row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users ("uid", "email", "displayName", "photoURL", "role")
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'displayName', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_user_meta_data->>'role', 'rider')
  )
  on conflict ("uid") do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 7. CONVERSATIONS table (in-app messaging)
create table if not exists public.conversations (
  "id"               text primary key,
  "userId"           uuid references public.users("uid"),
  "userName"         text,
  "userPhone"        text,
  "driverId"         uuid references public.drivers("id"),
  "driverName"       text,
  "driverPhone"      text,
  "rideId"           uuid references public.rides("id"),
  "lastMessage"      text,
  "lastMessageTime"  timestamptz,
  "unreadCountUser"  integer default 0,
  "unreadCountDriver" integer default 0,
  "status"           text check ("status" in ('active','archived')) default 'active',
  "createdAt"        timestamptz default now(),
  "updatedAt"        timestamptz default now()
);

-- 8. MESSAGES table
create table if not exists public.messages (
  "id"             uuid primary key default gen_random_uuid(),
  "conversationId" text references public.conversations("id") on delete cascade,
  "senderId"       uuid,
  "senderType"     text check ("senderType" in ('user','driver')),
  "text"           text,
  "read"           boolean default false,
  "createdAt"      timestamptz default now()
);

create index if not exists idx_messages_conversationId on public.messages("conversationId");
create index if not exists idx_conversations_userId    on public.conversations("userId");
create index if not exists idx_conversations_driverId  on public.conversations("driverId");

alter table public.conversations enable row level security;
alter table public.messages     enable row level security;

create policy "Participants can read conversations"
  on public.conversations for select using (
    auth.uid() = "userId" or
    auth.uid() in (select "userId" from public.drivers where "id" = "driverId")
  );
create policy "Participants can insert conversations"
  on public.conversations for insert with check (true);
create policy "Participants can update conversations"
  on public.conversations for update using (
    auth.uid() = "userId" or
    auth.uid() in (select "userId" from public.drivers where "id" = "driverId")
  );

create policy "Participants can read messages"
  on public.messages for select using (
    auth.uid() in (
      select "userId" from public.conversations where "id" = "conversationId"
      union
      select u."uid" from public.drivers d join public.users u on u."uid" = d."userId"
      where d."id" in (select "driverId" from public.conversations where "id" = "conversationId")
    )
  );
create policy "Participants can send messages"
  on public.messages for insert with check (true);
create policy "Participants can update messages"
  on public.messages for update using (true);

-- ============================================================
-- STORAGE BUCKETS (run separately in Dashboard > Storage)
-- 1. Create bucket "avatars"  — Public: YES
-- 2. Create bucket "documents" — Public: NO
-- ============================================================
