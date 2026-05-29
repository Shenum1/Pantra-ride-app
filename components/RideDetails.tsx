import { Clock, MapPin } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";
import { useLocation } from "@/hooks/useLocationStore";
import { useRide } from "@/hooks/useRideStore";

const RideDetails: React.FC = () => {
  const { pickupAddress, dropoffAddress } = useLocation();
  const { estimatedDistance, estimatedDuration, estimatedPrice } = useRide();

  return (
    <View style={styles.container}>
      <View style={styles.addressesContainer}>
        <View style={styles.addressRow}>
          <View style={styles.iconContainer}>
            <View style={[styles.dot, styles.blueDot]} />
          </View>
          <Text style={styles.addressText} numberOfLines={1}>
            {pickupAddress || "Current Location"}
          </Text>
        </View>
        
        <View style={styles.separator} />
        
        <View style={styles.addressRow}>
          <View style={styles.iconContainer}>
            <MapPin size={16} color={Colors.light.secondary} />
          </View>
          <Text style={styles.addressText} numberOfLines={1}>
            {dropoffAddress || "Destination"}
          </Text>
        </View>
      </View>

      <View style={styles.detailsContainer}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Distance</Text>
          <Text style={styles.detailValue}>{estimatedDistance} km</Text>
        </View>
        
        <View style={styles.detailDivider} />
        
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Time</Text>
          <View style={styles.timeContainer}>
            <Clock size={14} color={Colors.light.gray} />
            <Text style={styles.detailValue}>{estimatedDuration} min</Text>
          </View>
        </View>
        
        <View style={styles.detailDivider} />
        
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Price</Text>
          <Text style={styles.detailValue}>₦{estimatedPrice}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light.white,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  addressesContainer: {
    marginBottom: 16,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
  },
  iconContainer: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  blueDot: {
    backgroundColor: Colors.light.primary,
  },
  addressText: {
    flex: 1,
    fontSize: 16,
  },
  separator: {
    height: 16,
    width: 1,
    backgroundColor: Colors.light.border,
    marginLeft: 12,
  },
  detailsContainer: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: Colors.light.lightGray,
    paddingTop: 16,
  },
  detailItem: {
    flex: 1,
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.light.gray,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  detailDivider: {
    width: 1,
    height: "100%",
    backgroundColor: Colors.light.lightGray,
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
});

export default RideDetails;