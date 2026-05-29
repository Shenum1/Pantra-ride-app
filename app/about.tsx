import { Info, Users, Award, Globe, Heart, Shield } from "lucide-react-native";
import React from "react";
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

interface InfoSectionProps {
  icon: React.ReactElement;
  title: string;
  description: string;
  onPress?: () => void;
}

const InfoSection: React.FC<InfoSectionProps> = ({ icon, title, description, onPress }) => {
  const { colors } = useTheme();
  
  return (
    <Pressable 
      style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
    >
      <View style={styles.sectionIcon}>
        <Text>{icon}</Text>
      </View>
      <View style={styles.sectionContent}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.sectionDescription, { color: colors.gray }]}>{description}</Text>
      </View>
    </Pressable>
  );
};

export default function AboutScreen() {
  const { colors } = useTheme();
  
  const handleTermsOfService = () => {
    Alert.alert('Terms of Service', 'View our terms of service and user agreement.');
  };
  
  const handlePrivacyPolicy = () => {
    Alert.alert('Privacy Policy', 'Read our privacy policy and data handling practices.');
  };
  
  const handleCommunityGuidelines = () => {
    Alert.alert('Community Guidelines', 'Learn about our community standards and guidelines.');
  };
  
  const handleOpenSource = () => {
    Alert.alert('Open Source', 'View open source licenses and attributions.');
  };
  
  return (
    <>
      <Stack.Screen 
        options={{
          title: 'About',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
        }} 
      />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["bottom"]}>
        <ScrollView style={styles.content}>
          <View style={styles.headerSection}>
            <View style={[styles.appIcon, { backgroundColor: colors.primary }]}>
              <Text style={[styles.appIconText, { color: colors.white }]}>R</Text>
            </View>
            <Text style={[styles.appName, { color: colors.text }]}>RideApp</Text>
            <Text style={[styles.appVersion, { color: colors.gray }]}>Version 2.1.0</Text>
            <Text style={[styles.appDescription, { color: colors.gray }]}>
              Your reliable ride-sharing companion
            </Text>
          </View>
          
          <View style={styles.infoContainer}>
            <InfoSection
              icon={<Heart size={24} color={colors.primary} />}
              title="Our Mission"
              description="Connecting people and communities through safe, reliable transportation"
            />
            
            <InfoSection
              icon={<Users size={24} color={colors.primary} />}
              title="Our Team"
              description="A passionate team dedicated to improving urban mobility"
            />
            
            <InfoSection
              icon={<Globe size={24} color={colors.primary} />}
              title="Global Impact"
              description="Serving millions of riders across 100+ cities worldwide"
            />
            
            <InfoSection
              icon={<Award size={24} color={colors.primary} />}
              title="Awards & Recognition"
              description="Recognized for innovation in transportation technology"
            />
          </View>
          
          <View style={styles.legalContainer}>
            <Text style={[styles.sectionHeader, { color: colors.text }]}>Legal & Policies</Text>
            
            <InfoSection
              icon={<Shield size={20} color={colors.text} />}
              title="Terms of Service"
              description="User agreement and terms of use"
              onPress={handleTermsOfService}
            />
            
            <InfoSection
              icon={<Shield size={20} color={colors.text} />}
              title="Privacy Policy"
              description="How we protect and use your data"
              onPress={handlePrivacyPolicy}
            />
            
            <InfoSection
              icon={<Users size={20} color={colors.text} />}
              title="Community Guidelines"
              description="Standards for respectful community interaction"
              onPress={handleCommunityGuidelines}
            />
            
            <InfoSection
              icon={<Info size={20} color={colors.text} />}
              title="Open Source Licenses"
              description="Third-party libraries and attributions"
              onPress={handleOpenSource}
            />
          </View>
          
          <View style={[styles.footerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.footerTitle, { color: colors.text }]}>Stay Connected</Text>
            <Text style={[styles.footerText, { color: colors.gray }]}>
              Follow us on social media for updates, tips, and community stories.
            </Text>
            <View style={styles.socialLinks}>
              <Pressable style={[styles.socialButton, { backgroundColor: colors.primary }]}>
                <Text style={[styles.socialButtonText, { color: colors.white }]}>Twitter</Text>
              </Pressable>
              <Pressable style={[styles.socialButton, { backgroundColor: colors.primary }]}>
                <Text style={[styles.socialButtonText, { color: colors.white }]}>Facebook</Text>
              </Pressable>
              <Pressable style={[styles.socialButton, { backgroundColor: colors.primary }]}>
                <Text style={[styles.socialButtonText, { color: colors.white }]}>Instagram</Text>
              </Pressable>
            </View>
          </View>
          
          <View style={styles.copyrightSection}>
            <Text style={[styles.copyrightText, { color: colors.gray }]}>
              © 2024 RideApp Inc. All rights reserved.
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
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appIconText: {
    fontSize: 32,
    fontWeight: '700',
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 16,
    marginBottom: 8,
  },
  appDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  infoContainer: {
    marginBottom: 32,
  },
  legalContainer: {
    marginBottom: 32,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  sectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  sectionIcon: {
    marginRight: 16,
  },
  sectionContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 18,
  },
  footerCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
    alignItems: 'center',
  },
  footerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  footerText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  socialLinks: {
    flexDirection: 'row',
    gap: 12,
  },
  socialButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  copyrightSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  copyrightText: {
    fontSize: 12,
    textAlign: 'center',
  },
});