import { useColorScheme } from 'react-native';
import { useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import Colors from '@/constants/colors';

type ThemeMode = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'app_theme_mode';

export const [ThemeProvider, useTheme] = createContextHook(() => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [isLoading, setIsLoading] = useState(true);

  // Determine the actual theme based on mode
  const actualTheme = themeMode === 'system' 
    ? (systemColorScheme || 'light')
    : themeMode;

  const colors = Colors[actualTheme];
  const isDark = actualTheme === 'dark';

  // Load saved theme preference
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
          setThemeMode(savedTheme as ThemeMode);
        }
      } catch (error) {
        console.log('Error loading theme:', error);
      }
    };

    // Set loading to false immediately to not block navigation
    setIsLoading(false);
    // Load theme in background
    loadTheme();
  }, []);

  // Save theme preference
  const changeTheme = useCallback(async (newTheme: ThemeMode) => {
    try {
      console.log('Changing theme to:', newTheme);
      setThemeMode(newTheme);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
      console.log('Theme saved successfully');
    } catch (error) {
      console.log('Error saving theme:', error);
    }
  }, []);

  return useMemo(() => ({
    themeMode,
    actualTheme,
    colors,
    isDark,
    isLoading,
    changeTheme,
  }), [themeMode, actualTheme, colors, isDark, isLoading, changeTheme]);
});