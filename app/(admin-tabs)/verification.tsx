import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Image, Modal, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ShieldCheck, FileText, Car, ClipboardCheck, UserCheck, Check, X } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all';

const TYPE_LABELS: Record<string, string> = {
  license: "Driver's License",
  insurance: 'Vehicle Insurance',
  registration: 'Vehicle Registration',
  vehicle_inspection: 'Vehicle Inspection',
  background_check: 'Background Check',
};

const TYPE_ICONS: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  license: FileText,
  insurance: ShieldCheck,
  registration: Car,
  vehicle_inspection: ClipboardCheck,
  background_check: UserCheck,
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'approved': return '#10b981';
    case 'rejected': return '#ef4444';
    default: return '#f59e0b';
  }
};

export default function VerificationScreen() {
  const insets = useSafeAreaInsets();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const utils = trpc.useUtils();
  const documentsQuery = trpc.admin.driverDocuments.useQuery({ status: statusFilter });
  const reviewMutation = trpc.admin.reviewDocument.useMutation({
    onSuccess: () => {
      utils.admin.driverDocuments.invalidate();
    },
  });

  const documents = documentsQuery.data?.documents ?? [];

  const filters: { key: StatusFilter; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all', label: 'All' },
  ];

  const handleApprove = (documentId: string) => {
    reviewMutation.mutate({ documentId, action: 'approve' });
  };

  const openReject = (documentId: string) => {
    setRejectingId(documentId);
    setRejectionReason('');
  };

  const submitReject = () => {
    if (!rejectingId) return;
    reviewMutation.mutate({ documentId: rejectingId, action: 'reject', rejectionReason: rejectionReason.trim() || undefined });
    setRejectingId(null);
    setRejectionReason('');
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#667eea', '#764ba2']} style={[styles.header, { paddingTop: insets.top + 32 }]}>
        <Text style={styles.headerTitle}>Driver Verification</Text>
        <Text style={styles.headerSubtitle}>Review and approve driver documents</Text>
      </LinearGradient>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[styles.filterChip, statusFilter === filter.key && styles.filterChipActive]}
            onPress={() => setStatusFilter(filter.key)}
          >
            <Text style={[styles.filterChipText, statusFilter === filter.key && styles.filterChipTextActive]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {documentsQuery.isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color="#667eea" />
          </View>
        ) : documentsQuery.error ? (
          <View style={styles.centerState}>
            <Text style={styles.errorText}>
              {documentsQuery.error.message.includes('not configured')
                ? 'Admin data is not configured on the server yet.'
                : 'Failed to load documents.'}
            </Text>
          </View>
        ) : documents.length === 0 ? (
          <View style={styles.centerState}>
            <Text style={styles.emptyText}>No documents found</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {documents.map((doc) => {
              const Icon = TYPE_ICONS[doc.type] ?? FileText;
              return (
                <View key={doc.id} style={styles.docCard}>
                  <View style={styles.docHeader}>
                    <View style={styles.docIcon}>
                      <Icon size={20} color="#667eea" />
                    </View>
                    <View style={styles.docInfo}>
                      <Text style={styles.docType}>{TYPE_LABELS[doc.type] ?? doc.type}</Text>
                      <Text style={styles.driverName}>{doc.driverName}</Text>
                      {!!doc.driverEmail && <Text style={styles.driverEmail}>{doc.driverEmail}</Text>}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(doc.status) }]}>
                      <Text style={styles.statusText}>{doc.status}</Text>
                    </View>
                  </View>

                  {doc.signedUrl && (
                    <Image source={{ uri: doc.signedUrl }} style={styles.preview} resizeMode="cover" />
                  )}

                  {doc.rejectionReason && (
                    <Text style={styles.rejectionReason}>Reason: {doc.rejectionReason}</Text>
                  )}

                  {doc.status === 'pending' && (
                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => openReject(doc.id)}
                        disabled={reviewMutation.isPending}
                      >
                        <X size={16} color="#ef4444" />
                        <Text style={styles.rejectButtonText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.approveButton]}
                        onPress={() => handleApprove(doc.id)}
                        disabled={reviewMutation.isPending}
                      >
                        <Check size={16} color="white" />
                        <Text style={styles.approveButtonText}>Approve</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal visible={!!rejectingId} transparent animationType="fade" onRequestClose={() => setRejectingId(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reject Document</Text>
            <Text style={styles.modalSubtitle}>Let the driver know why this document was rejected.</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Reason (optional)"
              placeholderTextColor="#9ca3af"
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.modalCancelButton]} onPress={() => setRejectingId(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalConfirmButton]} onPress={submitReject}>
                <Text style={styles.modalConfirmText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  filtersContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterChipActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  filterChipText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: 'white',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  centerState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
  },
  list: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  docCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  docHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  docIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  docInfo: {
    flex: 1,
  },
  docType: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  driverName: {
    fontSize: 13,
    color: '#374151',
    marginTop: 2,
  },
  driverEmail: {
    fontSize: 12,
    color: '#6b7280',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'white',
    textTransform: 'capitalize',
  },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginTop: 12,
    backgroundColor: '#f3f4f6',
  },
  rejectionReason: {
    marginTop: 10,
    fontSize: 12,
    color: '#ef4444',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  approveButton: {
    backgroundColor: '#10b981',
  },
  approveButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  rejectButton: {
    backgroundColor: '#fee2e2',
  },
  rejectButtonText: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: '100%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 14,
    color: '#1f2937',
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#f3f4f6',
  },
  modalCancelText: {
    color: '#374151',
    fontWeight: '600',
  },
  modalConfirmButton: {
    backgroundColor: '#ef4444',
  },
  modalConfirmText: {
    color: 'white',
    fontWeight: '600',
  },
});
