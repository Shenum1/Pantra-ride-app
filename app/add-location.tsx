import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TextInput, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Home, Briefcase, MapPin } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useSavedLocations } from '@/hooks/useSavedLocationsStore';
import Button from '@/components/Button';
import { SavedLocation } from '@/types';

export default function AddLocationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string; id?: string; edit?: string }>();
  const { savedLocations, addSavedLocation, updateSavedLocation } = useSavedLocations();
  
  const [locationType, setLocationType] = useState<string>(params.type || 'custom');
  const [locationName, setLocationName] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const isEditing = params.edit === 'true';
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (params.id && params.edit === 'true') {
      const location = savedLocations.find(loc => loc.id === params.id);
      if (location) {
        setLocationType(location.type);
        setLocationName(location.name || '');
        setAddress(location.address);
      }
    }
  }, [params.id, params.edit, savedLocations]);

  const handleSave = () => {
    if (!address.trim()) {
      Alert.alert('Error', 'Please enter an address');
      return;
    }

    setIsSubmitting(true);

    try {
      const locationData: Omit<SavedLocation, 'id'> = {
        type: locationType === 'custom' ? 'favorite' : (locationType as 'home' | 'work' | 'favorite'),
        name: locationName.trim() || getDefaultName(locationType),
        address: address.trim(),
        latitude: 37.7749, // In a real app, these would come from geocoding the address
        longitude: -122.4194,
      };

      if (isEditing && params.id) {
        updateSavedLocation(params.id, locationData);
        Alert.alert('Success', 'Location updated successfully');
      } else {
        addSavedLocation(
          { latitude: locationData.latitude, longitude: locationData.longitude },
          locationData.address,
          locationData.name,
          locationData.type
        );
        Alert.alert('Success', 'Location added successfully');
      }

      router.back();
    } catch (error) {
      console.error('Error saving location:', error);
      Alert.alert('Error', 'Failed to save location');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDefaultName = (type: string): string => {
    switch (type) {
      case 'home':
        return 'Home';
      case 'work':
        return 'Work';
      default:
        return 'Saved Location';
    }
  };



  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ 
        title: isEditing ? 'Edit Location' : 'Add Location',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: Colors.light.background },
      }} />

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Location type</Text>
        
        <View style={styles.typeContainer}>
          <Pressable 
            style={[
              styles.typeButton, 
              locationType === 'home' && styles.selectedTypeButton
            ]}
            onPress={() => setLocationType('home')}
            testID="home-type-button"
          >
            <View style={[
              styles.typeIconContainer,
              locationType === 'home' && { backgroundColor: Colors.light.primary }
            ]}>
              <Home size={20} color={locationType === 'home' ? Colors.light.white : Colors.light.text} />
            </View>
            <Text style={[
              styles.typeText,
              locationType === 'home' && styles.selectedTypeText
            ]}>Home</Text>
          </Pressable>
          
          <Pressable 
            style={[
              styles.typeButton, 
              locationType === 'work' && styles.selectedTypeButton
            ]}
            onPress={() => setLocationType('work')}
            testID="work-type-button"
          >
            <View style={[
              styles.typeIconContainer,
              locationType === 'work' && { backgroundColor: Colors.light.primary }
            ]}>
              <Briefcase size={20} color={locationType === 'work' ? Colors.light.white : Colors.light.text} />
            </View>
            <Text style={[
              styles.typeText,
              locationType === 'work' && styles.selectedTypeText
            ]}>Work</Text>
          </Pressable>
          
          <Pressable 
            style={[
              styles.typeButton, 
              locationType === 'custom' && styles.selectedTypeButton
            ]}
            onPress={() => setLocationType('custom')}
            testID="custom-type-button"
          >
            <View style={[
              styles.typeIconContainer,
              locationType === 'custom' && { backgroundColor: Colors.light.primary }
            ]}>
              <MapPin size={20} color={locationType === 'custom' ? Colors.light.white : Colors.light.text} />
            </View>
            <Text style={[
              styles.typeText,
              locationType === 'custom' && styles.selectedTypeText
            ]}>Custom</Text>
          </Pressable>
        </View>

        {locationType === 'custom' && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Location name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter a name for this location"
              value={locationName}
              onChangeText={setLocationName}
              testID="location-name-input"
            />
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Address</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter address"
            value={address}
            onChangeText={setAddress}
            multiline
            testID="address-input"
          />
        </View>

        <Text style={styles.note}>
          Note: In a real app, this would include address autocomplete and map selection
        </Text>
      </ScrollView>

      <View style={styles.buttonContainer}>
        <Button 
          title={isEditing ? "Update Location" : "Save Location"} 
          onPress={handleSave} 
          loading={isSubmitting}
          disabled={isSubmitting || !address.trim()}
          testID="save-location-button"
        />
      </View>
    </SafeAreaView>
  );
}

const Pressable = ({ style, onPress, children, testID }: any) => {
  return (
    <View style={style} testID={testID}>
      <Text onPress={onPress}>{children}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 12,
  },
  typeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  typeButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.light.white,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.lightGray,
    marginHorizontal: 4,
  },
  selectedTypeButton: {
    borderColor: Colors.light.primary,
    borderWidth: 2,
  },
  typeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
  },
  selectedTypeText: {
    color: Colors.light.primary,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.light.white,
    borderWidth: 1,
    borderColor: Colors.light.lightGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 48,
  },
  note: {
    fontSize: 14,
    fontStyle: 'italic',
    color: Colors.light.gray,
    marginTop: 8,
  },
  buttonContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.lightGray,
  },
});