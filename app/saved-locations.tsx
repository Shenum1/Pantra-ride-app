import React from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Home, Briefcase, MapPin, Plus, Trash2, Edit2 } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useSavedLocations } from '@/hooks/useSavedLocationsStore';
import { SavedLocation } from '@/types';

export default function SavedLocationsScreen() {
  const router = useRouter();
  const { savedLocations, removeSavedLocation } = useSavedLocations();

  const handleAddLocation = () => {
    router.push('/add-location');
  };

  const handleEditLocation = (location: SavedLocation) => {
    router.push({
      pathname: '/add-location',
      params: {
        id: location.id,
        type: location.type,
        edit: "true"
      }
    });
  };

  const handleRemoveLocation = (id: string) => {
    Alert.alert(
      'Remove Location',
      'Are you sure you want to remove this saved location?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: () => removeSavedLocation(id)
        },
      ]
    );
  };

  const getLocationIcon = (type: string) => {
    switch (type) {
      case 'home':
        return <Home size={20} color={Colors.light.text} />;
      case 'work':
        return <Briefcase size={20} color={Colors.light.text} />;
      default:
        return <MapPin size={20} color={Colors.light.text} />;
    }
  };

  const getLocationTitle = (type: string) => {
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
        title: 'Saved Locations',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: Colors.light.background },
      }} />

      <ScrollView style={styles.content}>
        {savedLocations.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Your saved locations</Text>
            
            {savedLocations.map(location => (
              <View key={location.id} style={styles.locationCard}>
                <View style={styles.locationHeader}>
                  <View style={styles.iconContainer}>
                    {getLocationIcon(location.type)}
                  </View>
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationType}>{getLocationTitle(location.type)}</Text>
                    <Text style={styles.locationAddress}>{location.address}</Text>
                  </View>
                </View>
                
                <View style={styles.locationActions}>
                  <Pressable 
                    style={styles.actionButton}
                    onPress={() => handleEditLocation(location)}
                    testID={`edit-location-${location.id}`}
                  >
                    <Edit2 size={18} color={Colors.light.primary} />
                    <Text style={styles.actionText}>Edit</Text>
                  </Pressable>
                  
                  <Pressable 
                    style={styles.actionButton}
                    onPress={() => handleRemoveLocation(location.id)}
                    testID={`remove-location-${location.id}`}
                  >
                    <Trash2 size={18} color={Colors.light.danger} />
                    <Text style={[styles.actionText, { color: Colors.light.danger }]}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        ) : (
          <View style={styles.emptyState}>
            <MapPin size={48} color={Colors.light.gray} />
            <Text style={styles.emptyTitle}>No saved locations</Text>
            <Text style={styles.emptyText}>
              Save your frequent destinations for quicker ride booking
            </Text>
          </View>
        )}

        <Pressable 
          style={styles.addButton}
          onPress={handleAddLocation}
          testID="add-location-button"
        >
          <Plus size={20} color={Colors.light.primary} />
          <Text style={styles.addButtonText}>Add new location</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

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
  locationCard: {
    backgroundColor: Colors.light.white,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.lightGray,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationInfo: {
    flex: 1,
  },
  locationType: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  locationAddress: {
    fontSize: 14,
    color: Colors.light.gray,
    marginTop: 2,
  },
  locationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.lightGray,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
    padding: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.primary,
    marginLeft: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.light.gray,
    textAlign: 'center',
    marginHorizontal: 32,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.white,
    marginTop: 8,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    borderStyle: 'dashed',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.primary,
    marginLeft: 8,
  },
});