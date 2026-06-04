import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Switch,
  Alert,
} from 'react-native';
import {
  User,
  Star,
  Award,
  Settings,
  Bell,
  Shield,
  CreditCard,
  MapPin,
  Phone,
  Mail,
  Camera,
  Palette,
  Moon,
  Sun,
  LogOut,
  ChevronRight,
  Trophy,
  Target,
  Zap,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { router } from 'expo-router';
import { useDriverAuth } from '@/hooks/useDriverAuthStore';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  earned: boolean;
  progress?: number;
  total?: number;
  color: string;
}

interface Theme {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  background: string;
}

export default function DriverProfile() {
  const { logout, driver } = useDriverAuth();
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<boolean>(true);
  const [selectedTheme, setSelectedTheme] = useState<string>('default');

  const driverStats = {
    rating: driver?.rating ?? 5.0,
    totalTrips: driver?.totalRides ?? 0,
    totalEarnings: driver?.totalEarnings ?? 0,
    yearsActive: 0,
  };

  const achievements: Achievement[] = [
    {
      id: '1',
      title: 'First Ride',
      description: 'Complete your first ride',
      icon: <Star size={20} color="#FFD700" />,
      earned: true,
      color: '#FFD700',
    },
    {
      id: '2',
      title: 'Century Club',
      description: 'Complete 100 rides',
      icon: <Trophy size={20} color="#FF9800" />,
      earned: true,
      color: '#FF9800',
    },
    {
      id: '3',
      title: 'Speed Demon',
      description: 'Complete 10 rides in one day',
      icon: <Zap size={20} color="#2196F3" />,
      earned: true,
      color: '#2196F3',
    },
    {
      id: '4',
      title: 'Perfect Rating',
      description: 'Maintain 5.0 rating for 50 rides',
      icon: <Award size={20} color="#4CAF50" />,
      earned: false,
      progress: 32,
      total: 50,
      color: '#4CAF50',
    },
    {
      id: '5',
      title: 'Night Owl',
      description: 'Complete 25 rides after midnight',
      icon: <Moon size={20} color="#9C27B0" />,
      earned: false,
      progress: 18,
      total: 25,
      color: '#9C27B0',
    },
    {
      id: '6',
      title: 'Thousand Club',
      description: 'Complete 1000 rides',
      icon: <Target size={20} color="#FF5722" />,
      earned: true,
      color: '#FF5722',
    },
  ];

  const themes: Theme[] = [
    {
      id: 'default',
      name: 'Ocean Blue',
      primary: '#0066FF',
      secondary: '#E6F0FF',
      background: '#FFFFFF',
    },
    {
      id: 'forest',
      name: 'Forest Green',
      primary: '#4CAF50',
      secondary: '#E8F5E8',
      background: '#FFFFFF',
    },
    {
      id: 'sunset',
      name: 'Sunset Orange',
      primary: '#FF9800',
      secondary: '#FFF3E0',
      background: '#FFFFFF',
    },
    {
      id: 'royal',
      name: 'Royal Purple',
      primary: '#9C27B0',
      secondary: '#F3E5F5',
      background: '#FFFFFF',
    },
  ];

  const ProfileStat = ({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) => (
    <View style={styles.statItem}>
      <View style={styles.statIcon}>
        {icon}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const AchievementBadge = ({ achievement }: { achievement: Achievement }) => (
    <View style={[
      styles.achievementBadge,
      !achievement.earned && styles.lockedBadge
    ]}>
      <View style={[
        styles.badgeIcon,
        { backgroundColor: achievement.earned ? achievement.color : Colors.light.lightGray }
      ]}>
        {achievement.icon}
      </View>
      <Text style={[
        styles.badgeTitle,
        !achievement.earned && styles.lockedText
      ]} numberOfLines={2}>
        {achievement.title}
      </Text>
      {!achievement.earned && achievement.progress && achievement.total && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${(achievement.progress / achievement.total) * 100}%`,
                  backgroundColor: achievement.color 
                }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {achievement.progress}/{achievement.total}
          </Text>
        </View>
      )}
    </View>
  );

  const ThemeOption = ({ theme }: { theme: Theme }) => (
    <TouchableOpacity 
      style={[
        styles.themeOption,
        selectedTheme === theme.id && styles.selectedTheme
      ]}
      onPress={() => setSelectedTheme(theme.id)}
    >
      <View style={styles.themePreview}>
        <View style={[styles.themeColor, { backgroundColor: theme.primary }]} />
        <View style={[styles.themeColor, { backgroundColor: theme.secondary }]} />
        <View style={[styles.themeColor, { backgroundColor: theme.background }]} />
      </View>
      <Text style={styles.themeName}>{theme.name}</Text>
      {selectedTheme === theme.id && (
        <View style={styles.selectedIndicator}>
          <Text style={styles.selectedText}>✓</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const SettingsItem = ({ 
    icon, 
    title, 
    subtitle, 
    onPress, 
    rightElement 
  }: { 
    icon: React.ReactNode; 
    title: string; 
    subtitle?: string; 
    onPress?: () => void; 
    rightElement?: React.ReactNode; 
  }) => (
    <TouchableOpacity style={styles.settingsItem} onPress={onPress}>
      <View style={styles.settingsIcon}>
        {icon}
      </View>
      <View style={styles.settingsContent}>
        <Text style={styles.settingsTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingsSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement || <ChevronRight size={20} color={Colors.light.textSecondary} />}
    </TouchableOpacity>
  );

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Driver Profile: Logging out driver...');
              await logout();
              console.log('Driver Profile: Driver logged out successfully');
              // Navigate to role selection page
              router.replace('/role-selection');
            } catch (error) {
              console.error('Driver Profile: Driver logout error:', error);
              Alert.alert('Error', 'Failed to log out. Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <User size={40} color={Colors.light.white} />
            </View>
            <TouchableOpacity style={styles.cameraButton}>
              <Camera size={16} color={Colors.light.white} />
            </TouchableOpacity>
          </View>
          <Text style={styles.driverName}>{driver?.name ?? 'Driver'}</Text>
          <Text style={styles.driverInfo}>{driver?.vehicle ? `${driver.vehicle.make} ${driver.vehicle.model}` : 'Vehicle not set'}</Text>
          <View style={styles.ratingContainer}>
            <Star size={16} color="#FFD700" fill="#FFD700" />
            <Text style={styles.rating}>{driverStats.rating}</Text>
            <Text style={styles.ratingCount}>({driverStats.totalTrips} trips)</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Your Stats</Text>
          <View style={styles.statsGrid}>
            <ProfileStat
              label="Total Trips"
              value={driverStats.totalTrips.toLocaleString()}
              icon={<MapPin size={20} color={Colors.light.primary} />}
            />
            <ProfileStat
              label="Total Earned"
              value={`$${driverStats.totalEarnings.toLocaleString()}`}
              icon={<CreditCard size={20} color={Colors.light.success} />}
            />
            <ProfileStat
              label="Rating"
              value={driverStats.rating.toString()}
              icon={<Star size={20} color="#FFD700" />}
            />
            <ProfileStat
              label="Years Active"
              value={driverStats.yearsActive.toString()}
              icon={<Award size={20} color={Colors.light.primary} />}
            />
          </View>
        </View>

        {/* Achievements */}
        <View style={styles.achievementsSection}>
          <Text style={styles.sectionTitle}>Achievements</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.achievementsContainer}
          >
            {achievements.map((achievement) => (
              <AchievementBadge key={achievement.id} achievement={achievement} />
            ))}
          </ScrollView>
        </View>

        {/* Theme Selection */}
        <View style={styles.themesSection}>
          <Text style={styles.sectionTitle}>Choose Theme</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.themesContainer}
          >
            {themes.map((theme) => (
              <ThemeOption key={theme.id} theme={theme} />
            ))}
          </ScrollView>
        </View>

        {/* Settings */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          <SettingsItem
            icon={<Bell size={20} color={Colors.light.primary} />}
            title="Notifications"
            subtitle="Ride requests, messages, and updates"
            rightElement={
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ false: Colors.light.lightGray, true: Colors.light.primaryLight }}
                thumbColor={notifications ? Colors.light.primary : Colors.light.gray}
              />
            }
          />
          
          <SettingsItem
            icon={darkMode ? <Moon size={20} color={Colors.light.primary} /> : <Sun size={20} color={Colors.light.primary} />}
            title="Dark Mode"
            subtitle="Switch between light and dark themes"
            rightElement={
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                trackColor={{ false: Colors.light.lightGray, true: Colors.light.primaryLight }}
                thumbColor={darkMode ? Colors.light.primary : Colors.light.gray}
              />
            }
          />
          
          <SettingsItem
            icon={<Palette size={20} color={Colors.light.primary} />}
            title="Appearance"
            subtitle="Customize your app experience"
            onPress={() => {}}
          />
          
          <SettingsItem
            icon={<Shield size={20} color={Colors.light.primary} />}
            title="Privacy & Security"
            subtitle="Manage your privacy settings"
            onPress={() => {}}
          />
          
          <SettingsItem
            icon={<Phone size={20} color={Colors.light.primary} />}
            title="Contact Info"
            subtitle="Update your phone and email"
            onPress={() => {}}
          />
          
          <SettingsItem
            icon={<Mail size={20} color={Colors.light.primary} />}
            title="Support"
            subtitle="Get help and report issues"
            onPress={() => {}}
          />
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color={Colors.light.danger} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: Colors.light.white,
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.success,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.light.white,
  },
  driverName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 4,
  },
  driverInfo: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginLeft: 4,
    marginRight: 4,
  },
  ratingCount: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  statsSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginHorizontal: 20,
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    backgroundColor: Colors.light.white,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  achievementsSection: {
    marginBottom: 30,
  },
  achievementsContainer: {
    paddingHorizontal: 20,
  },
  achievementBadge: {
    width: 100,
    alignItems: 'center',
    marginRight: 16,
    padding: 12,
    backgroundColor: Colors.light.white,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  lockedBadge: {
    opacity: 0.6,
  },
  badgeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  lockedText: {
    color: Colors.light.textSecondary,
  },
  progressContainer: {
    width: '100%',
    marginTop: 4,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.light.lightGray,
    borderRadius: 2,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  themesSection: {
    marginBottom: 30,
  },
  themesContainer: {
    paddingHorizontal: 20,
  },
  themeOption: {
    alignItems: 'center',
    marginRight: 16,
    padding: 12,
    backgroundColor: Colors.light.white,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  selectedTheme: {
    borderColor: Colors.light.primary,
  },
  themePreview: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  themeColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  themeName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  selectedIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedText: {
    fontSize: 12,
    color: Colors.light.white,
    fontWeight: 'bold',
  },
  settingsSection: {
    marginBottom: 30,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.light.white,
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  settingsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingsContent: {
    flex: 1,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  settingsSubtitle: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.light.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.danger,
    marginBottom: 20,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.danger,
    marginLeft: 8,
  },
});