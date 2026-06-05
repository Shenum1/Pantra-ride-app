import { TIER_RATES, TierId } from './pricing-config';

export function calculateFare(
  distanceKm: number,
  durationMin: number,
  tierId: string,
  surgeMultiplier = 1
): number {
  const t = TIER_RATES[tierId as TierId] ?? TIER_RATES.standard;
  const raw = (t.base + distanceKm * t.perKm + durationMin * t.perMin) * surgeMultiplier;
  return Math.max(Math.round(raw), t.minFare);
}

export function calculateAllTierFares(
  distanceKm: number,
  durationMin: number,
  surgeMultiplier = 1
): Record<string, number> {
  return {
    standard: calculateFare(distanceKm, durationMin, 'standard', surgeMultiplier),
    comfort:  calculateFare(distanceKm, durationMin, 'comfort',  surgeMultiplier),
    xl:       calculateFare(distanceKm, durationMin, 'xl',       surgeMultiplier),
  };
}
