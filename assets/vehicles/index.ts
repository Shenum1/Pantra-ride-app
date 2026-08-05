import type { ImageSourcePropType } from 'react-native';

const CAR_IMAGE = require('./car.png') as ImageSourcePropType;

/**
 * Keyed primarily by RideType.id (canonical, stable) with the legacy lucide
 * `icon` strings from mocks/rideTypes.ts also mapped as aliases. Every entry
 * points at the same shared render today -- swapping in a category-specific
 * render later is just: drop the new file next to car.png, require() it,
 * and repoint that one map entry. No call-site changes needed.
 */
const VEHICLE_IMAGES: Record<string, ImageSourcePropType> = {
  // canonical ride-category ids
  standard: CAR_IMAGE,
  economy: CAR_IMAGE,
  comfort: CAR_IMAGE,
  xl: CAR_IMAGE,
  executive: CAR_IMAGE,
  courier: CAR_IMAGE,
  van: CAR_IMAGE,

  // legacy lucide `icon` strings still present in mocks/rideTypes.ts
  car: CAR_IMAGE,
  'car-front': CAR_IMAGE,
  bus: CAR_IMAGE,
};

const DEFAULT_IMAGE = CAR_IMAGE;

type RideTypeLike = { id?: string | null; icon?: string | null };

/**
 * Resolves the vehicle image for a ride type. Tries `id` first, falls back
 * to the legacy `icon` string, then to the default car render so an
 * unrecognized or future category never renders blank.
 */
export function getVehicleImageSource(
  type: RideTypeLike | string | null | undefined
): ImageSourcePropType {
  if (!type) {
    return DEFAULT_IMAGE;
  }

  if (typeof type === 'string') {
    return VEHICLE_IMAGES[type] ?? DEFAULT_IMAGE;
  }

  return (
    (type.id ? VEHICLE_IMAGES[type.id] : undefined) ??
    (type.icon ? VEHICLE_IMAGES[type.icon] : undefined) ??
    DEFAULT_IMAGE
  );
}

export default VEHICLE_IMAGES;
