import React, { useState } from 'react';
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
  AlertTriangle,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import { useDriverAuth } from '@/hooks/useDriverAuthStore';
import { useDriverVerification } from '@/hooks/useDriverVerification';
import { StorageService } from '@/lib/storage-service';
import type { RequiredDocumentType } from '@/lib/driver-verification-config';
import { Skeleton, SkeletonCircle, SkeletonLine, ShimmerGroup } from '@/components/skeletons';

const DOCUMENT_META: Record<RequiredDocumentType, { title: string; description: string; icon: React.ComponentType<{ size: number; color: string }> }> = {
  drivers_license_front: { title: "Driver's License — Front", description: 'A clear photo of the front of your license', icon: FileText },
  drivers_license_back: { title: "Driver's License — Back", description: 'A clear photo of the back of your license', icon: FileText },
  driver_selfie: { title: 'Selfie', description: 'A clear photo of your face', icon: UserCheck },
  vehicle_registration: { title: 'Vehicle Registration', description: 'Proof of vehicle registration', icon: Car },
  proof_of_ownership: { title: 'Proof of Ownership', description: 'Vehicle ownership documentation', icon: Car },
  insurance: { title: 'Vehicle Insurance', description: 'Proof of valid vehicle insurance', icon: ShieldCheck },
  roadworthiness: { title: 'Roadworthiness Certificate', description: 'Recent roadworthiness inspection report', icon: ClipboardCheck },
};

const STATUS_BANNER: Record<string, { label: string; color: string; description: string }> = {
  PENDING: { label: 'Not Started', color: Colors.light.textSecondary, description: 'Complete the verification wizard to submit your details.' },
  DOCUMENTS_SUBMITTED: { label: 'Documents Submitted', color: Colors.light.warning, description: 'Your documents were received and are queued for review.' },
  VERIFYING: { label: 'Verifying', color: Colors.light.warning, description: 'We are running automated checks on your submission.' },
  MANUAL_REVIEW: { label: 'Under Manual Review', color: Colors.light.warning, description: 'A team member is reviewing your submission.' },
  VERIFIED: { label: 'Verified', color: Colors.light.success, description: 'You are fully verified and can go online.' },
  REJECTED: { label: 'Rejected', color: Colors.light.danger, description: 'Please correct the issues below and resubmit.' },
};

