// There is no `cancelledBy` column anywhere in the schema — the admin surface
// cannot say whether a rider or a driver cancelled a trip. What it *can* say,
// from timestamps that already exist on every ride, is which stage the trip
// had reached when it was cancelled. That's real operational context derived
// from real data, not an invented field.
export interface RideTimestamps {
  createdAt: string;
  acceptedAt: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}

export function cancellationStage(ride: RideTimestamps): string | null {
  if (!ride.cancelledAt) return null;
  if (ride.startedAt) return 'Cancelled after the trip started';
  if (ride.arrivedAt) return 'Cancelled after the driver arrived';
  if (ride.acceptedAt) return 'Cancelled while the driver was en route';
  return 'Cancelled before a driver was assigned';
}

export function elapsedLabel(fromIso: string, toIso: string): string {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  if (ms < 0) return '—';
  const mins = Math.round(ms / 60000);
  if (mins < 1) return '<1 min';
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem === 0 ? `${hrs}h` : `${hrs}h ${rem}m`;
}

export interface RideTimelineStep {
  label: string;
  at: string;
}

export function buildRideTimeline(ride: RideTimestamps & { status: string }): RideTimelineStep[] {
  const steps: RideTimelineStep[] = [{ label: 'Requested', at: ride.createdAt }];
  if (ride.acceptedAt) steps.push({ label: 'Driver assigned', at: ride.acceptedAt });
  if (ride.arrivedAt) steps.push({ label: 'Driver arrived', at: ride.arrivedAt });
  if (ride.startedAt) steps.push({ label: 'Trip started', at: ride.startedAt });
  if (ride.status === 'cancelled' && ride.cancelledAt) {
    steps.push({ label: 'Cancelled', at: ride.cancelledAt });
  } else if (ride.completedAt) {
    steps.push({ label: 'Completed', at: ride.completedAt });
  }
  return steps;
}
