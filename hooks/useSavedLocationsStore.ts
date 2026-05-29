import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { mockSavedLocations } from "@/mocks/savedLocations";
import { Location, SavedLocation } from "@/types";

const SAVED_LOCATIONS_STORAGE_KEY = "saved_locations";

export const [SavedLocationsProvider, useSavedLocations] = createContextHook(() => {
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);

  // Fetch saved locations
  const { data: fetchedLocations, isLoading } = useQuery({
    queryKey: ["savedLocations"],
    queryFn: async () => {
      try {
        const storedLocations = await AsyncStorage.getItem(SAVED_LOCATIONS_STORAGE_KEY);
        if (storedLocations) {
          return JSON.parse(storedLocations) as SavedLocation[];
        }
        // If no stored locations, use mock data
        await AsyncStorage.setItem(SAVED_LOCATIONS_STORAGE_KEY, JSON.stringify(mockSavedLocations));
        return mockSavedLocations;
      } catch (error) {
        console.error("Error fetching saved locations:", error);
        return mockSavedLocations;
      }
    },
  });

  useEffect(() => {
    if (fetchedLocations) {
      setSavedLocations(fetchedLocations);
    }
  }, [fetchedLocations]);

  const addSavedLocation = async (
    location: Location,
    address: string,
    name: string,
    type: SavedLocation["type"],
    icon?: string
  ) => {
    try {
      // Check if we already have a location of this type (for home/work)
      if (type === "home" || type === "work") {
        const existingIndex = savedLocations.findIndex(loc => loc.type === type);
        if (existingIndex >= 0) {
          // Update existing home/work location
          const updatedLocations = [...savedLocations];
          updatedLocations[existingIndex] = {
            ...updatedLocations[existingIndex],
            ...location,
            address,
            name,
            icon: icon || updatedLocations[existingIndex].icon,
          };
          setSavedLocations(updatedLocations);
          await AsyncStorage.setItem(SAVED_LOCATIONS_STORAGE_KEY, JSON.stringify(updatedLocations));
          return;
        }
      }

      // Add new location
      const newLocation: SavedLocation = {
        id: `location-${Date.now()}`,
        ...location,
        address,
        name,
        type,
        icon: icon || (type === "home" ? "home" : type === "work" ? "briefcase" : "star"),
      };

      const updatedLocations = [...savedLocations, newLocation];
      setSavedLocations(updatedLocations);
      await AsyncStorage.setItem(SAVED_LOCATIONS_STORAGE_KEY, JSON.stringify(updatedLocations));
    } catch (error) {
      console.error("Error adding saved location:", error);
      throw error;
    }
  };

  const removeSavedLocation = async (id: string) => {
    try {
      const updatedLocations = savedLocations.filter(location => location.id !== id);
      setSavedLocations(updatedLocations);
      await AsyncStorage.setItem(SAVED_LOCATIONS_STORAGE_KEY, JSON.stringify(updatedLocations));
    } catch (error) {
      console.error("Error removing saved location:", error);
      throw error;
    }
  };

  const updateSavedLocation = async (id: string, updates: Partial<SavedLocation>) => {
    try {
      const updatedLocations = savedLocations.map(location =>
        location.id === id ? { ...location, ...updates } : location
      );
      setSavedLocations(updatedLocations);
      await AsyncStorage.setItem(SAVED_LOCATIONS_STORAGE_KEY, JSON.stringify(updatedLocations));
    } catch (error) {
      console.error("Error updating saved location:", error);
      throw error;
    }
  };

  const getLocationByType = (type: SavedLocation["type"]): SavedLocation | undefined => {
    return savedLocations.find(location => location.type === type);
  };

  const getFavorites = (): SavedLocation[] => {
    return savedLocations.filter(location => location.type === "favorite");
  };

  return {
    savedLocations,
    isLoading,
    addSavedLocation,
    removeSavedLocation,
    updateSavedLocation,
    getLocationByType,
    getFavorites,
  };
});