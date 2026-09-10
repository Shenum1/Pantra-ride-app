-- Background videos shown on the app's splash/auth/dashboard screens, made
-- admin-editable instead of hardcoded per-screen URL literals. One row per
-- video; a screen with multiple enabled rows has one picked at random on the
-- client (see hooks/useVideoConfig.ts) — this is how the driver dashboard's
-- 3-video rotation already worked, generalized to every screen.
create table if not exists public.app_video_config (
  id uuid primary key default gen_random_uuid(),
  "screenKey" text not null check ("screenKey" in (
    'splash', 'role_selection', 'rider_login', 'rider_signup',
    'forgot_password', 'driver_login', 'driver_signup', 'driver_dashboard'
  )),
  "videoUrl" text not null,
  "isEnabled" boolean not null default true,
  "sortOrder" integer not null default 0,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

alter table public.app_video_config enable row level security;

-- Open read (anon included — several of these screens render before login),
-- writes are service-role only via the admin backend.
create policy "app_video_config_select" on public.app_video_config
  for select using (true);

-- Seed with the URLs already live in the app today, so this table starts
-- equivalent to current behavior rather than empty. Guarded so re-running
-- this migration doesn't duplicate rows (there's no natural unique key to
-- put an ON CONFLICT target on, since a screen can legitimately hold several
-- identical-looking variants).
insert into public.app_video_config ("screenKey", "videoUrl", "sortOrder")
select * from (values
  ('splash', 'https://videos.pexels.com/video-files/854118/854118-hd_1920_1080_25fps.mp4', 0),
  ('role_selection', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 0),
  ('rider_login', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 0),
  ('rider_signup', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', 0),
  ('forgot_password', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', 0),
  ('driver_login', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 0),
  ('driver_signup', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 0),
  ('driver_dashboard', 'https://videos.pexels.com/video-files/3044127/3044127-uhd_2560_1440_25fps.mp4', 0),
  ('driver_dashboard', 'https://videos.pexels.com/video-files/2103099/2103099-uhd_2560_1440_30fps.mp4', 1),
  ('driver_dashboard', 'https://videos.pexels.com/video-files/3571264/3571264-uhd_2560_1440_30fps.mp4', 2)
) as seed("screenKey", "videoUrl", "sortOrder")
where not exists (select 1 from public.app_video_config);
