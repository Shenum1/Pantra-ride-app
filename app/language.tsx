import { Check, Globe } from "lucide-react-native";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useThemeStore";
import { Stack } from "expo-router";

interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
}

interface LanguageItemProps {
  language: LanguageOption;
  isSelected: boolean;
  onSelect: () => void;
}

const LanguageItem: React.FC<LanguageItemProps> = ({ language, isSelected, onSelect }) => {
  const { colors } = useTheme();
  
  return (
    <Pressable 
      style={[
        styles.languageItem, 
        { 
          backgroundColor: colors.card, 
          borderColor: isSelected ? colors.primary : colors.border 
        }
      ]}
      onPress={onSelect}
    >
      <View style={styles.languageInfo}>
        <Text style={[styles.languageName, { color: colors.text }]}>{language.name}</Text>
        <Text style={[styles.languageNative, { color: colors.gray }]}>{language.nativeName}</Text>
      </View>
      {isSelected && (
        <Check size={20} color={colors.primary} />
      )}
    </Pressable>
  );
};

export default function LanguageScreen() {
  const { colors } = useTheme();
  
  const [selectedLanguage, setSelectedLanguage] = useState('en-GB');
  
  const languages: LanguageOption[] = [
    { code: 'en-US', name: 'English (US)', nativeName: 'English (United States)' },
    { code: 'en-GB', name: 'English (UK)', nativeName: 'English (United Kingdom)' },
    { code: 'es', name: 'Spanish', nativeName: 'Español' },
    { code: 'fr', name: 'French', nativeName: 'Français' },
    { code: 'de', name: 'German', nativeName: 'Deutsch' },
    { code: 'it', name: 'Italian', nativeName: 'Italiano' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский' },
    { code: 'zh', name: 'Chinese', nativeName: '中文' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語' },
    { code: 'ko', name: 'Korean', nativeName: '한국어' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  ];
  
  const handleLanguageSelect = (languageCode: string) => {
    setSelectedLanguage(languageCode);
    const selectedLang = languages.find(lang => lang.code === languageCode);
    Alert.alert(
      'Language Changed',
      `Language has been changed to ${selectedLang?.name}. The app will restart to apply changes.`,
      [{ text: 'OK' }]
    );
  };
  
  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Language',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
        }} 
      />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["bottom"]}>
        <ScrollView style={styles.content}>
          <View style={styles.headerSection}>
            <Globe size={32} color={colors.primary} />
            <Text style={[styles.title, { color: colors.text }]}>Choose Language</Text>
            <Text style={[styles.subtitle, { color: colors.gray }]}>
              Select your preferred language for the app interface
            </Text>
          </View>
          
          <View style={styles.languagesContainer}>
            {languages.map((language) => (
              <LanguageItem
                key={language.code}
                language={language}
                isSelected={selectedLanguage === language.code}
                onSelect={() => handleLanguageSelect(language.code)}
              />
            ))}
          </View>
          
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>Language Support</Text>
            <Text style={[styles.infoText, { color: colors.gray }]}>
              • Interface language affects menus, buttons, and messages{'\n'}
              • Driver and rider communication may still be in local language{'\n'}
              • Some features may have limited translation{'\n'}
              • Restart required to fully apply language changes
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  languagesContainer: {
    marginBottom: 24,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 8,
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  languageNative: {
    fontSize: 14,
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
});