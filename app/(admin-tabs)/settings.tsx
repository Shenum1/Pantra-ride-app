import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Settings, 
  Bell, 
  Shield, 
  Database, 
  Globe, 
  Users, 
  CreditCard, 
  Mail, 
  Smartphone,
  ChevronRight,
  LogOut
} from 'lucide-react-native';
import { useAdminAuth } from '@/hooks/useAdminAuthStore';

interface SettingItem {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  type: 'navigation' | 'toggle' | 'action';
  value?: boolean;
  onPress?: () => void;
  onToggle?: (value: boolean) => void;
}

const SettingCard: React.FC<{ item: SettingItem }> = ({ item }) => {
  const IconComponent = item.icon;
  
  return (
    <TouchableOpacity 
      style={styles.settingCard} 
      onPress={item.onPress}
      disabled={item.type === 'toggle'}
      activeOpacity={0.7}
    >
      <View style={styles.settingIcon}>
        <IconComponent size={20} color="#667eea" />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{item.title}</Text>
        <Text style={styles.settingDescription}>{item.description}</Text>
      </View>
      <View style={styles.settingAction}>
        {item.type === 'toggle' && (
          <Switch
            value={item.value || false}
            onValueChange={item.onToggle}
            trackColor={{ false: '#e5e7eb', true: '#667eea' }}
            thumbColor={item.value ? '#ffffff' : '#f3f4f6'}
          />
        )}
        {item.type === 'navigation' && (
          <ChevronRight size={20} color="#9ca3af" />
        )}
      </View>
    </TouchableOpacity>
  );
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { logout } = useAdminAuth();

  const handleLogout = () => {
    logout();
    // The admin app will automatically show the login screen when isAuthenticated becomes false
  };

  const settingSections = [
    {
      title: 'System Configuration',
      items: [
        {
          id: 'notifications',
          title: 'Push Notifications',
          description: 'Enable system-wide notifications',
          icon: Bell,
          type: 'toggle' as const,
          value: true,
          onToggle: (value: boolean) => {
            if (typeof value !== 'boolean') return;
            console.log('Notifications:', value);
          },
        },
        {
          id: 'maintenance',
          title: 'Maintenance Mode',
          description: 'Put the app in maintenance mode',
          icon: Settings,
          type: 'toggle' as const,
          value: false,
          onToggle: (value: boolean) => {
            if (typeof value !== 'boolean') return;
            console.log('Maintenance:', value);
          },
        },
        {
          id: 'security',
          title: 'Security Settings',
          description: 'Manage security and authentication',
          icon: Shield,
          type: 'navigation' as const,
          onPress: () => console.log('Navigate to security'),
        },
      ],
    },
    {
      title: 'Data Management',
      items: [
        {
          id: 'database',
          title: 'Database Settings',
          description: 'Configure database connections',
          icon: Database,
          type: 'navigation' as const,
          onPress: () => console.log('Navigate to database'),
        },
        {
          id: 'backup',
          title: 'Backup & Restore',
          description: 'Manage data backups',
          icon: Database,
          type: 'navigation' as const,
          onPress: () => console.log('Navigate to backup'),
        },
      ],
    },
    {
      title: 'Platform Settings',
      items: [
        {
          id: 'regions',
          title: 'Regional Settings',
          description: 'Configure supported regions',
          icon: Globe,
          type: 'navigation' as const,
          onPress: () => console.log('Navigate to regions'),
        },
        {
          id: 'user-roles',
          title: 'User Roles & Permissions',
          description: 'Manage admin user permissions',
          icon: Users,
          type: 'navigation' as const,
          onPress: () => console.log('Navigate to user roles'),
        },
        {
          id: 'payment-config',
          title: 'Payment Configuration',
          description: 'Configure payment gateways',
          icon: CreditCard,
          type: 'navigation' as const,
          onPress: () => console.log('Navigate to payment config'),
        },
      ],
    },
    {
      title: 'Communication',
      items: [
        {
          id: 'email-templates',
          title: 'Email Templates',
          description: 'Manage automated email templates',
          icon: Mail,
          type: 'navigation' as const,
          onPress: () => console.log('Navigate to email templates'),
        },
        {
          id: 'sms-config',
          title: 'SMS Configuration',
          description: 'Configure SMS service providers',
          icon: Smartphone,
          type: 'navigation' as const,
          onPress: () => console.log('Navigate to SMS config'),
        },
      ],
    },
  ];

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#667eea', '#764ba2']} style={[styles.header, { paddingTop: insets.top + 32 }]}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>System configuration and preferences</Text>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {settingSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionContent}>
              {section.items.map((item) => (
                <SettingCard key={item.id} item={item} />
              ))}
            </View>
          </View>
        ))}

        <View style={styles.section}>
          <View style={styles.sectionContent}>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <LogOut size={20} color="#ef4444" />
              <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Admin Panel v1.0.0</Text>
          <Text style={styles.footerSubtext}>Last updated: Today</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  sectionContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  settingAction: {
    marginLeft: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
    marginLeft: 12,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    color: '#9ca3af',
  },
});