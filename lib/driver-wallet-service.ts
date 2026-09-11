import { supabase } from './supabase';
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
  status: 'pending' | 'processing' | 'completed' | 'failed';
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

  // driver_payouts itself keeps its own client-facing RLS
  // (driver_payouts_select_own/driver_payouts_insert_own) — it never
  // contained a raw account number, only a bankAccountId reference, so this
  // insert is unaffected by the bank-account RLS revocation and stays a
  // direct client call, same as before.
  async requestWithdrawal(
    driverId: string,
    amount: number,
    bankAccountId: string
  ): Promise<DriverPayout> {
    const { data, error } = await supabase
      .from('driver_payouts')
      .insert({ driverId, amount, bankAccountId, status: 'pending' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as DriverPayout;
  },
};
