import { supabase } from './supabase';

export interface DriverBankAccount {
  id: string;
  driverId: string;
  bankName: string;
  accountNumber: string;
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
  bankAccount?: DriverBankAccount;
}

export const DriverWalletService = {
  async getBankAccounts(driverId: string): Promise<DriverBankAccount[]> {
    const { data, error } = await supabase
      .from('driver_bank_accounts')
      .select('*')
      .eq('driverId', driverId)
      .order('createdAt', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as DriverBankAccount[];
  },

  async addBankAccount(
    driverId: string,
    bankName: string,
    accountNumber: string,
    accountName: string,
    isDefault = false
  ): Promise<DriverBankAccount> {
    if (isDefault) {
      // Clear any existing default first
      await supabase
        .from('driver_bank_accounts')
        .update({ isDefault: false })
        .eq('driverId', driverId);
    }
    const { data, error } = await supabase
      .from('driver_bank_accounts')
      .insert({ driverId, bankName, accountNumber, accountName, isDefault })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as DriverBankAccount;
  },

  async removeBankAccount(id: string): Promise<void> {
    const { error } = await supabase
      .from('driver_bank_accounts')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async getPayouts(driverId: string): Promise<DriverPayout[]> {
    const { data, error } = await supabase
      .from('driver_payouts')
      .select('*, bankAccount:driver_bank_accounts(*)')
      .eq('driverId', driverId)
      .order('requestedAt', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as DriverPayout[];
  },

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
