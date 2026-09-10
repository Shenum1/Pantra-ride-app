import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { DEFAULT_VIDEO_CONFIG, pickRandomVideo, type VideoScreenKey } from '@/lib/video-config';

// Picks a background video URL for one of the app's splash/auth/dashboard
// screens. Renders with a locally-picked default IMMEDIATELY (no network
// wait — a splash screen must not block on a round-trip before it can start
// playing), then swaps to a live row from `app_video_config` once/if the
// fetch resolves with at least one enabled row for this screen.
export function useVideoConfig(screenKey: VideoScreenKey): string {
  const [defaultUrl] = useState(() => pickRandomVideo(DEFAULT_VIDEO_CONFIG[screenKey]));

  const { data } = useQuery({
    queryKey: ['videoConfig', screenKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_video_config')
        .select('videoUrl')
        .eq('screenKey', screenKey)
        .eq('isEnabled', true);
      if (error) throw error;
      return (data ?? []).map((row) => row.videoUrl as string);
    },
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  return useMemo(() => {
    if (data && data.length > 0) return pickRandomVideo(data);
    return defaultUrl;
  }, [data, defaultUrl]);
}
