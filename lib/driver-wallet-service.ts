import { trpcClient } from './trpc';

export interface DriverBankAccount {
  id: string;
  bankName: string;
  // Full accountNumber is never sent to the client — see
  // backend/lib/bank-account-crypto.ts and
  // supabase-schema-driver-bank-accounts-encryption.sql. Only the last 4
  // digits are available here for display (e.g. "•••• 6789").
  accountNumberLast4: string;
  accountName: string;
  isDefault: boolean;
  createdAt: string;
}

export interface DriverPayout {
  id: string;
  driverId: string;
  amount: number;
  bankAccountId: string | null;
  status: 'pending' | 'processing' | 'manual_review' | 'completed' | 'failed' | 'reversed';
  failureReason: string | null;
  requestedAt: string;
  completedAt: string | null;
  bankAccount?: { id: string; bankName: string; accountName: string; accountNumberLast4: string } | null;
}

// All driver_bank_accounts reads/writes go through these backend routes —
// direct client access was revoked entirely (RLS policy dropped in
// supabase-schema-driver-bank-accounts-encryption.sql) since the table now
// holds an encryption key-derived column that must never reach the client.
export const DriverWalletService = {
  async getBankAccounts(): Promise<DriverBankAccount[]> {
    return trpcClient.driver.bankAccounts.list.query();
  },

  async addBankAccount(
    bankName: string,
    accountNumber: string,
    accountName: string,
    isDefault = false
  ): Promise<DriverBankAccount> {
    return trpcClient.driver.bankAccounts.add.mutate({ bankName, accountNumber, accountName, isDefault });
  },

  async removeBankAccount(id: string): Promise<void> {
    await trpcClient.driver.bankAccounts.remove.mutate({ id });
  },

  async getPayouts(): Promise<DriverPayout[]> {
    return trpcClient.driver.payouts.list.query();
  },

  // Phase 3A: driver_payouts.insert is no longer directly client-writable
  // (the RLS policy that allowed it was revoked — see
  // supabase-schema-driver-payouts-automation.sql). Creating a payout now
  // goes through this tRPC route, which validates balance/ownership
  // server-side and immediately attempts an automatic Paystack transfer in
  // the same request. `driverId` is accepted here only to keep this
  // method's external signature unchanged for existing callers — the server
  // resolves the actual driver identity from the authenticated session and
  // ignores any client-supplied id.
  async requestWithdrawal(
    _driverId: string,
    amount: number,
    bankAccountId: string
  ): Promise<DriverPayout> {
    return trpcClient.driver.payouts.request.mutate({ amount, bankAccountId }) as unknown as Promise<DriverPayout>;
  },
};
