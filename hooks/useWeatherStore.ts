import createContextHook from "@nkzw/create-context-hook";
import { useState, useCallback, useMemo } from "react";
import { Location } from "@/types";

interface WeatherData {
  temperature: number;
  description: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  feelsLike: number;
  visibility: number;
  uvIndex?: number;
  cityName: string;
}

interface WeatherStore {
  currentWeather: WeatherData | null;
  destinationWeather: WeatherData | null;
  isLoading: boolean;
  error: string | null;
  fetchWeather: (location: Location, isDestination?: boolean) => Promise<void>;
  clearDestinationWeather: () => void;
}



// Mock weather data for demo purposes
const getMockWeatherData = (cityName: string): WeatherData => {
  const weatherConditions = [
    { temp: 28, desc: "Sunny", icon: "☀️", humidity: 45, wind: 12 },
    { temp: 24, desc: "Partly Cloudy", icon: "⛅", humidity: 60, wind: 8 },
    { temp: 22, desc: "Cloudy", icon: "☁️", humidity: 70, wind: 15 },
    { temp: 19, desc: "Light Rain", icon: "🌦️", humidity: 85, wind: 18 },
    { temp: 26, desc: "Clear", icon: "🌤️", humidity: 50, wind: 10 },
  ];
  
  const randomWeather = weatherConditions[Math.floor(Math.random() * weatherConditions.length)];
  
  return {
    temperature: randomWeather.temp,
    description: randomWeather.desc,
    icon: randomWeather.icon,
    humidity: randomWeather.humidity,
    windSpeed: randomWeather.wind,
    feelsLike: randomWeather.temp + Math.floor(Math.random() * 4) - 2,
    visibility: Math.floor(Math.random() * 5) + 8, // 8-12 km
    uvIndex: Math.floor(Math.random() * 8) + 1, // 1-8
    cityName,
  };
};

export const [WeatherProvider, useWeather] = createContextHook(() => {
  const [currentWeather, setCurrentWeather] = useState<WeatherData | null>(null);
  const [destinationWeather, setDestinationWeather] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWeatherFromAPI = useCallback(async (location: Location): Promise<WeatherData> => {
    try {
      // Mock data for demo
      const cityNames = ["Abuja", "Lagos", "Kano", "Port Harcourt", "Ibadan"];
      const randomCity = cityNames[Math.floor(Math.random() * cityNames.length)];
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return getMockWeatherData(randomCity);
    } catch (err) {
      console.error('Weather fetch error:', err);
      throw new Error('Failed to fetch weather data');
    }
  }, []);

  const fetchWeather = useCallback(async (location: Location, isDestination: boolean = false): Promise<void> => {
    if (!location) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const weatherData = await fetchWeatherFromAPI(location);
      
      if (isDestination) {
        setDestinationWeather(weatherData);
      } else {
        setCurrentWeather(weatherData);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Weather fetch error:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [fetchWeatherFromAPI]);

  const clearDestinationWeather = useCallback((): void => {
    setDestinationWeather(null);
  }, []);

  return useMemo(() => ({
    currentWeather,
    destinationWeather,
    isLoading,
    error,
    fetchWeather,
    clearDestinationWeather,
  }), [currentWeather, destinationWeather, isLoading, error, fetchWeather, clearDestinationWeather]);
});

