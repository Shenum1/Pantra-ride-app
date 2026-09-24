import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { Camera, CheckCircle2, ImageIcon, RefreshCw, AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/hooks/useThemeStore';
import { useDriverAuth } from '@/hooks/useDriverAuthStore';
import { useDriverVerification } from '@/hooks/useDriverVerification';
import { StorageService } from '@/lib/storage-service';
import { DOCUMENT_TYPE_LABELS, type RequiredDocumentType } from '@/lib/driver-verification-config';

interface Props {
  type: RequiredDocumentType;
  hint?: string;
  // Profile photo: front camera only, no gallery.
  faceOnly?: boolean;
  disabled?: boolean;
}

// One photo slot in the registration wizard. The photo uploads to the private
// documents bucket and is recorded with the server the moment it is taken, so a
// captured slot survives closing the app — its state is read back from the server
// (status.submittedDocuments), the local preview is only a convenience.
export default function DocumentCaptureCard({ type, hint, faceOnly = false, disabled = false }: Props) {
  const { colors } = useTheme();
  const { driver, updateProfileImage } = useDriverAuth();
  const { status, submitDocument } = useDriverVerification();
  const [isUploading, setIsUploading] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const submitted = status?.submittedDocuments?.find((doc) => doc.type === type);
  const isRejected = submitted?.status === 'rejected';
  const isDone = !!submitted && !isRejected;

  const pick = async (source: 'camera' | 'gallery') => {
    if (disabled || isUploading || !driver?.id) return;

    // Web has no camera-permission flow; the picker opens the browser's file/camera chooser.
    const useCamera = source === 'camera' && Platform.OS !== 'web';
    if (useCamera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Toast.show({ type: 'error', text1: 'Permission required', text2: 'Camera access is needed to take this photo.', position: 'top' });
        return;
      }
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          quality: 0.8,
          ...(faceOnly ? { cameraType: ImagePicker.CameraType.front } : {}),
        })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;

    const uri = result.assets[0].uri;
    setPreviewUri(uri);
    setIsUploading(true);
    try {
      const storagePath = await StorageService.uploadPrivateFile(uri, `drivers/${driver.id}/${type}_${Date.now()}`);
      await submitDocument({ type, storagePath });
      // The profile photo doubles as the picture riders see. A failure here must not
      // undo the verification upload, so it is reported but not thrown.
      if (type === 'driver_selfie') {
        try {
          await updateProfileImage(uri);
        } catch {
          console.warn('DocumentCaptureCard: could not set the public profile image');
        }
      }
    } catch (error: any) {
      setPreviewUri(null);
      Toast.show({ type: 'error', text1: 'Upload failed', text2: error?.message ?? 'Please try again.', position: 'top' });
    } finally {
      setIsUploading(false);
    }
  };

  const showCameraButton = true;
  const showGalleryButton = !faceOnly;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: isRejected ? colors.error : 'transparent' }]}>
      <View style={styles.header}>
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={styles.thumbnail} />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailEmpty, { borderColor: colors.border }]}>
            <Camera size={22} color={colors.textSecondary} />
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>{DOCUMENT_TYPE_LABELS[type]}</Text>
          {hint ? <Text style={[styles.hint, { color: colors.textSecondary }]}>{hint}</Text> : null}
        </View>
        {isUploading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : isDone ? (
          <CheckCircle2 size={20} color={colors.success} />
        ) : isRejected ? (
          <AlertCircle size={20} color={colors.error} />
        ) : null}
      </View>

      {isRejected && (
        <Text style={[styles.rejection, { color: colors.error }]}>
          Rejected{submitted?.rejectionReason ? `: ${submitted.rejectionReason}` : '.'} Please retake this photo.
        </Text>
      )}
      {isDone && !isRejected && (
        <Text style={[styles.statusLine, { color: colors.textSecondary }]}>
          {submitted?.status === 'approved' ? 'Approved' : 'Submitted, awaiting review'}
        </Text>
      )}

      <View style={styles.actions}>
        {showCameraButton && (
          <TouchableOpacity
            style={[styles.actionButton, { borderColor: colors.border }, (disabled || isUploading) && styles.disabled]}
            onPress={() => pick('camera')}
            disabled={disabled || isUploading}
            testID={`capture-${type}-camera`}
          >
            {isDone || isRejected ? <RefreshCw size={16} color={colors.text} /> : <Camera size={16} color={colors.text} />}
            <Text style={[styles.actionText, { color: colors.text }]}>{isDone || isRejected ? 'Retake' : 'Take photo'}</Text>
          </TouchableOpacity>
        )}
        {showGalleryButton && (
          <TouchableOpacity
            style={[styles.actionButton, { borderColor: colors.border }, (disabled || isUploading) && styles.disabled]}
            onPress={() => pick('gallery')}
            disabled={disabled || isUploading}
            testID={`capture-${type}-gallery`}
          >
            <ImageIcon size={16} color={colors.text} />
            <Text style={[styles.actionText, { color: colors.text }]}>Choose from gallery</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 16, gap: 10, borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600' },
  hint: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  thumbnail: { width: 52, height: 52, borderRadius: 8 },
  thumbnailEmpty: { borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  rejection: { fontSize: 12, lineHeight: 16 },
  statusLine: { fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionText: { fontSize: 13, fontWeight: '500' },
  disabled: { opacity: 0.5 },
});
