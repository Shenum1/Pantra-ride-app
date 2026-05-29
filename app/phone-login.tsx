import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import { useAuth } from '@/hooks/useAuthStore';
import Button from '@/components/Button';
import Colors from '@/constants/colors';

const { width, height } = Dimensions.get('window');

export default function PhoneLoginScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const { loginWithPhone, verifyPhoneCode, isLoading } = useAuth();

  const handleSendCode = async () => {
    if (!phoneNumber) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }

    if (phoneNumber.length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    try {
      console.log('Phone Login: Sending verification code...');
      await loginWithPhone(phoneNumber);
      setCodeSent(true);
      Alert.alert('Success', 'Verification code sent! Use 123456 for testing.');
    } catch (error) {
      console.error('Phone Login: Send code failed:', error);
      Alert.alert('Error', 'Failed to send verification code');
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }

    if (verificationCode.length !== 6) {
      Alert.alert('Error', 'Verification code must be 6 digits');
      return;
    }

    try {
      console.log('Phone Login: Verifying code...');
      await verifyPhoneCode(verificationCode);
      console.log('Phone Login: Verification successful, navigating to home');
      router.replace('/');
    } catch (error) {
      console.error('Phone Login: Verification failed:', error);
      Alert.alert('Error', 'Invalid verification code. Try 123456 for testing.');
    }
  };

  return (
    <View style={styles.container}>
      <Video
        source={{
          uri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        }}
        style={styles.backgroundVideo}
        shouldPlay
        isLooping
        isMuted
        resizeMode={ResizeMode.COVER}
      />
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <Text style={styles.title}>Phone Login</Text>
              <Text style={styles.subtitle}>
                {codeSent
                  ? 'Enter the verification code sent to your phone'
                  : 'Enter your phone number to receive a verification code'}
              </Text>
            </View>

            <View style={styles.form}>
              {!codeSent ? (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Phone Number</Text>
                    <TextInput
                      style={styles.input}
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      placeholder="+1 234 567 8900"
                      keyboardType="phone-pad"
                      autoComplete="tel"
                      testID="phone-input"
                    />
                  </View>

                  <Button
                    title={isLoading ? '' : 'Send Code'}
                    onPress={handleSendCode}
                    disabled={isLoading}
                    loading={isLoading}
                    style={styles.button}
                  />
                </>
              ) : (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Verification Code</Text>
                    <TextInput
                      style={styles.input}
                      value={verificationCode}
                      onChangeText={setVerificationCode}
                      placeholder="123456"
                      keyboardType="number-pad"
                      maxLength={6}
                      testID="code-input"
                    />
                  </View>

                  <Button
                    title={isLoading ? '' : 'Verify Code'}
                    onPress={handleVerifyCode}
                    disabled={isLoading}
                    loading={isLoading}
                    style={styles.button}
                  />

                  <Button
                    title="Resend Code"
                    onPress={handleSendCode}
                    disabled={isLoading}
                    variant="secondary"
                    style={styles.resendButton}
                  />
                </>
              )}

              <Button
                title="Back to Login"
                onPress={() => router.back()}
                variant="secondary"
                style={styles.backButton}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 2,
  },
  safeArea: {
    flex: 1,
    zIndex: 3,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.light.white,
    marginBottom: 8,
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
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.white,
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    color: Colors.light.black,
  },
  button: {
    marginTop: 8,
    marginBottom: 16,
  },
  resendButton: {
    marginBottom: 16,
  },
  backButton: {
    marginTop: 8,
  },
});
