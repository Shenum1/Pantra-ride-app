// Background videos shown on the splash/auth/dashboard screens. These were
// previously hardcoded per-screen literals — now the live values come from
// the `app_video_config` table (see supabase-schema-app-video-config.sql),
// fetched in useVideoConfig and falling back to this file if the fetch is
// still pending, fails, or a screen has no enabled rows. Each screen key
// maps to one or more URLs — a screen with several picks one at random,
// same behavior the driver dashboard already had with DRIVING_VIDEOS.
export type VideoScreenKey =
  | 'splash'
  | 'role_selection'
  | 'rider_login'
  | 'rider_signup'
  | 'forgot_password'
  | 'driver_login'
  | 'driver_signup'
  | 'driver_dashboard';

export const DEFAULT_VIDEO_CONFIG: Record<VideoScreenKey, string[]> = {
  splash: ['https://videos.pexels.com/video-files/854118/854118-hd_1920_1080_25fps.mp4'],
  role_selection: ['https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'],
  rider_login: ['https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'],
  rider_signup: ['https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'],
  forgot_password: ['https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'],
  driver_login: ['https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'],
  driver_signup: ['https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'],
  driver_dashboard: [
    'https://videos.pexels.com/video-files/3044127/3044127-uhd_2560_1440_25fps.mp4',
    'https://videos.pexels.com/video-files/2103099/2103099-uhd_2560_1440_30fps.mp4',
    'https://videos.pexels.com/video-files/3571264/3571264-uhd_2560_1440_30fps.mp4',
  ],
};

export function pickRandomVideo(urls: string[]): string {
  return urls[Math.floor(Math.random() * urls.length)];
}
