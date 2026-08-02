export interface SurgeConfig {
  minMultiplier: number;
  maxMultiplier: number;
  // pendingRides / onlineDrivers ratio at/above which surge hits maxMultiplier
  highDemandRatio: number;
  // ratio at/below which surge is minMultiplier (no surge)
  lowDemandRatio: number;
  isEnabled: boolean;
}

// Pull-model marketplace has no dedicated demand/supply tracking table —
// this is computed on demand from two plain counts (online drivers, pending
// rides), no background job or geospatial indexing required.
export function calculateSurgeMultiplier(
  onlineDrivers: number,
  pendingRides: number,
  config: SurgeConfig
): number {
  if (!config.isEnabled) {
    return 1;
  }

  if (onlineDrivers <= 0) {
    return pendingRides > 0 ? config.maxMultiplier : config.minMultiplier;
  }

  const ratio = pendingRides / onlineDrivers;

  if (ratio <= config.lowDemandRatio) {
    return config.minMultiplier;
  }
  if (ratio >= config.highDemandRatio) {
    return config.maxMultiplier;
  }

  // Linear interpolation between (lowDemandRatio -> minMultiplier) and
  // (highDemandRatio -> maxMultiplier).
  const t = (ratio - config.lowDemandRatio) / (config.highDemandRatio - config.lowDemandRatio);
  const interpolated = config.minMultiplier + t * (config.maxMultiplier - config.minMultiplier);
  return Math.round(interpolated * 100) / 100;
}
