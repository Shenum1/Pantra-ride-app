export interface SurgeConfig {
  minMultiplier: number;
  maxMultiplier: number;
  // pendingRides / onlineDrivers ratio at/above which surge hits maxMultiplier
  highDemandRatio: number;
  // ratio at/below which surge is minMultiplier (no surge)
  lowDemandRatio: number;
  isEnabled: boolean;
  // Optional acceptance-rate escalation — omitted/undefined disables it
  // entirely (existing callers that don't pass these fields, or don't pass
  // recentAcceptanceRate, are unaffected).
  lowAcceptanceThreshold?: number;
  lowAcceptanceBonus?: number;
}

// Pull-model marketplace has no dedicated demand/supply tracking table —
// this is computed on demand from two plain counts (online drivers, pending
// rides), no background job or geospatial indexing required.
//
// `recentAcceptanceRate` (0-1, or null/undefined when there isn't enough
// recent activity to trust it) is a second, independent demand signal: a low
// online-driver/pending-ride ratio can look calm even while drivers are
// actively rejecting most requests because the price is too low for them to
// bother — the ratio alone can't see that. When acceptance drops below
// `lowAcceptanceThreshold`, `lowAcceptanceBonus` is added on top of the
// ratio-based multiplier, still capped at `maxMultiplier`.
export function calculateSurgeMultiplier(
  onlineDrivers: number,
  pendingRides: number,
  config: SurgeConfig,
  recentAcceptanceRate?: number | null
): number {
  if (!config.isEnabled) {
    return 1;
  }

  let multiplier: number;

  if (onlineDrivers <= 0) {
    multiplier = pendingRides > 0 ? config.maxMultiplier : config.minMultiplier;
  } else {
    const ratio = pendingRides / onlineDrivers;

    if (ratio <= config.lowDemandRatio) {
      multiplier = config.minMultiplier;
    } else if (ratio >= config.highDemandRatio) {
      multiplier = config.maxMultiplier;
    } else {
      // Linear interpolation between (lowDemandRatio -> minMultiplier) and
      // (highDemandRatio -> maxMultiplier).
      const t = (ratio - config.lowDemandRatio) / (config.highDemandRatio - config.lowDemandRatio);
      multiplier = config.minMultiplier + t * (config.maxMultiplier - config.minMultiplier);
    }
  }

  if (
    recentAcceptanceRate != null &&
    config.lowAcceptanceThreshold != null &&
    config.lowAcceptanceBonus != null &&
    recentAcceptanceRate < config.lowAcceptanceThreshold
  ) {
    multiplier = Math.min(config.maxMultiplier, multiplier + config.lowAcceptanceBonus);
  }

  return Math.round(multiplier * 100) / 100;
}
