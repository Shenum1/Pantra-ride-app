import { supabase } from './supabase';
import type { WalletData, WalletTransaction } from '@/hooks/useWalletStore';

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

export class WalletService {
  static async getWalletData(userId: string): Promise<WalletData> {
    const [walletResult, txResult] = await Promise.all([
      supabase.from('wallets').select('balance').eq('userId', userId).maybeSingle(),
      supabase
        .from('wallet_transactions')
        .select('*')
        .eq('userId', userId)
        .order('createdAt', { ascending: false })
        .limit(50),
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
}
