import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform as RNPlatform, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react-native';
import { auth, db } from '@/lib/firebase';
import { DatabaseService } from '@/lib/database-service';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';

interface DiagnosticCheck {
  name: string;
  status: 'pending' | 'success' | 'error' | 'warning';
  message: string;
  details?: string;
}

export default function FirebaseDiagnostics() {
  const [checks, setChecks] = useState<DiagnosticCheck[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [networkEnabled, setNetworkEnabled] = useState(true);

  const updateCheck = (name: string, status: DiagnosticCheck['status'], message: string, details?: string) => {
    setChecks(prev => {
      const index = prev.findIndex(c => c.name === name);
      const newCheck = { name, status, message, details };
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = newCheck;
        return updated;
      }
      return [...prev, newCheck];
    });
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    setChecks([]);

    updateCheck('Platform', 'pending', 'Checking platform...');
    await new Promise(resolve => setTimeout(resolve, 100));
    updateCheck('Platform', 'success', `Running on ${RNPlatform.OS}`, RNPlatform.Version?.toString());

    updateCheck('Firebase Config', 'pending', 'Checking Firebase configuration...');
    try {
      const config = {
        apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
        projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
        authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      };
      
      if (config.apiKey && config.projectId && config.authDomain) {
        updateCheck('Firebase Config', 'success', 'Configuration valid', 
          `Project: ${config.projectId}\nDomain: ${config.authDomain}`);
      } else {
        updateCheck('Firebase Config', 'error', 'Missing configuration', 
          `API Key: ${config.apiKey ? '✓' : '✗'}\nProject ID: ${config.projectId ? '✓' : '✗'}\nAuth Domain: ${config.authDomain ? '✓' : '✗'}`);
      }
    } catch (error: any) {
      updateCheck('Firebase Config', 'error', 'Configuration error', error.message);
    }

    updateCheck('Auth Service', 'pending', 'Checking authentication service...');
    try {
      if (auth) {
        updateCheck('Auth Service', 'success', 'Auth service initialized', 
          `Current user: ${auth.currentUser ? auth.currentUser.email : 'Not logged in'}`);
      } else {
        updateCheck('Auth Service', 'error', 'Auth service not initialized');
      }
    } catch (error: any) {
      updateCheck('Auth Service', 'error', 'Auth service error', error.message);
    }

    updateCheck('Firestore Service', 'pending', 'Checking Firestore connection...');
    try {
      if (db) {
        updateCheck('Firestore Service', 'success', 'Firestore initialized');
      } else {
        updateCheck('Firestore Service', 'error', 'Firestore not initialized');
      }
    } catch (error: any) {
      updateCheck('Firestore Service', 'error', 'Firestore error', error.message);
    }

    updateCheck('Network Connection', 'pending', 'Testing network connectivity...');
    try {
      const testCollection = collection(db, 'diagnostics');
      const snapshot = await getDocs(testCollection);
      updateCheck('Network Connection', 'success', 'Network connected', 
        `Can reach Firestore. Found ${snapshot.size} documents.`);
    } catch (error: any) {
      if (error.code === 'unavailable') {
        updateCheck('Network Connection', 'error', 'Cannot reach Firestore', 
          'Check your internet connection or Firebase project settings.');
      } else if (error.code === 'permission-denied') {
        updateCheck('Network Connection', 'warning', 'Permission denied', 
          'Firestore rules may be blocking access. This is normal if not authenticated.');
      } else {
        updateCheck('Network Connection', 'error', 'Network error', 
          `${error.code}: ${error.message}`);
      }
    }

    updateCheck('Write Test', 'pending', 'Testing write operation...');
    try {
      const testDoc = await addDoc(collection(db, 'diagnostics'), {
        test: true,
        timestamp: new Date().toISOString(),
        platform: RNPlatform.OS,
      });
      
      await deleteDoc(doc(db, 'diagnostics', testDoc.id));
      
      updateCheck('Write Test', 'success', 'Write operation successful', 
        'Can write and delete documents from Firestore.');
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        updateCheck('Write Test', 'warning', 'Write permission denied', 
          'Cannot write to Firestore. Check security rules or authenticate first.');
      } else if (error.code === 'unavailable') {
        updateCheck('Write Test', 'error', 'Network unavailable', 
          'Cannot reach Firestore to perform write operation.');
      } else {
        updateCheck('Write Test', 'error', 'Write operation failed', 
          `${error.code}: ${error.message}`);
      }
    }

    setIsRunning(false);
  };

  const toggleNetwork = async () => {
    try {
      if (networkEnabled) {
        await DatabaseService.disableNetwork();
        setNetworkEnabled(false);
        Alert.alert('Network Disabled', 'Firestore is now in offline mode');
      } else {
        await DatabaseService.enableNetwork();
        setNetworkEnabled(true);
        Alert.alert('Network Enabled', 'Firestore is now online');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  useEffect(() => {
    runDiagnostics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatusIcon = (status: DiagnosticCheck['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={20} color="#10b981" />;
      case 'error':
        return <XCircle size={20} color="#ef4444" />;
      case 'warning':
        return <AlertTriangle size={20} color="#f59e0b" />;
      default:
        return <RefreshCw size={20} color="#6b7280" />;
    }
  };

  const getStatusColor = (status: DiagnosticCheck['status']) => {
    switch (status) {
      case 'success': return '#10b981';
      case 'error': return '#ef4444';
      case 'warning': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Firebase Diagnostics', headerBackTitle: 'Back' }} />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Firebase Connection Diagnostics</Text>
          <Text style={styles.subtitle}>Check your Firebase and Firestore setup</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity 
            style={[styles.button, styles.primaryButton]} 
            onPress={runDiagnostics}
            disabled={isRunning}
          >
            <RefreshCw size={20} color="#fff" />
            <Text style={styles.buttonText}>{isRunning ? 'Running...' : 'Run Diagnostics'}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]} 
            onPress={toggleNetwork}
          >
            {networkEnabled ? <Wifi size={20} color="#3b82f6" /> : <WifiOff size={20} color="#ef4444" />}
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>
              {networkEnabled ? 'Disable Network' : 'Enable Network'}
            </Text>
          </TouchableOpacity>
        </View>

        {checks.length > 0 && (
          <View style={styles.checksContainer}>
            {checks.map((check, index) => (
              <View key={index} style={styles.checkItem}>
                <View style={styles.checkHeader}>
                  <View style={styles.checkTitle}>
                    {getStatusIcon(check.status)}
                    <Text style={styles.checkName}>{check.name}</Text>
                  </View>
                  <Text style={[styles.checkStatus, { color: getStatusColor(check.status) }]}>
                    {check.status.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.checkMessage}>{check.message}</Text>
                {check.details && (
                  <View style={styles.checkDetails}>
                    <Text style={styles.checkDetailsText}>{check.details}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={styles.infoBox}>
          <AlertTriangle size={20} color="#f59e0b" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Common Issues:</Text>
            <Text style={styles.infoText}>
              • No internet connection{'\n'}
              • Firebase project not configured correctly{'\n'}
              • Firestore not enabled in Firebase Console{'\n'}
              • Invalid API key or project ID{'\n'}
              • Firestore security rules blocking access{'\n'}
              • Missing Firestore indexes
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButtonText: {
    color: '#3b82f6',
  },
  checksContainer: {
    gap: 12,
    marginBottom: 24,
  },
  checkItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  checkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  checkName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  checkStatus: {
    fontSize: 12,
    fontWeight: '700',
  },
  checkMessage: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 4,
  },
  checkDetails: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  checkDetailsText: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: 'monospace',
  },
  infoBox: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#78350f',
    lineHeight: 20,
  },
});
