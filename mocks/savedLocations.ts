import { SavedLocation } from "@/types";

export const mockSavedLocations: SavedLocation[] = [
  {
    id: "home",
    name: "Home",
    address: "123 Main Street, Lagos",
    type: "home",
    latitude: 6.5244,
    longitude: 3.3792,
    icon: "home",
  },
  {
    id: "work",
    name: "Work",
    address: "456 Business Avenue, Lagos",
    type: "work",
    latitude: 6.5355,
    longitude: 3.3087,
    icon: "briefcase",
  },
  {
    id: "favorite-1",
    name: "Gym",
    address: "789 Fitness Road, Lagos",
    type: "favorite",
    latitude: 6.5143,
    longitude: 3.3191,
    icon: "dumbbell",
  },
  {
    id: "favorite-2",
    name: "Shopping Mall",
    address: "101 Retail Plaza, Lagos",
    type: "favorite",
    latitude: 6.4698,
    longitude: 3.5852,
    icon: "shopping-bag",
  },
];