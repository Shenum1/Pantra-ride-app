import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  ArrowLeft,
  FileText,
  ShieldCheck,
  Car,
  ClipboardCheck,
  UserCheck,
  CheckCircle2,
  Clock,
  XCircle,
  Upload,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import { useDriverAuth } from '@/hooks/useDriverAuthStore';
import {
  DriverVerificationService,
  DriverDocument,
  DriverVerificationStatus,
} from '@/lib/driver-verification-service';

const DOCUMENT_TYPES: { type: DriverDocument['type']; title: string; description: string; icon: React.ComponentType<{ size: number; color: string }> }[] = [
  { type: 'license', title: "Driver's License", description: 'A clear photo of your valid driving license', icon: FileText },
  { type: 'insurance', title: 'Vehicle Insurance', description: 'Proof of valid vehicle insurance', icon: ShieldCheck },
  { type: 'registration', title: 'Vehicle Registration', description: 'Proof of vehicle ownership/registration', icon: Car },
  { type: 'vehicle_inspection', title: 'Vehicle Inspection', description: 'Recent roadworthiness inspection report', icon: ClipboardCheck },
  { type: 'background_check', title: 'Background Check', description: 'Run a background/criminal record check', icon: UserCheck },
];

function StatusBadge({ status }: { status: DriverDocument['status'] | 'none' }) {
  if (status === 'none') {
    return (
      <View style={[styles.badge, { backgroundColor: Colors.light.lightGray }]}>
        <Text style={[styles.badgeText, { color: Colors.light.textSecondary }]}>Not submitted</Text>
      </View>
    );
  }
  if (status === 'approved') {
    return (
      <View style={[styles.badge, { backgroundColor: '#dcfce7' }]}>
        <CheckCircle2 size={14} color={Colors.light.success} />
        <Text style={[styles.badgeText, { color: Colors.light.success }]}>Approved</Text>
      </View>
    );
  }
  if (status === 'rejected') {
    return (
      <View style={[styles.badge, { backgroundColor: '#fee2e2' }]}>
        <XCircle size={14} color={Colors.light.danger} />
        <Text style={[styles.badgeText, { color: Colors.light.danger }]}>Rejected</Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, { backgroundColor: '#fef3c7' }]}>
      <Clock size={14} color={Colors.light.warning} />
      <Text style={[styles.badgeText, { color: Colors.light.warning }]}>Pending review</Text>
    </View>
  );
}

export default function DriverDocumentsScreen() {
  const { driver } = useDriverAuth();
  const [documents, setDocuments] = useState<DriverDocument[]>([]);
  const [status, setStatus] = useState<DriverVerificationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!driver?.id) return;
    setIsLoading(true);
    try {
      const [docs, verificationStatus] = await Promise.all([
        DriverVerificationService.getDriverDocuments(driver.id),
        DriverVerificationService.getVerificationStatus(driver.id),
      ]);
      setDocuments(docs);
      setStatus(verificationStatus);
    } catch (error) {
      console.error('Error loading verification data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [driver?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const getLatestDocument = (type: DriverDocument['type']): DriverDocument | undefined => {
    return documents.find((doc) => doc.type === type);
  };

  const handleUpload = async (type: DriverDocument['type']) => {
    if (!driver?.id) return;

    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library to upload a document.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) return;

      setUploadingType(type);
      await DriverVerificationService.uploadDocument(driver.id, type, result.assets[0].uri);
      await loadData();
      Alert.alert('Uploaded', 'Your document was submitted for review.');
    } catch (error) {
      console.error('Error uploading document:', error);
      Alert.alert('Upload Failed', 'Could not upload your document. Please try again.');
    } finally {
      setUploadingType(null);
    }
  };

  const handleBackgroundCheck = async () => {
    if (!driver?.id) return;

    setUploadingType('background_check');
    try {
      const passed = await DriverVerificationService.runBackgroundCheck(driver.id);
      await loadData();
      if (passed) {
        Alert.alert('Background Check Complete', 'Your background check passed.');
      } else {
        Alert.alert('Background Check Complete', 'Your background check did not pass. Please contact support.');
      }
    } catch (error) {
      console.error('Error running background check:', error);
      Alert.alert('Error', 'Could not run the background check. Please try again.');
    } finally {
      setUploadingType(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Document Verification</Text>
        <View style={styles.backButton} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>
              {status?.isVerified ? 'You are fully verified' : 'Verification in progress'}
            </Text>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${status?.verificationProgress ?? 0}%` }]} />
            </View>
            <Text style={styles.progressLabel}>{Math.round(status?.verificationProgress ?? 0)}% complete</Text>
          </View>

          {DOCUMENT_TYPES.map(({ type, title, description, icon: Icon }) => {
            const doc = getLatestDocument(type);
            const isUploading = uploadingType === type;

            return (
              <View key={type} style={styles.docCard}>
                <View style={styles.docHeader}>
                  <View style={styles.docIcon}>
                    <Icon size={20} color={Colors.light.primary} />
                  </View>
                  <View style={styles.docInfo}>
                    <Text style={styles.docTitle}>{title}</Text>
                    <Text style={styles.docDescription}>{description}</Text>
                  </View>
                </View>

                <View style={styles.docFooter}>
                  <StatusBadge status={doc?.status ?? 'none'} />

                  {type === 'background_check' ? (
                    <TouchableOpacity
                      style={[styles.uploadButton, isUploading && styles.uploadButtonDisabled]}
                      onPress={handleBackgroundCheck}
                      disabled={isUploading || doc?.status === 'pending' || doc?.status === 'approved'}
                    >
                      {isUploading ? (
                        <ActivityIndicator size="small" color={Colors.light.white} />
                      ) : (
                        <Text style={styles.uploadButtonText}>
                          {doc ? 'Run Again' : 'Run Check'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.uploadButton, isUploading && styles.uploadButtonDisabled]}
                      onPress={() => handleUpload(type)}
                      disabled={isUploading || doc?.status === 'pending' || doc?.status === 'approved'}
                    >
                      {isUploading ? (
                        <ActivityIndicator size="small" color={Colors.light.white} />
                      ) : (
                        <>
                          <Upload size={14} color={Colors.light.white} />
                          <Text style={styles.uploadButtonText}>
                            {doc ? 'Re-upload' : 'Upload'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>

                {doc?.status === 'rejected' && doc.rejectionReason && (
                  <Text style={styles.rejectionReason}>Reason: {doc.rejectionReason}</Text>
                )}
              </View>
            );
          })}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  progressCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 12,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.lightGray,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.primary,
  },
  progressLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 8,
  },
  docCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  docHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  docIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  docInfo: {
    flex: 1,
  },
  docTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 2,
  },
  docDescription: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  docFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
    minWidth: 90,
    justifyContent: 'center',
  },
  uploadButtonDisabled: {
    opacity: 0.7,
  },
  uploadButtonText: {
    color: Colors.light.white,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  rejectionReason: {
    marginTop: 10,
    fontSize: 12,
    color: Colors.light.danger,
  },
});
