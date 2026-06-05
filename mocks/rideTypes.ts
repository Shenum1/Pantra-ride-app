import { RideType } from "@/types";

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
    multiplier: 1.0,
    eta: 5,
  },
  {
    id: "xl",
    name: "XL",
    description: "Spacious vehicles for groups up to 6",
    icon: "car",
    multiplier: 1.0,
    eta: 8,
  },
];
