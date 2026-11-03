import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { useTheme } from '@/hooks/useThemeStore';
import { LOCATION_DISCLOSURE_TEXT } from '@/lib/driver-location-policy';

// Google Play's prominent disclosure for background location. Must be shown,
// and accepted, before any native location prompt is triggered for a driver.
export default function LocationDisclosureModal({
  visible,
  onAccept,
  onDeny,
}: {
  visible: boolean;
  onAccept: () => void;
  onDeny: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDeny}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={[styles.iconContainer, { backgroundColor: colors.primaryLight }]}>
            <MapPin size={28} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Location access</Text>
          <Text style={[styles.body, { color: colors.text }]} testID="location-disclosure-text">
            {LOCATION_DISCLOSURE_TEXT}
          </Text>
          <Text style={[styles.fineprint, { color: colors.textSecondary }]}>
            While this is on, a notification shows that Pantra is using your location. It stops when you go
            offline or your trip ends.
          </Text>

          <Pressable
            style={[styles.acceptButton, { backgroundColor: colors.primary }]}
            onPress={onAccept}
            testID="location-disclosure-accept"
          >
            <Text style={[styles.acceptText, { color: colors.white }]}>Accept & Continue</Text>
          </Pressable>

          <Pressable style={styles.denyButton} onPress={onDeny} testID="location-disclosure-deny">
            <Text style={[styles.denyText, { color: colors.textSecondary }]}>Deny</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 12,
  },
  fineprint: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  acceptButton: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptText: {
    fontSize: 16,
    fontWeight: '600',
  },
  denyButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  denyText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
