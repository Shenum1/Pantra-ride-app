import createContextHook from "@nkzw/create-context-hook";
import { useState, useCallback, useMemo } from "react";
import { Location } from "@/types";
import { GoogleMapsService } from "@/lib/google-maps-service";

interface WeatherData {
  temperature: number;
  description: string;
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



const WEATHER_CODE_DESCRIPTIONS: Record<number, string> = {
  0: "Clear",
  1: "Mainly Clear",
  2: "Partly Cloudy",
  3: "Cloudy",
  45: "Foggy",
  48: "Foggy",
  51: "Light Drizzle",
  53: "Drizzle",
  55: "Heavy Drizzle",
  56: "Freezing Drizzle",
  57: "Freezing Drizzle",
  61: "Light Rain",
  63: "Rain",
  65: "Heavy Rain",
  66: "Freezing Rain",
  67: "Freezing Rain",
  71: "Light Snow",
  73: "Snow",
  75: "Heavy Snow",
  77: "Snow Grains",
  80: "Rain Showers",
  81: "Rain Showers",
  82: "Heavy Rain Showers",
  85: "Snow Showers",
  86: "Snow Showers",
  95: "Thunderstorm",
  96: "Thunderstorm",
  99: "Thunderstorm",
};

export const [WeatherProvider, useWeather] = createContextHook(() => {
  const [currentWeather, setCurrentWeather] = useState<WeatherData | null>(null);
  const [destinationWeather, setDestinationWeather] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWeatherFromAPI = useCallback(async (location: Location): Promise<WeatherData> => {
    const { latitude, longitude } = location;

    const [weatherResponse, cityName] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code,visibility&timezone=auto`),
      GoogleMapsService.getCityName(location),
    ]);

    if (!weatherResponse.ok) {
      throw new Error('Failed to fetch weather data');
    }

    const data = await weatherResponse.json();
    const current = data?.current;
    if (!current) {
      throw new Error('Failed to fetch weather data');
    }

    return {
      temperature: Math.round(current.temperature_2m),
      description: WEATHER_CODE_DESCRIPTIONS[current.weather_code] ?? "Clear",
      humidity: Math.round(current.relative_humidity_2m),
      windSpeed: Math.round(current.wind_speed_10m),
      feelsLike: Math.round(current.apparent_temperature),
      visibility: typeof current.visibility === 'number' ? Math.round(current.visibility / 1000) : 10,
      cityName,
    };
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

