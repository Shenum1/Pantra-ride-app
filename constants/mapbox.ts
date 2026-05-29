export const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
export const MAPBOX_STYLE_ID = process.env.EXPO_PUBLIC_MAPBOX_STYLE_ID || 'streets-v12';

export function getMaskedMapboxToken(): string {
  if (!MAPBOX_ACCESS_TOKEN) {
    return 'Not configured';
  }

  if (MAPBOX_ACCESS_TOKEN.length <= 12) {
    return MAPBOX_ACCESS_TOKEN;
  }

  return `${MAPBOX_ACCESS_TOKEN.slice(0, 8)}...${MAPBOX_ACCESS_TOKEN.slice(-6)}`;
}
