import { Car } from "lucide-react-native";
import React from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Colors from "@/constants/colors";
import { useRide } from "@/hooks/useRideStore";
import { RideType } from "@/types";

const RideTypeSelector: React.FC = () => {
  const { rideTypes, selectedRideType, setSelectedRideType, estimatedPrice, tierPrices } = useRide();

  const renderItem = ({ item }: { item: RideType }) => {
    const isSelected = selectedRideType === item.id;
    const price = tierPrices[item.id] ?? estimatedPrice;

    return (
      <Pressable
        style={[
          styles.rideTypeItem,
          isSelected && styles.selectedRideTypeItem,
        ]}
        onPress={() => setSelectedRideType(item.id)}
        testID={`ride-type-${item.id}`}
      >
        <View style={styles.iconContainer}>
          <Car
            size={24}
            color={isSelected ? Colors.light.primary : Colors.light.secondary}
          />
        </View>
        <View style={styles.rideTypeInfo}>
          <Text style={styles.rideTypeName}>{item.name}</Text>
          <Text style={styles.rideTypeDescription}>{item.description}</Text>
        </View>
        <View style={styles.priceContainer}>
          <Text style={styles.price}>₦{price}</Text>
          <Text style={styles.eta}>{item.eta} min</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Ride</Text>
      <FlatList
        data={rideTypes}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  rideTypeItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  selectedRideTypeItem: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.primaryLight,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.lightGray,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  rideTypeInfo: {
    flex: 1,
  },
  rideTypeName: {
    fontSize: 16,
    fontWeight: "500",
  },
  rideTypeDescription: {
    fontSize: 12,
    color: Colors.light.gray,
    marginTop: 2,
  },
  priceContainer: {
    alignItems: "flex-end",
  },
  price: {
    fontSize: 16,
    fontWeight: "600",
  },
  eta: {
    fontSize: 12,
    color: Colors.light.gray,
    marginTop: 2,
  },
});

export default RideTypeSelector;