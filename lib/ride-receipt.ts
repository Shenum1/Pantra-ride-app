import { format } from 'date-fns';
import { RIDE_TYPES } from '@/constants/ride-types';

// Ride receipts (app/ride-receipt.tsx), for riders and drivers. Pure: takes a
// public.rides row plus a few looked-up names and builds the receipt; loading
// lives in lib/ride-receipt-service.ts, sharing/printing in
// lib/transaction-receipt.ts.
//
// Only what the ride row actually stores is shown. The row keeps the final
// total ("fare") and the flat fees separately, but not the distance/time
// components, the surge/traffic multiplier, or the promo discount amount — so
// those are never recomputed here. "Trip fare" is the total minus the stored
// flat fees, the same metered-fare split the settlement trigger uses
// (supabase-schema-ride-payment-status.sql).

export type ReceiptPerspective = 'rider' | 'driver';

// The public.rides columns this reads. Numeric columns can come back as
// strings depending on the column type, so every amount goes through num().
export interface RideReceiptSource {
  id: string;
  status: string;
  createdAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  rideType?: string | null;
  fare?: number | string | null;
  baseFare?: number | string | null;
  bookingFee?: number | string | null;
  serviceFee?: number | string | null;
  zoneFee?: number | string | null;
  priorityFee?: number | string | null;
  waitingCharge?: number | string | null;
  cancellationFee?: number | string | null;
  promoCode?: string | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  platformCommissionAmount?: number | string | null;
  driverEarningsAmount?: number | string | null;
}

export interface RideReceiptParties {
  driverName?: string | null;
  vehiclePlate?: string | null;
  riderName?: string | null;
}

export interface ReceiptCharge {
  label: string;
  amount: number;
  note?: string;
}

export interface RideReceipt {
  rideId: string;
  kind: 'trip' | 'cancellation';
  perspective: ReceiptPerspective;
  title: string;
  date: Date;
  details: [string, string][];
  charges: ReceiptCharge[];
  total: number;
  tip: number;
  // Driver receipts only, and only when the ride row has the settlement snapshot.
  commission: number | null;
  driverEarnings: number | null;
}

const num = (value: number | string | null | undefined): number => {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  return Number.isFinite(n) ? (n as number) : 0;
};

const optionalNum = (value: number | string | null | undefined): number | null =>
  value == null || value === '' ? null : num(value);

