import { Platform } from 'react-native';
import { trpcClient } from './trpc';

// Account deletion and "download my data". The rules live on the server
// (backend/trpc/routes/account/*) — this only asks and shows the answer.

export type DeletionBlocker =
  | 'ADMIN_ACCOUNT'
  | 'ACTIVE_RIDE'
  | 'WALLET_BALANCE'
  | 'PENDING_REFUND'
  | 'PENDING_PAYOUT'
  | 'DRIVER_EARNINGS_OWED'
  | 'DRIVER_COMMISSION_OWED';

// What the person has to do before the account can be deleted, in plain words.
const BLOCKER_TEXT: Record<DeletionBlocker, string> = {
  ADMIN_ACCOUNT: 'This is an administrator account. Another administrator has to remove it.',
  ACTIVE_RIDE: 'You have a trip that is not finished. Finish or cancel it first.',
  WALLET_BALANCE: 'Your wallet still has money in it. Spend it or ask support to refund it first.',
  PENDING_REFUND: 'A refund to you is still being processed. Wait for it to finish first.',
  PENDING_PAYOUT: 'A payout to you is still being processed. Wait for it to finish first.',
  DRIVER_EARNINGS_OWED: 'You have driver earnings that have not been paid out yet. Request a payout first.',
  DRIVER_COMMISSION_OWED: 'You owe Pantra commission from cash trips. Pay it first.',
};

export function describeBlocker(code: string): string {
  return (
    BLOCKER_TEXT[code as DeletionBlocker] ??
    'Something on your account needs to be sorted out first. Please contact support.'
  );
}

/** The codes inside a refused-deletion error message ("ACCOUNT_DELETION_BLOCKED:A,B"), or null for any other error. */
export function blockersFromError(error: unknown): string[] | null {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const marker = 'ACCOUNT_DELETION_BLOCKED:';
  const at = message.indexOf(marker);
  if (at < 0) return null;
  return message
    .slice(at + marker.length)
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean);
}

export class AccountService {
  static async getDeletionBlockers(): Promise<string[]> {
    const { blockers } = await trpcClient.account.deletionCheck.query();
    return blockers;
  }

  static async deleteAccount(): Promise<void> {
    await trpcClient.account.delete.mutate({ confirm: 'DELETE' });
  }

  /** Fetches everything Pantra holds about the user and hands it to the phone's share sheet (or downloads it on web) as a JSON file. */
  static async downloadMyData(): Promise<void> {
    const data = await trpcClient.account.exportData.query();
    const json = JSON.stringify(data, null, 2);
    const fileName = `pantra-my-data-${new Date().toISOString().slice(0, 10)}.json`;

    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    const { File, Paths } = await import('expo-file-system');
    const Sharing = await import('expo-sharing');
    const file = new File(Paths.cache, fileName);
    file.create({ overwrite: true });
    file.write(json);
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('Sharing is not available on this device.');
    }
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      UTI: 'public.json',
      dialogTitle: 'Your Pantra data',
    });
  }
}
