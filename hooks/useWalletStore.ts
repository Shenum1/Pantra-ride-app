import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";

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

const WALLET_STORAGE_KEY = "wallet_data";

const mockWalletData: WalletData = {
  balance: 12550,
  transactions: [
    {
      id: 'txn-1',
      type: 'add_money',
      amount: 10000,
      description: 'Added money to wallet',
      status: 'completed',
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'txn-2',
      type: 'ride_payment',
      amount: -2550,
      description: 'Ride payment',
      status: 'completed',
      date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      metadata: {
        fromLocation: 'Home',
        toLocation: 'Office',
        rideFare: 2550,
      }
    },
    {
      id: 'txn-3',
      type: 'cashback',
      amount: 500,
      description: 'Cashback from ride',
      status: 'completed',
      date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'txn-4',
      type: 'ride_payment',
      amount: -1875,
      description: 'Ride payment',
      status: 'completed',
      date: new Date(Date.now() - 5 * 60 * 60 * 1000),
      metadata: {
        fromLocation: 'Mall',
        toLocation: 'Restaurant',
        rideFare: 1875,
      }
    },
    {
      id: 'txn-5',
      type: 'refund',
      amount: 1250,
      description: 'Ride cancellation refund',
      status: 'completed',
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  ],
  bankAccounts: [
    {
      id: 'bank-1',
      bankName: 'Bank of America',
      accountNumber: '****1234',
      accountHolderName: 'John Doe',
      isDefault: true,
      isVerified: true,
      type: 'checking',
    },
  ],
};

export const [WalletProvider, useWallet] = createContextHook(() => {
  const [walletData, setWalletData] = useState<WalletData>(mockWalletData);
  const queryClient = useQueryClient();

  const { data: fetchedWalletData, isLoading } = useQuery({
    queryKey: ["walletData"],
    queryFn: async () => {
      try {
        const stored = await AsyncStorage.getItem(WALLET_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          return {
            ...parsed,
            transactions: parsed.transactions.map((t: WalletTransaction) => ({
              ...t,
              date: new Date(t.date),
            })),
          } as WalletData;
        }
        await AsyncStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(mockWalletData));
        return mockWalletData;
      } catch (error) {
        console.error("Error fetching wallet data:", error);
        return mockWalletData;
      }
    },
  });

  useEffect(() => {
    if (fetchedWalletData) {
      setWalletData(fetchedWalletData);
    }
  }, [fetchedWalletData]);

  const saveWalletData = async (data: WalletData) => {
    try {
      await AsyncStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(data));
      setWalletData(data);
      queryClient.invalidateQueries({ queryKey: ["walletData"] });
    } catch (error) {
      console.error("Error saving wallet data:", error);
      throw error;
    }
  };

  const addMoneyMutation = useMutation({
    mutationFn: async ({ amount, paymentMethodId }: { amount: number; paymentMethodId: string }) => {
      const newTransaction: WalletTransaction = {
        id: `txn-${Date.now()}`,
        type: 'add_money',
        amount,
        description: 'Added money to wallet',
        status: 'completed',
        date: new Date(),
        paymentMethodId,
      };

      const updatedData = {
        ...walletData,
        balance: walletData.balance + amount,
        transactions: [newTransaction, ...walletData.transactions],
      };

      await saveWalletData(updatedData);
      return updatedData;
    },
  });

  const withdrawMoneyMutation = useMutation({
    mutationFn: async ({ amount, bankAccountId }: { amount: number; bankAccountId: string }) => {
      if (amount > walletData.balance) {
        throw new Error("Insufficient balance");
      }

      const newTransaction: WalletTransaction = {
        id: `txn-${Date.now()}`,
        type: 'withdraw',
        amount: -amount,
        description: 'Withdrawn to bank account',
        status: 'pending',
        date: new Date(),
      };

      const updatedData = {
        ...walletData,
        balance: walletData.balance - amount,
        transactions: [newTransaction, ...walletData.transactions],
      };

      await saveWalletData(updatedData);
      return updatedData;
    },
  });

  const processRidePaymentMutation = useMutation({
    mutationFn: async ({ amount, rideId, metadata }: { amount: number; rideId: string; metadata?: WalletTransaction['metadata'] }) => {
      if (amount > walletData.balance) {
        throw new Error("Insufficient balance");
      }

      const newTransaction: WalletTransaction = {
        id: `txn-${Date.now()}`,
        type: 'ride_payment',
        amount: -amount,
        description: 'Ride payment',
        status: 'completed',
        date: new Date(),
        rideId,
        metadata,
      };

      const updatedData = {
        ...walletData,
        balance: walletData.balance - amount,
        transactions: [newTransaction, ...walletData.transactions],
      };

      await saveWalletData(updatedData);
      return updatedData;
    },
  });

  const addCashbackMutation = useMutation({
    mutationFn: async ({ amount, description }: { amount: number; description: string }) => {
      const newTransaction: WalletTransaction = {
        id: `txn-${Date.now()}`,
        type: 'cashback',
        amount,
        description,
        status: 'completed',
        date: new Date(),
      };

      const updatedData = {
        ...walletData,
        balance: walletData.balance + amount,
        transactions: [newTransaction, ...walletData.transactions],
      };

      await saveWalletData(updatedData);
      return updatedData;
    },
  });

  const addRefundMutation = useMutation({
    mutationFn: async ({ amount, description, rideId }: { amount: number; description: string; rideId?: string }) => {
      const newTransaction: WalletTransaction = {
        id: `txn-${Date.now()}`,
        type: 'refund',
        amount,
        description,
        status: 'completed',
        date: new Date(),
        rideId,
      };

      const updatedData = {
        ...walletData,
        balance: walletData.balance + amount,
        transactions: [newTransaction, ...walletData.transactions],
      };

      await saveWalletData(updatedData);
      return updatedData;
    },
  });

  const addBankAccountMutation = useMutation({
    mutationFn: async (bankAccount: Omit<BankAccount, 'id' | 'isVerified'>) => {
      const newBankAccount: BankAccount = {
        ...bankAccount,
        id: `bank-${Date.now()}`,
        isVerified: false,
      };

      const updatedBankAccounts = walletData.bankAccounts.length === 0 || bankAccount.isDefault
        ? [...walletData.bankAccounts.map(acc => ({ ...acc, isDefault: false })), newBankAccount]
        : [...walletData.bankAccounts, newBankAccount];

      const updatedData = {
        ...walletData,
        bankAccounts: updatedBankAccounts,
      };

      await saveWalletData(updatedData);
      return updatedData;
    },
  });

  const removeBankAccountMutation = useMutation({
    mutationFn: async (bankAccountId: string) => {
      const accountToRemove = walletData.bankAccounts.find(acc => acc.id === bankAccountId);
      const updatedBankAccounts = walletData.bankAccounts.filter(acc => acc.id !== bankAccountId);

      if (accountToRemove?.isDefault && updatedBankAccounts.length > 0) {
        updatedBankAccounts[0].isDefault = true;
      }

      const updatedData = {
        ...walletData,
        bankAccounts: updatedBankAccounts,
      };

      await saveWalletData(updatedData);
      return updatedData;
    },
  });

  const setDefaultBankAccountMutation = useMutation({
    mutationFn: async (bankAccountId: string) => {
      const updatedBankAccounts = walletData.bankAccounts.map(acc => ({
        ...acc,
        isDefault: acc.id === bankAccountId,
      }));

      const updatedData = {
        ...walletData,
        bankAccounts: updatedBankAccounts,
      };

      await saveWalletData(updatedData);
      return updatedData;
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
