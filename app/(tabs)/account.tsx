import { 
  ChevronRight, 
  CreditCard, 
  HelpCircle, 
  Star, 
  User, 
  Home,
  Briefcase,
  Plus,
  Globe,
  MessageSquare,
  Calendar,
  LogOut,

  Shield,
  Lock,
  Hand,
  Tag,
  Moon,
  Sun,
  Monitor,
  FileText,
  ShieldCheck,
  Camera,
  Wallet,
  Activity
} from "lucide-react-native";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "@/hooks/useAuthStore";
import { useTheme } from "@/hooks/useThemeStore";

interface MenuItemProps {
  icon: React.ReactElement;
  title: string;
  subtitle?: string;
  onPress: () => void;
  titleColor?: string;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, title, subtitle, onPress, titleColor }) => {
  const { colors } = useTheme();
  
  return (
    <Pressable
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 16,
          paddingHorizontal: 16,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        pressed && { backgroundColor: colors.lightGray }
      ]}
      onPress={onPress}
    >
      <View style={{ marginRight: 16, width: 24, alignItems: "center" }}>
        {/* eslint-disable-next-line @rork/linters/general-no-raw-text */}
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[{ fontSize: 16, color: colors.text }, titleColor && { color: titleColor }]}>{title}</Text>
        {subtitle && <Text style={{ fontSize: 14, color: colors.gray, marginTop: 2 }}>{subtitle}</Text>}
      </View>
      <ChevronRight size={20} color={colors.gray} />
    </Pressable>
  );
};

