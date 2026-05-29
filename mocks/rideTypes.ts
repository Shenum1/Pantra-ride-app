import { RideType } from "@/types";

// Mock ride types
export const mockRideTypes: RideType[] = [
  {
    id: "standard",
    name: "Standard",
    description: "Affordable rides for everyday use",
    icon: "car",
    multiplier: 1.0,
    eta: 3,
  },
  {
    id: "comfort",
    name: "Comfort",
    description: "Newer cars with extra legroom",
    icon: "car",
    multiplier: 1.2,
    eta: 5,
  },
  {
    id: "premium",
    name: "Premium",
    description: "High-end cars with top-rated drivers",
    icon: "car",
    multiplier: 1.5,
    eta: 7,
  },
  {
    id: "xl",
    name: "XL",
    description: "Spacious vehicles for groups up to 6",
    icon: "car",
    multiplier: 1.8,
    eta: 8,
  },
];