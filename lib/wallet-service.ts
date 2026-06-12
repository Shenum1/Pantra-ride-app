import { supabase } from './supabase';
import type { WalletData, WalletTransaction, BankAccount } from '@/hooks/useWalletStore';

interface WalletTransactionRow {
  id: string;
  type: WalletTransaction['type'];
  amount: number | string;
  description: string | null;
  status: WalletTransaction['status'];
  rideId: string | null;
  paymentMethodId: string | null;
  metadata: WalletTransaction['metadata'] | null;
  createdAt: string;
}

interface BankAccountRow {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  ifscCode: string | null;
  swiftCode: string | null;
  type: BankAccount['type'];
  isDefault: boolean;
  isVerified: boolean;
}

function mapTransaction(row: WalletTransactionRow): WalletTransaction {
  return {
    id: row.id,
    type: row.type,
    amount: Number(row.amount),
    description: row.description ?? '',
    status: row.status,
    date: new Date(row.createdAt),
    rideId: row.rideId ?? undefined,
    paymentMethodId: row.paymentMethodId ?? undefined,
    metadata: row.metadata ?? undefined,
  };
}

function mapBankAccount(row: BankAccountRow): BankAccount {
  return {
    id: row.id,
    bankName: row.bankName,
    accountNumber: row.accountNumber,
    accountHolderName: row.accountHolderName,
    ifscCode: row.ifscCode ?? undefined,
    swiftCode: row.swiftCode ?? undefined,
    isDefault: row.isDefault,
    isVerified: row.isVerified,
    type: row.type,
  };
}

export class WalletService {
  static async getWalletData(userId: string): Promise<WalletData> {
    const [walletResult, txResult, bankResult] = await Promise.all([
      supabase.from('wallets').select('balance').eq('userId', userId).maybeSingle(),
      supabase
        .from('wallet_transactions')
        .select('*')
        .eq('userId', userId)
        .order('createdAt', { ascending: false })
        .limit(50),
      supabase
        .from('wallet_bank_accounts')
        .select('*')
        .eq('userId', userId)
        .order('createdAt', { ascending: true }),
    ]);

    let balance = Number(walletResult.data?.balance ?? 0);

    if (!walletResult.data) {
      const { data: created, error } = await supabase
        .from('wallets')
        .insert({ userId, balance: 0 })
        .select('balance')
        .single();

      if (!error && created) {
        balance = Number(created.balance ?? 0);
      }
    }

    return {
      balance,
      transactions: (txResult.data ?? []).map((row) => mapTransaction(row as WalletTransactionRow)),
      bankAccounts: (bankResult.data ?? []).map((row) => mapBankAccount(row as BankAccountRow)),
    };
  }

  static async addTransaction(
    userId: string,
    params: {
      type: WalletTransaction['type'];
      amount: number;
      description: string;
      status?: WalletTransaction['status'];
      rideId?: string;
      paymentMethodId?: string;
      reference?: string;
      metadata?: WalletTransaction['metadata'];
    }
  ): Promise<WalletTransaction> {
    const { data, error } = await supabase.rpc('add_wallet_transaction', {
      p_user_id: userId,
      p_type: params.type,
      p_amount: params.amount,
      p_description: params.description,
      p_status: params.status ?? 'completed',
      p_ride_id: params.rideId ?? null,
      p_payment_method_id: params.paymentMethodId ?? null,
      p_reference: params.reference ?? null,
      p_metadata: params.metadata ?? null,
    });

    if (error) throw new Error(error.message);

    const row = (Array.isArray(data) ? data[0] : data) as WalletTransactionRow;
    return mapTransaction(row);
  }

  static async addBankAccount(
    userId: string,
    account: Omit<BankAccount, 'id' | 'isVerified'>
  ): Promise<BankAccount> {
    if (account.isDefault) {
      await supabase.from('wallet_bank_accounts').update({ isDefault: false }).eq('userId', userId);
    }

    const { data, error } = await supabase
      .from('wallet_bank_accounts')
      .insert({
        userId,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        accountHolderName: account.accountHolderName,
        ifscCode: account.ifscCode ?? null,
        swiftCode: account.swiftCode ?? null,
        type: account.type,
        isDefault: account.isDefault,
        isVerified: false,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return mapBankAccount(data as BankAccountRow);
  }

  static async removeBankAccount(userId: string, bankAccountId: string): Promise<void> {
    const { data: removed, error } = await supabase
      .from('wallet_bank_accounts')
      .delete()
      .eq('id', bankAccountId)
      .eq('userId', userId)
      .select('isDefault')
      .single();

    if (error) throw new Error(error.message);

    if (removed?.isDefault) {
      const { data: remaining } = await supabase
        .from('wallet_bank_accounts')
        .select('id')
        .eq('userId', userId)
        .order('createdAt', { ascending: true })
        .limit(1);

      if (remaining && remaining.length > 0) {
        await supabase.from('wallet_bank_accounts').update({ isDefault: true }).eq('id', remaining[0].id);
      }
    }
  }

  static async setDefaultBankAccount(userId: string, bankAccountId: string): Promise<void> {
    await supabase.from('wallet_bank_accounts').update({ isDefault: false }).eq('userId', userId);

    const { error } = await supabase
      .from('wallet_bank_accounts')
      .update({ isDefault: true })
      .eq('id', bankAccountId)
      .eq('userId', userId);

    if (error) throw new Error(error.message);
  }
}
