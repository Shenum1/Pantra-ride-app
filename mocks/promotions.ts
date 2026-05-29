import { Promotion } from "@/types";

export const mockPromotions: Promotion[] = [
  {
    id: "promo-1",
    code: "WELCOME50",
    description: "50% off your first ride (up to ₦1000)",
    discountPercentage: 50,
    validUntil: new Date(2025, 11, 31),
    isUsed: false,
  },
  {
    id: "promo-2",
    code: "WEEKEND25",
    description: "25% off weekend rides (up to ₦500)",
    discountPercentage: 25,
    validUntil: new Date(2025, 8, 30),
    isUsed: false,
  },
  {
    id: "promo-3",
    code: "BOLT15",
    description: "15% off any ride (up to ₦300)",
    discountPercentage: 15,
    validUntil: new Date(2025, 9, 15),
    isUsed: false,
  },
];