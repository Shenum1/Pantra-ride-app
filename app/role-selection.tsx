import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import Colors from '@/constants/colors';
import { useVideoConfig } from '@/hooks/useVideoConfig';

const { width, height } = Dimensions.get('window');

export default function RoleSelectionScreen() {
  const handleRoleSelection = (role: 'user' | 'driver') => {
    if (role === 'driver') {
      router.push('/driver-login');
    } else {
      router.push('/login');
    }
  };

  const videoUri = useVideoConfig('role_selection');
  const player = useVideoPlayer(videoUri, (p) => { p.loop = true; p.muted = true; p.play(); });
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status }: any) => {
      if (status === 'error') setVideoFailed(true);
    });
    return () => sub.remove();
  }, [player]);

  return (
    <View style={styles.container}>
      {!videoFailed && (
        <VideoView
          player={player}
          style={styles.backgroundVideo}
          contentFit="cover"
          nativeControls={false}
        />
      )}
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Welcome to Pantra</Text>
            <Text style={styles.subtitle}>Choose how you want to continue</Text>
          </View>

          <View style={styles.roleContainer}>
            <Pressable
              style={styles.roleCard}
              onPress={() => handleRoleSelection('user')}
              testID="user-role-button"
            >
              <Text style={styles.roleTitle}>Rider</Text>
            </Pressable>

            <Pressable
              style={styles.roleCard}
              onPress={() => handleRoleSelection('driver')}
              testID="driver-role-button"
            >
              <Text style={styles.roleTitle}>Driver</Text>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By continuing, you agree to our Terms of Service and Privacy Policy
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.black,
  },
  backgroundVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    width,
    height,
    zIndex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width,
    height,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 2,
  },
  safeArea: {
    flex: 1,
    zIndex: 3,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
    justifyContent: 'flex-start',
  },
  header: {
    alignItems: 'center',
    marginTop: 64,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.light.white,
    marginBottom: 8,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 'auto',
    marginBottom: 24,
  },
  roleCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  roleTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.light.text,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});