import { PaymentMethod } from "@/types";

export const mockPaymentMethods: PaymentMethod[] = [
  {
    id: "card-1",
    type: "card",
    name: "Visa",
    lastFour: "4242",
    expiryDate: "12/25",
    isDefault: true,
    icon: "credit-card",
  },
  {
    id: "card-2",
    type: "card",
    name: "Mastercard",
    lastFour: "8888",
    expiryDate: "09/26",
    isDefault: false,
    icon: "credit-card",
  },
  {
    id: "cash-1",
    type: "cash",
    name: "Cash",
    isDefault: false,
    icon: "banknote",
  },
  {
    id: "wallet-1",
    type: "wallet",
    name: "Bolt Wallet",
    isDefault: false,
    icon: "wallet",
  },
];