import { Platform, Share } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';
import type { WalletTransaction } from '@/hooks/useWalletStore';

// Receipts for wallet transactions (app/wallet-transaction-details.tsx):
// "Share" sends a plain-text receipt through the phone's share sheet;
// "Download" creates a PDF the rider can save or send on.

const TYPE_LABELS: Record<WalletTransaction['type'], string> = {
  add_money: 'Money Added',
  withdraw: 'Withdrawal',
  ride_payment: 'Ride Payment',
  cashback: 'Cashback',
  refund: 'Refund',
  credit: 'Credit',
  debit: 'Debit',
};

const naira = (value: number) =>
  `₦${Math.abs(value).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const statusLabel = (status: WalletTransaction['status']) => status.charAt(0).toUpperCase() + status.slice(1);

// [label, value] rows shared by the text and PDF versions, so they never drift.
export function receiptRows(tx: WalletTransaction): [string, string][] {
  const rows: [string, string][] = [
    ['Type', TYPE_LABELS[tx.type] ?? 'Transaction'],
    ['Amount', `${tx.amount > 0 ? '+' : '-'}${naira(tx.amount)}`],
    ['Status', statusLabel(tx.status)],
    ['Date', format(tx.date, 'MMM dd, yyyy • hh:mm a')],
    ['Transaction ID', tx.id],
  ];
  if (tx.description) rows.push(['Description', tx.description]);
  if (tx.rideId) rows.push(['Ride ID', tx.rideId]);
  if (tx.metadata?.fromLocation) rows.push(['From', tx.metadata.fromLocation]);
  if (tx.metadata?.toLocation) rows.push(['To', tx.metadata.toLocation]);
  if (tx.metadata?.rideFare != null) rows.push(['Ride fare', naira(tx.metadata.rideFare)]);
  if (tx.metadata?.discountApplied) rows.push(['Discount', `-${naira(tx.metadata.discountApplied)}`]);
  if (tx.metadata?.promoCode) rows.push(['Promo code', tx.metadata.promoCode]);
  return rows;
}

export function buildReceiptText(tx: WalletTransaction): string {
  const lines = receiptRows(tx).map(([label, value]) => `${label}: ${value}`);
  return ['Pantra receipt', '', ...lines].join('\n');
}

// Every value is escaped: addresses and descriptions come from stored data,
// and this HTML is rendered (into a PDF, or a print window on web).
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export function buildReceiptHtml(tx: WalletTransaction): string {
  const rows = receiptRows(tx)
    .map(([label, value]) => `<tr><td class="label">${escapeHtml(label)}</td><td class="value">${escapeHtml(value)}</td></tr>`)
    .join('');
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Pantra receipt ${escapeHtml(tx.id)}</title>
<style>
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #111; margin: 40px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #666; font-size: 13px; margin: 0 0 24px; }
  .amount { font-size: 32px; font-weight: 700; margin: 0 0 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  td { padding: 10px 0; border-bottom: 1px solid #eee; vertical-align: top; }
  .label { color: #666; width: 40%; }
  .value { text-align: right; word-break: break-all; }
  .foot { margin-top: 32px; color: #888; font-size: 12px; }
</style>
</head>
<body>
  <h1>Pantra</h1>
  <p class="sub">Transaction receipt</p>
  <p class="amount">${escapeHtml(`${tx.amount > 0 ? '+' : '-'}${naira(tx.amount)}`)}</p>
  <table>${rows}</table>
  <p class="foot">Generated ${escapeHtml(format(new Date(), 'MMM dd, yyyy • hh:mm a'))}</p>
</body>
</html>`;
}

export async function shareReceipt(tx: WalletTransaction): Promise<void> {
  await shareReceiptMessage(buildReceiptText(tx));
}

// Shared with ride receipts (lib/ride-receipt.ts builds the text/HTML; these
// two helpers do the platform-specific sharing/printing for both).
export async function shareReceiptMessage(message: string): Promise<void> {
  // On web, React Native's Share uses the browser's share sheet where one
  // exists; desktop browsers mostly don't have it, so fall back to copying.
  if (Platform.OS === 'web') {
    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
    if (nav?.share) {
      await nav.share({ title: 'Pantra receipt', text: message });
      return;
    }
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(message);
      throw new ReceiptCopiedError();
    }
  }
  await Share.share({ message, title: 'Pantra receipt' });
}

// Not a failure — tells the caller the receipt was copied rather than shared.
export class ReceiptCopiedError extends Error {
  constructor() {
    super('Receipt copied to your clipboard.');
    this.name = 'ReceiptCopiedError';
  }
}

export async function downloadReceipt(tx: WalletTransaction): Promise<void> {
  await downloadReceiptHtml(buildReceiptHtml(tx));
}

export async function downloadReceiptHtml(html: string): Promise<void> {
  // Web: the browser's print dialog, which offers "Save as PDF".
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }

  const { uri } = await Print.printToFileAsync({ html });
  if (!(await Sharing.isAvailableAsync())) {
    // No share sheet on this device — fall back to printing / saving via the OS.
    await Print.printAsync({ uri });
    return;
  }
  // The share sheet is how a PDF gets saved on a phone ("Save to Files" on
  // iOS, Drive/Files on Android) or sent on.
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Save or share your receipt',
  });
}
