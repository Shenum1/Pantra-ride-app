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
  Pressable,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { Eye, EyeOff, ArrowLeft, CheckSquare, Square } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
import { useDriverAuth } from '@/hooks/useDriverAuthStore';
import { useTermsStore } from '@/hooks/useTermsStore';
import Button from '@/components/Button';
import Colors from '@/constants/colors';

const { width, height } = Dimensions.get('window');

export default function DriverSignupScreen() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    driverLicense: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    licensePlate: '',
    vehicleColor: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const { signup, isLoading } = useDriverAuth();
  const { acceptTerms } = useTermsStore();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSignup = async () => {
    const {
      name,
      email,
      phone,
      password,
      confirmPassword,
      driverLicense,
      vehicleMake,
      vehicleModel,
      vehicleYear,
      licensePlate,
      vehicleColor,
    } = formData;

    if (!name || !email || !phone || !password || !confirmPassword || 
        !driverLicense || !vehicleMake || !vehicleModel || !vehicleYear || 
        !licensePlate || !vehicleColor) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!acceptedTerms) {
      Alert.alert('Error', 'Please accept the Terms and Conditions and Privacy Policy to continue');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    const year = parseInt(vehicleYear);
    if (isNaN(year) || year < 1990 || year > new Date().getFullYear()) {
      Alert.alert('Error', 'Please enter a valid vehicle year');
      return;
    }

    try {
      await acceptTerms();
      await signup(
        name,
        email,
        phone,
        password,
        driverLicense,
        {
          make: vehicleMake,
          model: vehicleModel,
          year,
          licensePlate,
          color: vehicleColor,
        }
      );
      Alert.alert(
        'Registration Successful',
        'Your driver account has been created. Please wait for verification.',
        [{ text: 'OK', onPress: () => router.replace('/') }]
      );
    } catch {
      Alert.alert('Registration Failed', 'Please try again');
    }
  };

  return (
    <View style={styles.container}>
      <Video
        source={{
          uri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
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
            <View style={styles.backButton}>
              <Pressable
                onPress={() => router.back()}
                style={styles.backButtonInner}
              >
                <ArrowLeft size={24} color={Colors.light.white} />
              </Pressable>
            </View>

            <View style={styles.header}>
              <Text style={styles.title}>Become a Driver</Text>
              <Text style={styles.subtitle}>Start earning with us today</Text>
            </View>

            <View style={styles.form}>
              <Text style={styles.sectionTitle}>Personal Information</Text>
              
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={(value) => handleInputChange('name', value)}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  testID="driver-name-input"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={formData.email}
                  onChangeText={(value) => handleInputChange('email', value)}
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  testID="driver-email-input"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={formData.phone}
                  onChangeText={(value) => handleInputChange('phone', value)}
                  placeholder="Enter your phone number"
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  testID="driver-phone-input"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Driver License Number</Text>
                <TextInput
                  style={styles.input}
                  value={formData.driverLicense}
                  onChangeText={(value) => handleInputChange('driverLicense', value)}
                  placeholder="Enter your driver license number"
                  autoCapitalize="characters"
                  testID="driver-license-input"
                />
              </View>

              <Text style={styles.sectionTitle}>Vehicle Information</Text>

              <View style={styles.row}>
                <View style={[styles.inputContainer, styles.halfWidth]}>
                  <Text style={styles.label}>Make</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.vehicleMake}
                    onChangeText={(value) => handleInputChange('vehicleMake', value)}
                    placeholder="Toyota"
                    testID="vehicle-make-input"
                  />
                </View>

                <View style={[styles.inputContainer, styles.halfWidth]}>
                  <Text style={styles.label}>Model</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.vehicleModel}
                    onChangeText={(value) => handleInputChange('vehicleModel', value)}
                    placeholder="Camry"
                    testID="vehicle-model-input"
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputContainer, styles.halfWidth]}>
                  <Text style={styles.label}>Year</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.vehicleYear}
                    onChangeText={(value) => handleInputChange('vehicleYear', value)}
                    placeholder="2020"
                    keyboardType="numeric"
                    testID="vehicle-year-input"
                  />
                </View>

                <View style={[styles.inputContainer, styles.halfWidth]}>
                  <Text style={styles.label}>Color</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.vehicleColor}
                    onChangeText={(value) => handleInputChange('vehicleColor', value)}
                    placeholder="Silver"
                    testID="vehicle-color-input"
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>License Plate</Text>
                <TextInput
                  style={styles.input}
                  value={formData.licensePlate}
                  onChangeText={(value) => handleInputChange('licensePlate', value)}
                  placeholder="ABC-123"
                  autoCapitalize="characters"
                  testID="license-plate-input"
                />
              </View>

              <Text style={styles.sectionTitle}>Security</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    value={formData.password}
                    onChangeText={(value) => handleInputChange('password', value)}
                    placeholder="Enter your password"
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                    testID="driver-password-input"
                  />
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                  >
                    {showPassword ? (
                      <EyeOff size={20} color={Colors.light.gray} />
                    ) : (
                      <Eye size={20} color={Colors.light.gray} />
                    )}
                  </Pressable>
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    value={formData.confirmPassword}
                    onChangeText={(value) => handleInputChange('confirmPassword', value)}
                    placeholder="Confirm your password"
                    secureTextEntry={!showConfirmPassword}
                    autoComplete="password"
                    testID="driver-confirm-password-input"
                  />
                  <Pressable
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeButton}
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={20} color={Colors.light.gray} />
                    ) : (
                      <Eye size={20} color={Colors.light.gray} />
                    )}
                  </Pressable>
                </View>
              </View>

              <Pressable
                style={styles.termsContainer}
                onPress={() => setAcceptedTerms(!acceptedTerms)}
              >
                {acceptedTerms ? (
                  <CheckSquare size={24} color={Colors.light.primary} />
                ) : (
                  <Square size={24} color="rgba(255, 255, 255, 0.8)" />
                )}
                <Text style={styles.termsText}>
                  I agree to the{' '}
                  <Text
                    style={styles.termsLink}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push('/terms-and-conditions');
                    }}
                  >
                    Terms and Conditions
                  </Text>
                  {' '}and{' '}
                  <Text
                    style={styles.termsLink}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push('/privacy-policy');
                    }}
                  >
                    Privacy Policy
                  </Text>
                </Text>
              </Pressable>

              <Button
                title={isLoading ? '' : 'Create Driver Account'}
                onPress={handleSignup}
                disabled={isLoading}
                loading={isLoading}
                style={styles.signupButton}
              />

              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  Already have a driver account?{' '}
                  <Link href="/driver-login" style={styles.link}>
                    <Text style={styles.linkText}>Sign in</Text>
                  </Link>
                </Text>
              </View>
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
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 24,
    zIndex: 10,
  },
  backButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 80,
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
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  form: {
    width: '100%',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.white,
    marginBottom: 16,
    marginTop: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  inputContainer: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: Colors.light.black,
  },
  eyeButton: {
    paddingHorizontal: 16,
  },
  signupButton: {
    marginTop: 24,
    marginBottom: 32,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  link: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
  linkText: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    marginTop: 8,
    gap: 12,
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.8)',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  termsLink: {
    color: Colors.light.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});