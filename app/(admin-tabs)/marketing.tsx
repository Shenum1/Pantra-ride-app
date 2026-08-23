import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Megaphone } from 'lucide-react-native';

export default function MarketingScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#667eea', '#764ba2']} style={[styles.header, { paddingTop: insets.top + 32 }]}>
        <Text style={styles.headerTitle}>Marketing</Text>
        <Text style={styles.headerSubtitle}>Manage campaigns and promotions</Text>
      </LinearGradient>

      <View style={styles.emptyState}>
        <Megaphone size={40} color="#9ca3af" />
        <Text style={styles.emptyTitle}>Not yet available</Text>
        <Text style={styles.emptySubtitle}>Campaign management isn&apos;t connected to a backend yet.</Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => Alert.alert('Not yet available', 'Campaign creation is not yet connected to a backend.')}
        >
          <Text style={styles.createButtonText}>Create New Campaign</Text>
        </TouchableOpacity>
      </View>
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 6,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  createButton: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