export default function AccountScreen() {
  const { user, logout } = useAuth();
  const { colors, themeMode, changeTheme } = useTheme();
  const [showDriverPromo, setShowDriverPromo] = useState(true);
  const insets = useSafeAreaInsets();
  
  const getThemeIcon = () => {
    switch (themeMode) {
      case 'light': return <Sun size={20} color={colors.text} />;
      case 'dark': return <Moon size={20} color={colors.text} />;
      case 'system': return <Monitor size={20} color={colors.text} />;
    }
  };
  
  const getThemeLabel = () => {
    switch (themeMode) {
      case 'light': return 'Light';
      case 'dark': return 'Dark';
      case 'system': return 'System';
    }
  };
  
  const handleThemeChange = () => {
    Alert.alert(
      'Choose Theme',
      'Select your preferred theme',
      [
        { text: 'Light', onPress: () => changeTheme('light') },
        { text: 'Dark', onPress: () => changeTheme('dark') },
        { text: 'System', onPress: () => changeTheme('system') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Account: Logging out user...');
              await logout();
              console.log('Account: User logged out successfully');
              router.replace('/role-selection');
            } catch (error) {
              console.error('Account: Logout error:', error);
              Alert.alert('Error', 'Failed to log out. Please try again.');
            }
          },
        },
      ]
    );
  };





  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        <View style={[styles.profileSection, { backgroundColor: colors.background, paddingTop: insets.top + 20 }]}>
          <Pressable 
            style={styles.profileAvatarContainer}
            onPress={() => router.push('/personal-info')}
          >
            {user?.profileImage ? (
              <Image 
                source={{ uri: user.profileImage }} 
                style={styles.profileAvatar}
              />
            ) : (
              <View style={[styles.profileAvatar, { backgroundColor: colors.lightGray }]}>
                <User size={24} color={colors.gray} />
              </View>
            )}
            <View style={[styles.cameraIconContainer, { backgroundColor: colors.primary }]}>
              <Camera size={14} color={colors.white} />
            </View>
          </Pressable>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.text }]}>{user?.name || 'User'}</Text>
            <Text style={[styles.profileSubtitle, { color: colors.primary }]}>My account</Text>
          </View>
        </View>

        <View style={styles.ratingSection}>
          <Star size={16} color={colors.primary} fill={colors.primary} />
          <Text style={[styles.ratingText, { color: colors.text }]}>{user?.rating?.toFixed(2) || '5.00'} Rating</Text>
        </View>

        <View style={styles.menuSection}>
          <MenuItem
            icon={<Wallet size={20} color={colors.text} />}
            title="My Wallet"
            subtitle="Manage your balance and transactions"
            onPress={() => router.push('/wallet' as any)}
          />
          <MenuItem
            icon={<CreditCard size={20} color={colors.text} />}
            title="Payment Methods"
            onPress={() => router.push('/payment-methods' as any)}
          />
          <MenuItem
            icon={<Tag size={20} color={colors.text} />}
            title="Promotions"
            subtitle="Enter promo code"
            onPress={() => router.push('/enter-promo-code' as any)}
          />
          <MenuItem
            icon={<Calendar size={20} color={colors.text} />}
            title="My Rides"
            onPress={() => router.push('/my-rides' as any)}
          />
          <MenuItem
            icon={<Shield size={20} color={colors.text} />}
            title="Safety"
            onPress={() => router.push('/safety')}
          />
          <MenuItem
            icon={<Briefcase size={20} color={colors.text} />}
            title="Expense Your Rides"
            onPress={() => router.push('/expense-rides')}
          />
          <MenuItem
            icon={<HelpCircle size={20} color={colors.text} />}
            title="Support"
            onPress={() => router.push('/support')}
          />
          <MenuItem
            icon={<HelpCircle size={20} color={colors.text} />}
            title="About"
            onPress={() => router.push('/about')}
          />
        </View>

        {showDriverPromo && (
          <View style={[styles.driverPromo, { backgroundColor: colors.primaryLight }]}>
            <View style={styles.driverPromoContent}>
              <Text style={[styles.driverPromoTitle, { color: colors.text }]}>Become a driver</Text>
              <Text style={[styles.driverPromoSubtitle, { color: colors.gray }]}>Earn money on your schedule</Text>
            </View>
            <Pressable
              style={styles.driverPromoClose}
              onPress={() => setShowDriverPromo(false)}
            >
              <Text style={[styles.driverPromoCloseText, { color: colors.gray }]}>×</Text>
            </Pressable>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: colors.text, backgroundColor: colors.background }]}>Personal info</Text>
        <View style={styles.profileDetailsSection}>
          <MenuItem
            icon={<User size={20} color={colors.text} />}
            title="Personal info"
            onPress={() => router.push('/personal-info')}
          />
          <MenuItem
            icon={<Home size={20} color={colors.text} />}
            title="Family profile"
            onPress={() => router.push('/family-profile')}
          />
          <MenuItem
            icon={<Shield size={20} color={colors.text} />}
            title="Safety"
            onPress={() => router.push('/safety')}
          />
          <MenuItem
            icon={<Lock size={20} color={colors.text} />}
            title="Login & security"
            onPress={() => router.push('/login-security')}
          />
          <MenuItem
            icon={<Hand size={20} color={colors.text} />}
            title="Privacy"
            onPress={() => router.push('/privacy')}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text, backgroundColor: colors.background }]}>Saved places</Text>
        <View style={styles.savedPlacesSection}>
          <MenuItem
            icon={<Home size={20} color={colors.text} />}
            title="Add home address"
            onPress={() => router.push({ pathname: '/add-location', params: { type: 'home' } } as any)}
          />
          <MenuItem
            icon={<Briefcase size={20} color={colors.text} />}
            title="Add work address"
            onPress={() => router.push({ pathname: '/add-location', params: { type: 'work' } } as any)}
          />
          <MenuItem
            icon={<Plus size={20} color={colors.text} />}
            title="Manage saved places"
            onPress={() => router.push('/saved-locations' as any)}
          />
        </View>

        <View style={styles.settingsSection}>
          <MenuItem
            icon={getThemeIcon()}
            title="Theme"
            subtitle={getThemeLabel()}
            onPress={handleThemeChange}
          />
          <MenuItem
            icon={<Globe size={20} color={colors.text} />}
            title="Language"
            subtitle="English-GB"
            onPress={() => router.push('/language')}
          />
          <MenuItem
            icon={<MessageSquare size={20} color={colors.text} />}
            title="Communication preferences"
            onPress={() => router.push('/communication-preferences')}
          />
          <MenuItem
            icon={<Calendar size={20} color={colors.text} />}
            title="Calendars"
            onPress={() => router.push('/calendars')}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text, backgroundColor: colors.background }]}>Developer</Text>
        <View style={styles.legalSection}>
          <MenuItem
            icon={<Activity size={20} color={colors.text} />}
            title="Firebase Diagnostics"
            subtitle="Check connection status"
            onPress={() => router.push('/firebase-diagnostics' as any)}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text, backgroundColor: colors.background }]}>Legal</Text>
        <View style={styles.legalSection}>
          <MenuItem
            icon={<FileText size={20} color={colors.text} />}
            title="Terms and Conditions"
            onPress={() => router.push('/terms-and-conditions' as any)}
          />
          <MenuItem
            icon={<ShieldCheck size={20} color={colors.text} />}
            title="Privacy Policy"
            onPress={() => router.push('/privacy-policy' as any)}
          />
        </View>

        <View style={styles.dangerSection}>
          <MenuItem
            icon={<LogOut size={20} color={colors.text} />}
            title="Log out"
            onPress={handleLogout}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  profileAvatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  profileAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "600",
  },
  profileSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  ratingSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  menuSection: {
    marginBottom: 20,
  },
  profileDetailsSection: {
    marginBottom: 20,
  },
  savedPlacesSection: {
    marginBottom: 20,
  },
  settingsSection: {
    marginBottom: 20,
  },
  dangerSection: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  driverPromo: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
  },
  driverPromoContent: {
    flex: 1,
  },
  driverPromoTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  driverPromoSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  driverPromoClose: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  driverPromoCloseText: {
    fontSize: 20,
  },
  legalSection: {
    marginBottom: 20,
  },
});