export const naira = (value: number) =>
  `₦${Math.abs(value).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export const firstName = (name: string | null | undefined): string | null => {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : null;
};

const PAYMENT_METHOD_LABELS: Record<string, string> = { cash: 'Cash', wallet: 'Pantra Wallet' };

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: 'Paid',
  unpaid: 'Unpaid',
  pending: 'Pending',
  failed: 'Failed',
};

const rideTypeLabel = (rideType: string | null | undefined) => {
  if (!rideType) return null;
  return RIDE_TYPES.find((t) => t.id === rideType)?.name ?? capitalize(rideType);
};

// A receipt exists for a completed ride, or a cancelled one that charged a fee.
export function isRideReceiptAvailable(ride: Pick<RideReceiptSource, 'status' | 'cancellationFee'>): boolean {
  if (ride.status === 'completed') return true;
  return ride.status === 'cancelled' && num(ride.cancellationFee) > 0;
}

export function buildRideReceipt(
  ride: RideReceiptSource,
  perspective: ReceiptPerspective,
  parties: RideReceiptParties = {},
  tipAmount = 0
): RideReceipt | null {
  if (!isRideReceiptAvailable(ride)) return null;

  const kind = ride.status === 'completed' ? 'trip' : 'cancellation';
  const dateSource = (kind === 'trip' ? ride.completedAt : ride.cancelledAt) ?? ride.createdAt;
  const date = dateSource ? new Date(dateSource) : new Date(NaN);

  const charges: ReceiptCharge[] = [];
  let total: number;

  if (kind === 'trip') {
    const fees: ReceiptCharge[] = [
      { label: 'Booking fee', amount: num(ride.bookingFee) },
      { label: 'Service fee', amount: num(ride.serviceFee) },
      { label: 'Airport zone fee', amount: num(ride.zoneFee) },
      { label: 'Priority fee', amount: num(ride.priorityFee) },
      { label: 'Waiting charge', amount: num(ride.waitingCharge) },
    ].filter((c) => c.amount > 0);

    total = num(ride.fare);
    const feeTotal = fees.reduce((sum, c) => sum + c.amount, 0);
    const baseFare = num(ride.baseFare);
    const notes: string[] = [];
    if (baseFare > 0) notes.push(`includes ${naira(baseFare)} base fare`);
    if (ride.promoCode) notes.push(`promo ${ride.promoCode} applied`);

    charges.push({
      label: 'Trip fare',
      amount: Math.max(0, Math.round((total - feeTotal) * 100) / 100),
      ...(notes.length ? { note: notes.join(', ') } : {}),
    });
    charges.push(...fees);
  } else {
    // cancelRide() writes the fee into "fare" as well, but cancellationFee is
    // the column that's specifically about it.
    total = num(ride.cancellationFee);
    charges.push({ label: 'Cancellation fee', amount: total });
  }

  const details: [string, string][] = [['Ride ID', ride.id]];
  if (!Number.isNaN(date.getTime())) details.push(['Date', format(date, 'MMM dd, yyyy • hh:mm a')]);
  if (ride.pickupAddress) details.push(['Pickup', ride.pickupAddress]);
  if (ride.dropoffAddress) details.push(['Destination', ride.dropoffAddress]);
  const typeLabel = rideTypeLabel(ride.rideType);
  if (typeLabel) details.push(['Ride type', typeLabel]);

  if (perspective === 'rider') {
    const driver = firstName(parties.driverName);
    if (driver) details.push(['Driver', driver]);
    if (parties.vehiclePlate?.trim()) details.push(['Vehicle plate', parties.vehiclePlate.trim()]);
  } else {
    const rider = firstName(parties.riderName);
    if (rider) details.push(['Rider', rider]);
  }

  if (ride.paymentMethod) {
    details.push(['Payment method', PAYMENT_METHOD_LABELS[ride.paymentMethod.toLowerCase()] ?? capitalize(ride.paymentMethod)]);
  }
  if (ride.paymentStatus) {
    details.push(['Payment status', PAYMENT_STATUS_LABELS[ride.paymentStatus] ?? capitalize(ride.paymentStatus)]);
  }

  return {
    rideId: ride.id,
    kind,
    perspective,
    title: kind === 'trip' ? 'Trip receipt' : 'Cancellation receipt',
    date,
    details,
    charges,
    total,
    tip: tipAmount > 0 ? tipAmount : 0,
    commission: perspective === 'driver' ? optionalNum(ride.platformCommissionAmount) : null,
    driverEarnings: perspective === 'driver' ? optionalNum(ride.driverEarningsAmount) : null,
  };
}

// [label, value] summary rows after the itemised charges: total, tip, and
// (driver only) the commission split. Shared by the screen, text and PDF.
export function receiptTotalRows(receipt: RideReceipt): [string, string][] {
  const rows: [string, string][] = [[receipt.kind === 'trip' ? 'Total' : 'Total charged', naira(receipt.total)]];
  if (receipt.tip > 0) {
    rows.push([receipt.perspective === 'driver' ? 'Tip (100% yours)' : 'Tip', naira(receipt.tip)]);
  }
  if (receipt.perspective === 'driver' && receipt.commission != null && receipt.driverEarnings != null) {
    rows.push(['Pantra commission', `-${naira(receipt.commission)}`]);
    rows.push(['Your earnings', naira(receipt.driverEarnings + receipt.tip)]);
  } else if (receipt.tip > 0) {
    rows.push(['Total incl. tip', naira(receipt.total + receipt.tip)]);
  }
  return rows;
}

const chargeLabel = (c: ReceiptCharge) => (c.note ? `${c.label} (${c.note})` : c.label);

export function buildRideReceiptText(receipt: RideReceipt): string {
  return [
    `Pantra ${receipt.title.toLowerCase()}`,
    '',
    ...receipt.details.map(([label, value]) => `${label}: ${value}`),
    '',
    ...receipt.charges.map((c) => `${chargeLabel(c)}: ${naira(c.amount)}`),
    ...receiptTotalRows(receipt).map(([label, value]) => `${label}: ${value}`),
  ].join('\n');
}

// Every value is escaped: addresses and names come from stored data, and this
// HTML is rendered (into a PDF, or a print window on web).
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const row = (label: string, value: string, cls = '') =>
  `<tr${cls ? ` class="${cls}"` : ''}><td class="label">${escapeHtml(label)}</td><td class="value">${escapeHtml(value)}</td></tr>`;

export function buildRideReceiptHtml(receipt: RideReceipt): string {
  const details = receipt.details.map(([label, value]) => row(label, value)).join('');
  const charges = receipt.charges.map((c) => row(chargeLabel(c), naira(c.amount))).join('');
  const totals = receiptTotalRows(receipt)
    .map(([label, value], i) => row(label, value, i === 0 ? 'total' : ''))
    .join('');
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Pantra ${escapeHtml(receipt.title.toLowerCase())} ${escapeHtml(receipt.rideId)}</title>
<style>
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #111; margin: 40px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 28px 0 4px; }
  .sub { color: #666; font-size: 13px; margin: 0 0 24px; }
  .amount { font-size: 32px; font-weight: 700; margin: 0 0 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  td { padding: 10px 0; border-bottom: 1px solid #eee; vertical-align: top; }
  .label { color: #666; width: 55%; }
  .value { text-align: right; word-break: break-word; }
  .total td { font-weight: 700; color: #111; border-top: 2px solid #111; }
  .foot { margin-top: 32px; color: #888; font-size: 12px; }
</style>
</head>
<body>
  <h1>Pantra</h1>
  <p class="sub">${escapeHtml(receipt.title)}</p>
  <p class="amount">${escapeHtml(naira(receipt.total))}</p>
  <table>${details}</table>
  <h2>Fare breakdown</h2>
  <table>${charges}${totals}</table>
  <p class="foot">Generated ${escapeHtml(format(new Date(), 'MMM dd, yyyy • hh:mm a'))}</p>
</body>
</html>`;
}