function DocStatusBadge({ documentStatus }: { documentStatus: string | null }) {
  if (!documentStatus) {
    return (
      <View style={[styles.badge, { backgroundColor: Colors.light.lightGray }]}>
        <Text style={[styles.badgeText, { color: Colors.light.textSecondary }]}>Not submitted</Text>
      </View>
    );
  }
  if (documentStatus === 'approved') {
    return (
      <View style={[styles.badge, { backgroundColor: '#dcfce7' }]}>
        <CheckCircle2 size={14} color={Colors.light.success} />
        <Text style={[styles.badgeText, { color: Colors.light.success }]}>Approved</Text>
      </View>
    );
  }
  if (documentStatus === 'rejected') {
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
  const { status, isLoading, submitDocument, refetch } = useDriverVerification();
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  const handleReupload = async (type: RequiredDocumentType) => {
    if (!driver?.id) return;
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow camera access to capture this document.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (result.canceled || !result.assets[0]) return;

      setUploadingType(type);
      const storagePath = await StorageService.uploadPrivateFile(
        result.assets[0].uri,
        `drivers/${driver.id}/${type}_${Date.now()}`
      );
      await submitDocument({ type, storagePath });
      await refetch();
      Alert.alert('Uploaded', 'Your document was submitted for review.');
    } catch (error: any) {
      Alert.alert('Upload Failed', error?.message ?? 'Could not upload your document. Please try again.');
    } finally {
      setUploadingType(null);
    }
  };

  const banner = STATUS_BANNER[status?.verificationStatus ?? 'PENDING'];
  const hasStartedWizard = !!status?.operatingState;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verification Status</Text>
        <View style={styles.backButton} />
      </View>

      {isLoading ? (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <ShimmerGroup>
            <View style={styles.progressCard}>
              <SkeletonLine width={180} height={16} style={{ marginBottom: 12 }} />
              <Skeleton height={8} borderRadius={4} />
              <SkeletonLine width={100} height={13} style={{ marginTop: 8 }} />
            </View>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.docCard}>
                <View style={styles.docHeader}>
                  <SkeletonCircle size={40} style={{ marginRight: 12 }} />
                  <View style={styles.docInfo}>
                    <SkeletonLine width={140} height={15} style={{ marginBottom: 6 }} />
                    <SkeletonLine width={200} height={13} />
                  </View>
                </View>
              </View>
            ))}
          </ShimmerGroup>
        </ScrollView>
      ) : !hasStartedWizard ? (
        <View style={styles.emptyState}>
          <AlertTriangle size={40} color={Colors.light.warning} />
          <Text style={styles.emptyTitle}>Verification Not Started</Text>
          <Text style={styles.emptyDescription}>
            Complete the driver verification wizard to submit your personal, license, and vehicle information.
          </Text>
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => router.push('/driver-verification/personal-info' as any)}
          >
            <Text style={styles.startButtonText}>Start Verification</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={[styles.progressCard, { borderLeftWidth: 4, borderLeftColor: banner.color }]}>
            <Text style={[styles.progressTitle, { color: banner.color }]}>{banner.label}</Text>
            <Text style={styles.progressDescription}>{banner.description}</Text>
            {status?.rejectionReason && (
              <Text style={styles.rejectionReasonTop}>Reason: {status.rejectionReason}</Text>
            )}
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${status?.verificationProgress ?? 0}%` }]} />
            </View>
            <Text style={styles.progressLabel}>{Math.round(status?.verificationProgress ?? 0)}% documents submitted</Text>
          </View>

          {(status?.requiredDocuments ?? []).map((doc) => {
            const meta = DOCUMENT_META[doc.type as RequiredDocumentType];
            if (!meta) return null;
            const Icon = meta.icon;
            const isUploading = uploadingType === doc.type;

            return (
              <View key={doc.type} style={styles.docCard}>
                <View style={styles.docHeader}>
                  <View style={styles.docIcon}>
                    <Icon size={20} color={Colors.light.primary} />
                  </View>
                  <View style={styles.docInfo}>
                    <Text style={styles.docTitle}>{meta.title}</Text>
                    <Text style={styles.docDescription}>{meta.description}</Text>
                  </View>
                </View>

                <View style={styles.docFooter}>
                  <DocStatusBadge documentStatus={doc.documentStatus} />
                  <TouchableOpacity
                    style={[styles.uploadButton, isUploading && styles.uploadButtonDisabled]}
                    onPress={() => handleReupload(doc.type as RequiredDocumentType)}
                    disabled={isUploading || doc.documentStatus === 'pending' || doc.documentStatus === 'approved'}
                  >
                    {isUploading ? (
                      <ActivityIndicator size="small" color={Colors.light.white} />
                    ) : (
                      <>
                        <Upload size={14} color={Colors.light.white} />
                        <Text style={styles.uploadButtonText}>{doc.isSubmitted ? 'Re-upload' : 'Upload'}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {doc.rejectionReason && <Text style={styles.rejectionReason}>Reason: {doc.rejectionReason}</Text>}
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
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.light.text },
  scrollView: { flex: 1, padding: 16 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.light.text },
  emptyDescription: { fontSize: 14, color: Colors.light.textSecondary, textAlign: 'center' },
  startButton: {
    marginTop: 12,
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  startButtonText: { color: Colors.light.white, fontWeight: '600' as const, fontSize: 15 },
  progressCard: { backgroundColor: Colors.light.card, borderRadius: 16, padding: 16, marginBottom: 16 },
  progressTitle: { fontSize: 16, fontWeight: '700' as const, marginBottom: 4 },
  progressDescription: { fontSize: 13, color: Colors.light.textSecondary, marginBottom: 8 },
  rejectionReasonTop: { fontSize: 13, color: Colors.light.danger, marginBottom: 8 },
  progressBarTrack: { height: 8, borderRadius: 4, backgroundColor: Colors.light.lightGray, overflow: 'hidden' },
  progressBarFill: { height: 8, borderRadius: 4, backgroundColor: Colors.light.primary },
  progressLabel: { fontSize: 13, color: Colors.light.textSecondary, marginTop: 8 },
  docCard: { backgroundColor: Colors.light.card, borderRadius: 16, padding: 16, marginBottom: 12 },
  docHeader: { flexDirection: 'row', marginBottom: 12 },
  docIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  docInfo: { flex: 1 },
  docTitle: { fontSize: 15, fontWeight: '600' as const, color: Colors.light.text, marginBottom: 2 },
  docDescription: { fontSize: 13, color: Colors.light.textSecondary },
  docFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, gap: 4 },
  badgeText: { fontSize: 12, fontWeight: '600' as const },
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
  uploadButtonDisabled: { opacity: 0.7 },
  uploadButtonText: { color: Colors.light.white, fontSize: 13, fontWeight: '600' as const },
  rejectionReason: { marginTop: 10, fontSize: 12, color: Colors.light.danger },
});
