import { Lock, Key, Smartphone, Eye, EyeOff, Shield } from "lucide-react-native";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useThemeStore";
import { Stack } from "expo-router";

interface SecurityOptionProps {
  icon: React.ReactElement;
  title: string;
  description: string;
  isEnabled?: boolean;
  onToggle?: (enabled: boolean) => void;
  onPress?: () => void;
}

const SecurityOption: React.FC<SecurityOptionProps> = ({ 
  icon, 
  title, 
  description, 
  isEnabled,
  onToggle,
  onPress 
}) => {
  const { colors } = useTheme();
  
  return (
    <Pressable 
      style={[styles.optionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
    >
      <View style={styles.optionIcon}>
        <Text>{icon}</Text>
      </View>
      <View style={styles.optionContent}>
        <Text style={[styles.optionTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.optionDescription, { color: colors.gray }]}>{description}</Text>
      </View>
      {onToggle && (
        <Switch
          value={isEnabled}
          onValueChange={onToggle}
          trackColor={{ false: colors.lightGray, true: colors.primary }}
          thumbColor={colors.white}
        />
      )}
    </Pressable>
  );
};

export default function LoginSecurityScreen() {
  const { colors } = useTheme();
  
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  const [biometricLogin, setBiometricLogin] = useState(true);
  const [loginAlerts, setLoginAlerts] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all password fields.');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match.');
      return;
    }
    
    Alert.alert('Success', 'Your password has been updated successfully.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };
  
  const handleSetupTwoFactor = () => {
    Alert.alert('Two-Factor Authentication', 'Set up 2FA for enhanced security.');
  };
  
  const handleLoginHistory = () => {
    Alert.alert('Login History', 'View your recent login activity.');
  };
  
  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Login & Security',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
        }} 
      />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["bottom"]}>
        <ScrollView style={styles.content}>
          <View style={styles.headerSection}>
            <Text style={[styles.title, { color: colors.text }]}>Account Security</Text>
            <Text style={[styles.subtitle, { color: colors.gray }]}>
              Manage your login credentials and security settings
            </Text>
          </View>
          
          <View style={styles.passwordSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Change Password</Text>
            
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Current Password</Text>
              <View style={[styles.passwordInput, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  placeholderTextColor={colors.gray}
                  secureTextEntry={!showPassword}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)}>
                  {showPassword ? (
                    <EyeOff size={20} color={colors.gray} />
                  ) : (
                    <Eye size={20} color={colors.gray} />
                  )}
                </Pressable>
              </View>
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>New Password</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                placeholderTextColor={colors.gray}
                secureTextEntry
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Confirm New Password</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor={colors.gray}
                secureTextEntry
              />
            </View>
            
            <Pressable 
              style={[styles.changePasswordButton, { backgroundColor: colors.primary }]}
              onPress={handleChangePassword}
            >
              <Text style={[styles.changePasswordText, { color: colors.white }]}>Update Password</Text>
            </Pressable>
          </View>
          
          <View style={styles.securityOptionsContainer}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Security Options</Text>
            
            <SecurityOption
              icon={<Smartphone size={24} color={colors.primary} />}
              title="Two-Factor Authentication"
              description="Add an extra layer of security to your account"
              isEnabled={twoFactorAuth}
              onToggle={setTwoFactorAuth}
            />
            
            <SecurityOption
              icon={<Shield size={24} color={colors.primary} />}
              title="Biometric Login"
              description="Use fingerprint or face recognition to sign in"
              isEnabled={biometricLogin}
              onToggle={setBiometricLogin}
            />
            
            <SecurityOption
              icon={<Lock size={24} color={colors.primary} />}
              title="Login Alerts"
              description="Get notified of new sign-ins to your account"
              isEnabled={loginAlerts}
              onToggle={setLoginAlerts}
            />
            
            <SecurityOption
              icon={<Key size={24} color={colors.text} />}
              title="Login History"
              description="View recent activity on your account"
              onPress={handleLoginHistory}
            />
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
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  passwordSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
  },
  passwordInput: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
  },
  changePasswordButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  changePasswordText: {
    fontSize: 16,
    fontWeight: '600',
  },
  securityOptionsContainer: {
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionIcon: {
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    lineHeight: 18,
  },
});