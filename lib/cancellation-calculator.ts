import { CANCELLATION_FEE_CONFIG } from './pricing-config';

export interface CancellationFeeInput {
  status?: string | null;
  acceptedAt?: Date | string | null;
  arrivedAt?: Date | string | null;
}

export interface CancellationFeeResult {
  fee: number;
  reason: string;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

// Rider-initiated cancellation only (driver-side no-show/cancellation policy
// is a separate, deferred concern). Scoped strictly to what's knowable from
// the ride row at cancel time — no distance-traveled tracking exists.
export function calculateCancellationFee(
  ride: CancellationFeeInput,
  now: Date = new Date(),
  config: { freeWindowSeconds: number; afterAcceptFee: number; afterArrivalFee: number } = CANCELLATION_FEE_CONFIG
): CancellationFeeResult {
  const acceptedAt = toDate(ride.acceptedAt);

  if (!acceptedAt || ride.status === 'pending') {
    return { fee: 0, reason: 'No driver assigned yet' };
  }

  const secondsSinceAccept = (now.getTime() - acceptedAt.getTime()) / 1000;
  if (secondsSinceAccept <= config.freeWindowSeconds) {
    return { fee: 0, reason: 'Within free cancellation window' };
  }

  const arrivedAt = toDate(ride.arrivedAt);
  if (arrivedAt) {
    return { fee: config.afterArrivalFee, reason: 'Driver had already arrived at pickup' };
  }

  return { fee: config.afterAcceptFee, reason: 'Cancelled after driver accepted' };
}
