import createContextHook from "@nkzw/create-context-hook";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuthStore";
import { WalletService } from "@/lib/wallet-service";

export interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit' | 'refund' | 'cashback' | 'ride_payment' | 'add_money' | 'withdraw';
  amount: number;
  description: string;
  status: 'completed' | 'pending' | 'failed';
  date: Date;
  rideId?: string;
  paymentMethodId?: string;
  metadata?: {
    rideFare?: number;
    discountApplied?: number;
    promoCode?: string;
    fromLocation?: string;
    toLocation?: string;
  };
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  ifscCode?: string;
  swiftCode?: string;
  isDefault: boolean;
  isVerified: boolean;
  type: 'savings' | 'checking';
}

export interface WalletData {
  balance: number;
  transactions: WalletTransaction[];
  bankAccounts: BankAccount[];
}

const EMPTY_WALLET_DATA: WalletData = {
  balance: 0,
  transactions: [],
  bankAccounts: [],
};

export const [WalletProvider, useWallet] = createContextHook(() => {
  const { user } = useAuth();
  const isSupabaseUser = !!user?.id && user.id !== 'test-rider';
  const [walletData, setWalletData] = useState<WalletData>(EMPTY_WALLET_DATA);
  const queryClient = useQueryClient();

  const walletQueryKey = ["walletData", user?.id ?? null, isSupabaseUser] as const;

  const { data: fetchedWalletData, isLoading } = useQuery({
    queryKey: walletQueryKey,
    queryFn: async (): Promise<WalletData> => {
      if (isSupabaseUser && user) {
        try {
          return await WalletService.getWalletData(user.id);
        } catch (error) {
          console.error("Error fetching wallet data from Supabase:", error);
          return EMPTY_WALLET_DATA;
        }
      }

      // No real account — a wallet requires a real backend, never a seeded fake balance.
      return EMPTY_WALLET_DATA;
    },
  });

  useEffect(() => {
    if (fetchedWalletData) {
      setWalletData(fetchedWalletData);
    }
  }, [fetchedWalletData]);

  const refreshWalletData = async (): Promise<WalletData> => {
    await queryClient.invalidateQueries({ queryKey: ["walletData"] });
    return queryClient.getQueryData<WalletData>(walletQueryKey) ?? walletData;
  };

  const addMoneyMutation = useMutation({
    mutationFn: async ({ amount, paymentMethodId }: { amount: number; paymentMethodId: string }) => {
      if (isSupabaseUser && user) {
        await WalletService.addTransaction(user.id, {
          type: 'add_money',
          amount,
          description: 'Added money to wallet',
          paymentMethodId,
        });
        return refreshWalletData();
      }

      throw new Error('Wallet requires a signed-in account');
    },
  });

  const withdrawMoneyMutation = useMutation({
    mutationFn: async ({ amount, bankAccountId }: { amount: number; bankAccountId: string }) => {
      if (amount > walletData.balance) {
        throw new Error("Insufficient balance");
      }

      if (isSupabaseUser && user) {
        await WalletService.addTransaction(user.id, {
          type: 'withdraw',
          amount: -amount,
          description: 'Withdrawn to bank account',
          status: 'pending',
          paymentMethodId: bankAccountId,
        });
        return refreshWalletData();
      }

      throw new Error('Wallet requires a signed-in account');
    },
  });

  const processRidePaymentMutation = useMutation({
    mutationFn: async ({ amount, rideId, metadata }: { amount: number; rideId: string; metadata?: WalletTransaction['metadata'] }) => {
      if (amount > walletData.balance) {
        throw new Error("Insufficient balance");
      }

      if (isSupabaseUser && user) {
        await WalletService.addTransaction(user.id, {
          type: 'ride_payment',
          amount: -amount,
          description: 'Ride payment',
          rideId,
          metadata,
        });
        return refreshWalletData();
      }

      throw new Error('Wallet requires a signed-in account');
    },
  });

  const addCashbackMutation = useMutation({
    mutationFn: async ({ amount, description }: { amount: number; description: string }) => {
      if (isSupabaseUser && user) {
        await WalletService.addTransaction(user.id, {
          type: 'cashback',
          amount,
          description,
        });
        return refreshWalletData();
      }

      throw new Error('Wallet requires a signed-in account');
    },
  });

  const addRefundMutation = useMutation({
    mutationFn: async ({ amount, description, rideId }: { amount: number; description: string; rideId?: string }) => {
      if (isSupabaseUser && user) {
        await WalletService.addTransaction(user.id, {
          type: 'refund',
          amount,
          description,
          rideId,
        });
        return refreshWalletData();
      }

      throw new Error('Wallet requires a signed-in account');
    },
  });

  const addBankAccountMutation = useMutation({
    mutationFn: async (bankAccount: Omit<BankAccount, 'id' | 'isVerified'>) => {
      if (isSupabaseUser && user) {
        await WalletService.addBankAccount(user.id, bankAccount);
        return refreshWalletData();
      }

      throw new Error('Wallet requires a signed-in account');
    },
  });

  const removeBankAccountMutation = useMutation({
    mutationFn: async (bankAccountId: string) => {
      if (isSupabaseUser && user) {
        await WalletService.removeBankAccount(user.id, bankAccountId);
        return refreshWalletData();
      }

      throw new Error('Wallet requires a signed-in account');
    },
  });

  const setDefaultBankAccountMutation = useMutation({
    mutationFn: async (bankAccountId: string) => {
      if (isSupabaseUser && user) {
        await WalletService.setDefaultBankAccount(user.id, bankAccountId);
        return refreshWalletData();
      }

      throw new Error('Wallet requires a signed-in account');
    },
  });

  return useMemo(() => ({
    balance: walletData.balance,
    transactions: walletData.transactions,
    bankAccounts: walletData.bankAccounts,
    isLoading,
    addMoney: addMoneyMutation.mutate,
    addMoneyAsync: addMoneyMutation.mutateAsync,
    withdrawMoney: withdrawMoneyMutation.mutate,
    withdrawMoneyAsync: withdrawMoneyMutation.mutateAsync,
    processRidePayment: processRidePaymentMutation.mutate,
    processRidePaymentAsync: processRidePaymentMutation.mutateAsync,
    addCashback: addCashbackMutation.mutate,
    addCashbackAsync: addCashbackMutation.mutateAsync,
    addRefund: addRefundMutation.mutate,
    addRefundAsync: addRefundMutation.mutateAsync,
    addBankAccount: addBankAccountMutation.mutate,
    addBankAccountAsync: addBankAccountMutation.mutateAsync,
    removeBankAccount: removeBankAccountMutation.mutate,
    removeBankAccountAsync: removeBankAccountMutation.mutateAsync,
    setDefaultBankAccount: setDefaultBankAccountMutation.mutate,
    setDefaultBankAccountAsync: setDefaultBankAccountMutation.mutateAsync,
    isAddingMoney: addMoneyMutation.isPending,
    isWithdrawing: withdrawMoneyMutation.isPending,
    isProcessingPayment: processRidePaymentMutation.isPending,
  }), [
    walletData.balance,
    walletData.transactions,
    walletData.bankAccounts,
    isLoading,
    addMoneyMutation.mutate,
    addMoneyMutation.mutateAsync,
    addMoneyMutation.isPending,
    withdrawMoneyMutation.mutate,
    withdrawMoneyMutation.mutateAsync,
    withdrawMoneyMutation.isPending,
    processRidePaymentMutation.mutate,
    processRidePaymentMutation.mutateAsync,
    processRidePaymentMutation.isPending,
    addCashbackMutation.mutate,
    addCashbackMutation.mutateAsync,
    addRefundMutation.mutate,
    addRefundMutation.mutateAsync,
    addBankAccountMutation.mutate,
    addBankAccountMutation.mutateAsync,
    removeBankAccountMutation.mutate,
    removeBankAccountMutation.mutateAsync,
    setDefaultBankAccountMutation.mutate,
    setDefaultBankAccountMutation.mutateAsync,
  ]);
});
