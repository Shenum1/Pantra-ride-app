import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Switch,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import {
  User,
  Star,
  Award,
  Bell,
  Shield,
  CreditCard,
  MapPin,
  Phone,
  Mail,
  Camera,
  Moon,
  Sun,
  LogOut,
  ChevronRight,
  FileCheck,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useDriverAuth } from '@/hooks/useDriverAuthStore';
import { useTheme } from '@/hooks/useThemeStore';
import { NotificationService } from '@/lib/notification-service';

export default function DriverProfile() {
  const { logout, driver, updateProfileImage } = useDriverAuth();
  const { colors, isDark, changeTheme } = useTheme();
  const [notifications, setNotifications] = useState<boolean>(true);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    NotificationService.getDriverNotificationsEnabled().then((enabled) => {
      if (active) setNotifications(enabled);
    });
    return () => {
      active = false;
    };
  }, []);

  const totalTrips = driver?.totalRides ?? 0;
  const driverStats = {
    rating: driver?.rating ?? null,
    totalTrips,
    totalEarnings: driver?.totalEarnings ?? 0,
    yearsActive: driver?.createdAt
      ? Math.floor((Date.now() - new Date(driver.createdAt).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : 0,
  };

  const ProfileStat = ({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) => (
    <View style={[styles.statItem, { backgroundColor: colors.card }]}>
      <View style={[styles.statIcon, { backgroundColor: colors.primaryLight }]}>
        {icon}
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
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
    <TouchableOpacity style={[styles.settingsItem, { backgroundColor: colors.card }]} onPress={onPress}>
      <View style={[styles.settingsIcon, { backgroundColor: colors.primaryLight }]}>
        {icon}
      </View>
      <View style={styles.settingsContent}>
        <Text style={[styles.settingsTitle, { color: colors.text }]}>{title}</Text>
        {subtitle && <Text style={[styles.settingsSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
      </View>
      {rightElement || <ChevronRight size={20} color={colors.textSecondary} />}
    </TouchableOpacity>
  );

  const handleToggleNotifications = useCallback(async (value: boolean) => {
    if (value) {
      const granted = await NotificationService.requestPermissions();
      if (!granted) {
        Alert.alert(
          'Permission Required',
          'Enable notifications for this app in your device settings to receive ride request alerts.'
        );
        await NotificationService.setDriverNotificationsEnabled(false);
        setNotifications(false);
        return;
      }
    }
    setNotifications(value);
    await NotificationService.setDriverNotificationsEnabled(value);
  }, []);

  const pickAndUploadAvatar = useCallback(async (source: 'camera' | 'library') => {
    try {
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission Required',
          `Please allow access to your ${source === 'camera' ? 'camera' : 'photo library'} to update your profile photo.`
        );
        return;
      }

      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });

      if (result.canceled || !result.assets[0]) return;

      setIsUploadingAvatar(true);
      await updateProfileImage(result.assets[0].uri);
    } catch (error) {
      console.error('Driver Profile: avatar upload error:', error);
      Alert.alert('Error', 'Failed to update profile photo. Please try again.');
    } finally {
      setIsUploadingAvatar(false);
    }
  }, [updateProfileImage]);

  const handleChangeAvatar = useCallback(() => {
    Alert.alert(
      'Change Profile Photo',
      'Choose an option',
      [
        { text: 'Take Photo', onPress: () => void pickAndUploadAvatar('camera') },
        { text: 'Choose from Library', onPress: () => void pickAndUploadAvatar('library') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, [pickAndUploadAvatar]);

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
              await logout();
            } catch (error) {
              console.error('Driver Profile: Driver logout error:', error);
            }
            router.replace('/role-selection');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Header */}
        <View style={[styles.profileHeader, { backgroundColor: colors.card }]}>
          <View style={styles.avatarContainer}>
            {driver?.profileImage ? (
              <Image source={{ uri: driver.profileImage }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <User size={40} color={colors.white} />
              </View>
            )}
            <TouchableOpacity
              style={[styles.cameraButton, { backgroundColor: colors.success, borderColor: colors.card }]}
              onPress={handleChangeAvatar}
              disabled={isUploadingAvatar}
            >
              {isUploadingAvatar ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Camera size={16} color={colors.white} />
              )}
            </TouchableOpacity>
          </View>
          <Text style={[styles.driverName, { color: colors.text }]}>{driver?.name ?? 'Driver'}</Text>
          <Text style={[styles.driverInfo, { color: colors.textSecondary }]}>{driver?.vehicle ? `${driver.vehicle.make} ${driver.vehicle.model}` : 'Vehicle not set'}</Text>
          <View style={styles.ratingContainer}>
            <Star size={16} color="#FFD700" fill="#FFD700" />
            <Text style={[styles.rating, { color: colors.text }]}>{driverStats.rating != null ? driverStats.rating.toFixed(1) : 'New'}</Text>
            <Text style={[styles.ratingCount, { color: colors.textSecondary }]}>({driverStats.totalTrips} trips)</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Stats</Text>
          <View style={styles.statsGrid}>
            <ProfileStat
              label="Total Trips"
              value={driverStats.totalTrips.toLocaleString()}
              icon={<MapPin size={20} color={colors.primary} />}
            />
            <ProfileStat
              label="Total Earned"
              value={`₦${driverStats.totalEarnings.toLocaleString()}`}
              icon={<CreditCard size={20} color={colors.success} />}
            />
            <ProfileStat
              label="Rating"
              value={driverStats.rating != null ? driverStats.rating.toFixed(1) : 'New'}
              icon={<Star size={20} color="#FFD700" />}
            />
            <ProfileStat
              label="Years Active"
              value={driverStats.yearsActive.toString()}
              icon={<Award size={20} color={colors.primary} />}
            />
          </View>
        </View>

        {/* Settings */}
        <View style={styles.settingsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Settings</Text>

          <SettingsItem
            icon={<Bell size={20} color={colors.primary} />}
            title="Notifications"
            subtitle="Ride requests, messages, and updates"
            rightElement={
              <Switch
                value={notifications}
                onValueChange={(value) => void handleToggleNotifications(value)}
                trackColor={{ false: colors.lightGray, true: colors.primaryLight }}
                thumbColor={notifications ? colors.primary : colors.gray}
              />
            }
          />

          <SettingsItem
            icon={isDark ? <Moon size={20} color={colors.primary} /> : <Sun size={20} color={colors.primary} />}
            title="Dark Mode"
            subtitle="Switch between light and dark themes"
            rightElement={
              <Switch
                value={isDark}
                onValueChange={(value) => void changeTheme(value ? 'dark' : 'light')}
                trackColor={{ false: colors.lightGray, true: colors.primaryLight }}
                thumbColor={isDark ? colors.primary : colors.gray}
              />
            }
          />

          <SettingsItem
            icon={<Shield size={20} color={colors.primary} />}
            title="Privacy & Security"
            subtitle="Password and account protection"
            onPress={() => router.push('/driver-privacy-security' as any)}
          />

          <SettingsItem
            icon={<FileCheck size={20} color={colors.primary} />}
            title="Document Verification"
            subtitle={driver?.isVerified ? 'Verified' : 'Complete your driver verification'}
            onPress={() => router.push('/driver-verification/personal-info' as any)}
          />

          <SettingsItem
            icon={<Phone size={20} color={colors.primary} />}
            title="Contact Info"
            subtitle="View your phone and email"
            onPress={() => router.push('/driver-contact-info' as any)}
          />

          <SettingsItem
            icon={<Mail size={20} color={colors.primary} />}
            title="Support"
            subtitle="Get help and report issues"
            onPress={() => router.push('/support')}
          />
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: colors.card, borderColor: colors.danger }]}
          onPress={handleLogout}
        >
          <LogOut size={20} color={colors.danger} />
          <Text style={[styles.logoutText, { color: colors.danger }]}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  driverName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  driverInfo: {
    fontSize: 14,
    marginBottom: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
    marginRight: 4,
  },
  ratingCount: {
    fontSize: 14,
  },
  statsSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
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
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  settingsSection: {
    marginBottom: 30,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
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
    marginBottom: 2,
  },
  settingsSubtitle: {
    fontSize: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
