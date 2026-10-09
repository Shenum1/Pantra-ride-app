// Rules for paying part of a ride with reward points. Shared by the server
// (rides.create decides the real amount) and the app (shows an estimate).

/** 1 point = ₦16, so 500 points = ₦8,000. */
export const POINTS_TO_NGN = 16;

/** Points can pay for at most half of a fare; the rider pays the rest in cash or from the wallet. */
export const POINTS_MAX_FARE_SHARE = 0.5;

export interface PointsCover {
  pointsUsed: number;
  valueNGN: number;
}

/**
 * How many whole points to spend on a fare: as many as the rider has, up to
 * the cap. Works in kobo so a fare like 1000.50 doesn't hit floating-point
 * rounding. Never returns a value above the cap or the balance.
 */
export function calculatePointsCover(fareNGN: number, balancePoints: number): PointsCover {
  if (!(fareNGN > 0) || !(balancePoints >= 1)) return { pointsUsed: 0, valueNGN: 0 };

  const capKobo = Math.floor(Math.round(fareNGN * 100) * POINTS_MAX_FARE_SHARE);
  const maxPointsByCap = Math.floor(capKobo / (POINTS_TO_NGN * 100));
  const pointsUsed = Math.max(0, Math.min(Math.floor(balancePoints), maxPointsByCap));

  return { pointsUsed, valueNGN: pointsUsed * POINTS_TO_NGN };
}
