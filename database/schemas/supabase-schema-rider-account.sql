-- Rider account data: run once in the Supabase SQL editor.
alter table public.users add column if not exists "dateOfBirth" date;
alter table public.users add column if not exists "address" text;

create table if not exists public.rider_preferences (
  "userId" uuid primary key references public.users("uid") on delete cascade,
  "locationSharing" boolean not null default false,
  "dataCollection" boolean not null default false,
  "personalizedAds" boolean not null default false,
  "profileVisibility" boolean not null default false,
  "twoFactorRequested" boolean not null default false,
  "biometricLogin" boolean not null default false,
  "loginAlerts" boolean not null default false,
  "shareTrip" boolean not null default false,
  "emergencyContactsEnabled" boolean not null default false,
  "rideCheck" boolean not null default false,
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.family_members (
  "id" uuid primary key default gen_random_uuid(),
  "userId" uuid not null references public.users("uid") on delete cascade,
  "name" text not null,
  "relationship" text not null,
  "phone" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists idx_family_members_user_id on public.family_members("userId");

alter table public.rider_preferences enable row level security;
alter table public.family_members enable row level security;

create policy "Users manage own rider preferences"
  on public.rider_preferences for all
  using (auth.uid() = "userId")
  with check (auth.uid() = "userId");

create policy "Users manage own family members"
  on public.family_members for all
  using (auth.uid() = "userId")
  with check (auth.uid() = "userId");
