import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle, XCircle, AlertCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { GoogleMapsService } from '@/lib/google-maps-service';

export default function MapsDiagnosticScreen() {
  const router = useRouter();
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<any>(null);
  const maskedToken = GoogleMapsService.hasApiKey ? `${GoogleMapsService.apiKey.slice(0, 8)}...${GoogleMapsService.apiKey.slice(-6)}` : 'Not configured';
  const hasConfiguredToken = GoogleMapsService.hasApiKey;

  const runDiagnostics = async () => {
    setTesting(true);
    setResults(null);

    try {
      console.log('🔍 Running Google Maps API diagnostics...');
      const testResults = await GoogleMapsService.testApiKey();
      setResults(testResults);
      
      if (testResults.success) {
        console.log('✅ All APIs are working correctly!');
      } else {
        console.log('⚠️ Some APIs need to be enabled');
      }
    } catch (error) {
      console.error('❌ Diagnostic test failed:', error);
      setResults({
        success: false,
        message: 'Failed to run diagnostics',
        apis: {},
      });
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = (status: boolean) => {
    if (status) {
      return <CheckCircle size={24} color={Colors.light.success} />;
    }
    return <XCircle size={24} color={Colors.light.error} />;
  };

  const apiInstructions = {
    places: {
      name: 'Google Places Search',
      description: 'Finds real places, businesses, streets, and addresses',
      howToEnable: '1. Open Google Cloud Console\n2. Enable Places API\n3. Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY\n4. Make sure billing and API restrictions allow this app',
    },
    autocomplete: {
      name: 'Google Places Autocomplete',
      description: 'Provides live search suggestions',
      howToEnable: '1. Open Google Cloud Console\n2. Enable Places API\n3. Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY\n4. Re-run diagnostics',
    },
    directions: {
      name: 'Google Directions',
      description: 'Calculates routes between rider and destination',
      howToEnable: '1. Open Google Cloud Console\n2. Enable Directions API\n3. Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY\n4. Re-run diagnostics',
    },
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.title}>Maps API Diagnostic</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.infoCard}>
          <AlertCircle size={24} color={Colors.light.primary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoText}>
              This tool tests if your Google Maps API key can power search, autosuggest, and directions.
            </Text>
            <View style={styles.tokenPill}>
              <Text style={styles.tokenPillLabel}>API Key</Text>
              <Text style={styles.tokenPillValue}>{hasConfiguredToken ? maskedToken : 'Not configured'}</Text>
            </View>
          </View>
        </View>

        <Pressable
          style={[styles.testButton, testing && styles.testButtonDisabled]}
          onPress={runDiagnostics}
          disabled={testing}
        >
          {testing ? (
            <>
              <ActivityIndicator size="small" color={Colors.light.white} />
              <Text style={styles.testButtonText}>Testing APIs...</Text>
            </>
          ) : (
            <Text style={styles.testButtonText}>Run Diagnostics</Text>
          )}
        </Pressable>

        {results && (
          <View style={styles.resultsContainer}>
            <View style={[
              styles.statusCard,
              results.success ? styles.statusCardSuccess : styles.statusCardError
            ]}>
              {results.success ? (
                <>
                  <CheckCircle size={32} color={Colors.light.success} />
                  <Text style={styles.statusTitle}>Google Maps Ready!</Text>
                  <Text style={styles.statusMessage}>{results.message}</Text>
                </>
              ) : (
                <>
                  <XCircle size={32} color={Colors.light.error} />
                  <Text style={styles.statusTitle}>Google Maps Needs Configuration</Text>
                  <Text style={styles.statusMessage}>{results.message}</Text>
                </>
              )}
            </View>

            <Text style={styles.sectionTitle}>API Status Details</Text>

            {Object.entries(results.apis).map(([key, status]) => {
              const api = apiInstructions[key as keyof typeof apiInstructions];
              if (!api) return null;

              return (
                <View key={key} style={styles.apiCard}>
                  <View style={styles.apiHeader}>
                    {getStatusIcon(status as boolean)}
                    <View style={styles.apiInfo}>
                      <Text style={styles.apiName}>{api.name}</Text>
                      <Text style={styles.apiDescription}>{api.description}</Text>
                    </View>
                  </View>

                  {!status && (
                    <View style={styles.instructionsContainer}>
                      <Text style={styles.instructionsTitle}>How to enable:</Text>
                      <Text style={styles.instructionsText}>{api.howToEnable}</Text>
                      {key === 'directions' && (
                        <View style={styles.billingWarning}>
                          <AlertCircle size={16} color={Colors.light.warning} />
                          <Text style={styles.billingWarningText}>
                            Note: Google Directions and Places requests may require billing and the correct APIs enabled in Google Cloud.
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}

            {!results.success && (
              <View style={styles.helpCard}>
                <Text style={styles.helpTitle}>Need Help?</Text>
                <Text style={styles.helpText}>
                  1. Open Google Cloud Console{'\n'}
                  2. Create or copy a Google Maps API key{'\n'}
                  3. Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY{'\n'}
                  4. Enable Places API, Maps SDKs, Static Maps API, and Directions API{'\n'}
                  5. Restart the app{'\n'}
                  6. Run diagnostics again
                </Text>
                <View style={styles.billingBox}>
                  <Text style={styles.billingBoxTitle}>⚠️ Important:</Text>
                  <Text style={styles.billingBoxText}>
                    Until the Google Maps API key is added, the app will fall back to estimated routes and mock suggestions.
                  </Text>
                </View>
                <Pressable
                  style={styles.linkButton}
                  onPress={() => console.log('Opening Google Cloud Console...')}
                >
                  <Text style={styles.linkButtonText}>
                    Open Google Cloud Console
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {!results && !testing && (
          <View style={styles.placeholderCard}>
            <AlertCircle size={48} color={Colors.light.lightGray} />
            <Text style={styles.placeholderText}>
              Press &quot;Run Diagnostics&quot; to test your Google Maps configuration
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.lightGray,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: Colors.light.primary + '15',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  infoContent: {
    flex: 1,
    gap: 12,
  },
  infoText: {
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 20,
  },
  tokenPill: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.light.white,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  tokenPillLabel: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  tokenPillValue: {
    fontSize: 12,
    color: Colors.light.text,
    fontWeight: '700' as const,
  },
  testButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  testButtonDisabled: {
    opacity: 0.6,
  },
  testButtonText: {
    color: Colors.light.white,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  resultsContainer: {
    gap: 16,
  },
  statusCard: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  statusCardSuccess: {
    backgroundColor: Colors.light.success + '15',
    borderWidth: 2,
    borderColor: Colors.light.success,
  },
  statusCardError: {
    backgroundColor: Colors.light.error + '15',
    borderWidth: 2,
    borderColor: Colors.light.error,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginTop: 8,
  },
  statusMessage: {
    fontSize: 14,
    color: Colors.light.gray,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginTop: 8,
  },
  apiCard: {
    backgroundColor: Colors.light.white,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.lightGray,
  },
  apiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  apiInfo: {
    flex: 1,
  },
  apiName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 4,
  },
  apiDescription: {
    fontSize: 13,
    color: Colors.light.gray,
  },
  instructionsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.lightGray,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 13,
    color: Colors.light.gray,
    lineHeight: 20,
  },
  helpCard: {
    backgroundColor: Colors.light.primary + '10',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: Colors.light.gray,
    lineHeight: 22,
    marginBottom: 16,
  },
  linkButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  linkButtonText: {
    color: Colors.light.white,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  placeholderCard: {
    padding: 40,
    alignItems: 'center',
    gap: 16,
  },
  placeholderText: {
    fontSize: 14,
    color: Colors.light.gray,
    textAlign: 'center',
  },
  billingWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: Colors.light.warning + '15',
    borderRadius: 8,
  },
  billingWarningText: {
    flex: 1,
    fontSize: 12,
    color: Colors.light.text,
    lineHeight: 16,
  },
  billingBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: Colors.light.primary + '10',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.light.primary,
  },
  billingBoxTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 6,
  },
  billingBoxText: {
    fontSize: 12,
    color: Colors.light.gray,
    lineHeight: 18,
  },
});
