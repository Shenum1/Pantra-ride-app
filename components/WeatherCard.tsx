import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  Cloud,
  Sun,
  CloudRain,
  Eye,
  Wind,
  Droplets,
  Thermometer,
} from 'lucide-react-native';
import { useTheme } from '@/hooks/useThemeStore';
import { useWeather } from '@/hooks/useWeatherStore';

interface WeatherCardProps {
  title: string;
  isDestination?: boolean;
  compact?: boolean;
  onPress?: () => void;
}

export default function WeatherCard({ 
  title, 
  isDestination = false, 
  compact = false,
  onPress 
}: WeatherCardProps) {
  const { colors } = useTheme();
  const { currentWeather, destinationWeather, isLoading, error } = useWeather();
  
  const weather = isDestination ? destinationWeather : currentWeather;

  const getWeatherIcon = (description: string) => {
    const desc = description.toLowerCase();
    if (desc.includes('sun') || desc.includes('clear')) {
      return <Sun size={compact ? 20 : 24} color={colors.warning} />;
    } else if (desc.includes('rain') || desc.includes('shower')) {
      return <CloudRain size={compact ? 20 : 24} color={colors.primary} />;
    } else if (desc.includes('cloud')) {
      return <Cloud size={compact ? 20 : 24} color={colors.textSecondary} />;
    }
    return <Sun size={compact ? 20 : 24} color={colors.warning} />;
  };

  if (isLoading) {
    return (
      <TouchableOpacity 
        style={[styles.card, { backgroundColor: colors.card }, compact && styles.compactCard]} 
        onPress={onPress}
        disabled={!onPress}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading weather...
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (error || !weather) {
    return (
      <TouchableOpacity 
        style={[styles.card, { backgroundColor: colors.card }, compact && styles.compactCard]} 
        onPress={onPress}
        disabled={!onPress}
      >
        <View style={styles.errorContainer}>
          <Cloud size={20} color={colors.textSecondary} />
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            Weather unavailable
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (compact) {
    return (
      <TouchableOpacity 
        style={[styles.card, styles.compactCard, { backgroundColor: colors.card }]} 
        onPress={onPress}
        disabled={!onPress}
      >
        <View style={styles.compactContent}>
          <View style={styles.compactHeader}>
            <Text style={[styles.compactTitle, { color: colors.textSecondary }]}>{title}</Text>
            {getWeatherIcon(weather.description)}
          </View>
          <View style={styles.compactDetails}>
            <Text style={[styles.compactTemperature, { color: colors.text }]}>
              {weather.temperature}°C
            </Text>
            <Text style={[styles.compactDescription, { color: colors.textSecondary }]}>
              {weather.description}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity 
      style={[styles.card, { backgroundColor: colors.card }]} 
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.cityName, { color: colors.textSecondary }]}>
            {weather.cityName}
          </Text>
        </View>
        <View style={styles.mainWeather}>
          {getWeatherIcon(weather.description)}
          <Text style={[styles.temperature, { color: colors.text }]}>
            {weather.temperature}°C
          </Text>
        </View>
      </View>
      
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        {weather.description}
      </Text>
      
      <View style={styles.details}>
        <View style={styles.detailItem}>
          <Thermometer size={16} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
            Feels like {weather.feelsLike}°C
          </Text>
        </View>
        
        <View style={styles.detailItem}>
          <Droplets size={16} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
            {weather.humidity}% humidity
          </Text>
        </View>
        
        <View style={styles.detailItem}>
          <Wind size={16} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
            {weather.windSpeed} km/h
          </Text>
        </View>
        
        <View style={styles.detailItem}>
          <Eye size={16} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
            {weather.visibility} km visibility
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    marginVertical: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  compactCard: {
    padding: 8,
    marginVertical: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  cityName: {
    fontSize: 14,
    fontWeight: '400',
  },
  mainWeather: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  temperature: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 14,
    marginBottom: 12,
    textTransform: 'capitalize',
  },
  details: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: '45%',
  },
  detailText: {
    fontSize: 12,
  },
  compactContent: {
    gap: 4,
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactTitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  compactDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactDescription: {
    fontSize: 11,
    textTransform: 'capitalize',
  },
  compactTemperature: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 14,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  errorText: {
    fontSize: 14,
  },
});