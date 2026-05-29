import { User, Mail, Phone, Calendar, MapPin, Camera } from "lucide-react-native";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
  Image,
} from "react-native";
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/useAuthStore";
import { useTheme } from "@/hooks/useThemeStore";
import { Stack } from "expo-router";

interface InfoFieldProps {
  icon: React.ReactElement;
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  editable?: boolean;
}

const InfoField: React.FC<InfoFieldProps> = ({ 
  icon, 
  label, 
  value, 
  onChangeText, 
  placeholder,
  editable = true 
}) => {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.fieldContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.fieldHeader}>
        <Text>{icon}</Text>
        <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>
      </View>
      <TextInput
        style={[
          styles.fieldInput,
          { 
            color: colors.text,
            backgroundColor: editable ? colors.background : colors.lightGray
          }
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.gray}
        editable={editable}
      />
    </View>
  );
};

export default function PersonalInfoScreen() {
  const { user, updateProfile } = useAuth();
  const { colors } = useTheme();
  
  const [name, setName] = useState(user?.name || 'Kelvin Johnson');
  const [email, setEmail] = useState(user?.email || 'kelvin.johnson@email.com');
  const [phone, setPhone] = useState(user?.phone || '+1 (555) 123-4567');
  const [dateOfBirth, setDateOfBirth] = useState('January 15, 1990');
  const [address, setAddress] = useState('123 Main Street, New York, NY 10001');
  const [profileImage, setProfileImage] = useState(user?.profileImage || '');
  
  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Please allow access to your photo library to upload a profile photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Please allow access to your camera to take a profile photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const handleChangePhoto = () => {
    Alert.alert(
      'Change Profile Photo',
      'Choose an option',
      [
        { text: 'Take Photo', onPress: handleTakePhoto },
        { text: 'Choose from Library', onPress: handlePickImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };
  
  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    try {
      await updateProfile({
        name,
        email,
        phone,
        profileImage,
      });
      
      Alert.alert(
        'Success',
        'Your personal information has been updated.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save changes. Please try again.');
    }
  };
  
  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Personal Info',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
        }} 
      />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["bottom"]}>
        <ScrollView style={styles.content}>
          <View style={styles.avatarSection}>
            <View style={styles.avatarContainer}>
              {profileImage ? (
                <Image 
                  source={{ uri: profileImage }} 
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.lightGray }]}>
                  <User size={40} color={colors.gray} />
                </View>
              )}
              <Pressable 
                style={[styles.cameraButton, { backgroundColor: colors.primary }]}
                onPress={handleChangePhoto}
              >
                <Camera size={20} color={colors.white} />
              </Pressable>
            </View>
            <Pressable 
              style={[styles.changePhotoButton, { backgroundColor: colors.primary }]}
              onPress={handleChangePhoto}
            >
              <Text style={[styles.changePhotoText, { color: colors.white }]}>
                {profileImage ? 'Change Photo' : 'Add Photo (Optional)'}
              </Text>
            </Pressable>
          </View>
          
          <View style={styles.fieldsContainer}>
            <InfoField
              icon={<User size={20} color={colors.text} />}
              label="Full Name"
              value={name}
              onChangeText={setName}
              placeholder="Enter your full name"
            />
            
            <InfoField
              icon={<Mail size={20} color={colors.text} />}
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
            />
            
            <InfoField
              icon={<Phone size={20} color={colors.text} />}
              label="Phone Number"
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter your phone number"
            />
            
            <InfoField
              icon={<Calendar size={20} color={colors.text} />}
              label="Date of Birth"
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              placeholder="Select date of birth"
            />
            
            <InfoField
              icon={<MapPin size={20} color={colors.text} />}
              label="Address"
              value={address}
              onChangeText={setAddress}
              placeholder="Enter your address"
            />
          </View>
          
          <Pressable 
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={handleSave}
          >
            <Text style={[styles.saveButtonText, { color: colors.white }]}>Save Changes</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  requiredText: {
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
  },
  changePhotoButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  changePhotoText: {
    fontSize: 14,
    fontWeight: '600',
  },
  fieldsContainer: {
    gap: 16,
    marginBottom: 32,
  },
  fieldContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  fieldInput: {
    fontSize: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 32,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
