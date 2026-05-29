import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuthStore';
import { useDriverAuth } from '@/hooks/useDriverAuthStore';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
} from 'react-native';
import { useTheme } from '@/hooks/useThemeStore';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPinned, Sparkles } from 'lucide-react-native';

const SPLASH_MIN_DURATION_MS = 2600;
const SPLASH_VIDEO_URI = 'https://videos.pexels.com/video-files/854118/854118-hd_1920_1080_25fps.mp4';

export default function Index() {
  const { isAuthenticated: userAuthenticated, isLoading: userLoading, user } = useAuth();
  const { isAuthenticated: driverAuthenticated, isLoading: driverLoading } = useDriverAuth();
  const { colors } = useTheme();
  const [isSplashReady, setIsSplashReady] = useState<boolean>(false);
  const [videoFailed, setVideoFailed] = useState<boolean>(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  const statusText = useMemo(() => {
    if (userLoading || driverLoading) {
      return 'Preparing your ride experience';
    }

    if (driverAuthenticated) {
      return 'Opening driver dashboard';
    }

    if (userAuthenticated) {
      return 'Getting your trip ready';
    }

    return 'Launching your next ride';
  }, [driverAuthenticated, driverLoading, userAuthenticated, userLoading]);

  useEffect(() => {
    console.log('Index: Starting splash entrance animation');

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: 1,
            duration: 2200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 2200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ),
    ]).start();

    const splashTimer = setTimeout(() => {
      console.log('Index: Minimum splash duration completed');
      setIsSplashReady(true);
    }, SPLASH_MIN_DURATION_MS);

    return () => {
      clearTimeout(splashTimer);
    };
  }, [fadeAnim, floatAnim]);

  useEffect(() => {
    console.log('Index: Checking authentication state', {
      userAuthenticated,
      driverAuthenticated,
      userLoading,
      driverLoading,
      hasProfileImage: !!user?.profileImage,
      isSplashReady,
      videoFailed,
    });

    if (userLoading || driverLoading || !isSplashReady) {
      console.log('Index: Waiting for auth loading or splash completion');
      return;
    }

    const timer = setTimeout(() => {
      if (driverAuthenticated) {
        console.log('Index: Driver authenticated, navigating to driver dashboard');
        router.replace('/(driver-tabs)/dashboard');
      } else if (userAuthenticated) {
        console.log('Index: User authenticated, navigating to home');
        router.replace('/(tabs)/home');
      } else {
        console.log('Index: No authentication, navigating to role selection');
        router.replace('/role-selection');
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [driverAuthenticated, driverLoading, isSplashReady, user, userAuthenticated, userLoading, videoFailed]);

  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  return (
    <View style={styles.container} testID="startup-splash-screen">
      {!videoFailed ? (
        <Video
          source={{ uri: SPLASH_VIDEO_URI }}
          style={styles.videoBackground}
          shouldPlay
          isLooping
          isMuted
          resizeMode={ResizeMode.COVER}
          onLoadStart={() => {
            console.log('Index: Splash video loading started');
          }}
          onLoad={() => {
            console.log('Index: Splash video loaded successfully');
          }}
          onError={(error) => {
            console.log('Index: Splash video failed to load', error);
            setVideoFailed(true);
          }}
        />
      ) : null}

      <LinearGradient
        colors={videoFailed ? ['#07111F', '#102544', '#1E3A5F'] : ['rgba(3,10,22,0.22)', 'rgba(7,17,31,0.82)', 'rgba(4,9,18,0.96)']}
        style={styles.overlay}
      >
        <SafeAreaView style={styles.safeArea}>
          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY }],
              },
            ]}
          >
            <View style={styles.badge} testID="startup-splash-badge">
              <Sparkles size={14} color="#EAF2FF" />
              <Text style={styles.badgeText}>Premium city rides</Text>
            </View>

            <View style={styles.brandBlock}>
              <View style={styles.logoWrap}>
                <MapPinned size={26} color="#FFFFFF" />
              </View>
              <Text style={styles.title}>Move beautifully</Text>
              <Text style={styles.subtitle}>
                Real-time rides, smoother pickup, elegant trip flow.
              </Text>
            </View>

            <View style={styles.bottomCard} testID="startup-splash-card">
              <View style={styles.bottomRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.statusText}>{statusText}</Text>
              </View>
              <Text style={styles.helperText}>
                {videoFailed
                  ? 'Optimized visual mode enabled for this device.'
                  : 'Streaming cinematic intro and preparing your session.'}
              </Text>
              {!userAuthenticated && !driverAuthenticated ? (
                <Pressable
                  onPress={() => {
                    console.log('Index: Skip intro pressed');
                    setIsSplashReady(true);
                  }}
                  style={styles.skipButton}
                  testID="startup-splash-skip"
                >
                  <Text style={styles.skipText}>Skip intro</Text>
                </Pressable>
              ) : null}
            </View>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09111D',
  },
  videoBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 24,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  badgeText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },
  brandBlock: {
    paddingTop: 16,
  },
  logoWrap: {
    width: 62,
    height: 62,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 22,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '800',
    letterSpacing: -1.4,
    maxWidth: 240,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 14,
    maxWidth: 290,
  },
  bottomCard: {
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: 'rgba(8,15,28,0.56)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 12,
    flex: 1,
  },
  helperText: {
    color: 'rgba(226,232,240,0.78)',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
  },
  skipButton: {
    marginTop: 14,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  skipText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },
});
