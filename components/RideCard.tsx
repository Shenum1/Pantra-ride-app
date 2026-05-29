import { Clock, MapPin } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";
import { RideRequest } from "@/types";

interface RideCardProps {
  ride: RideRequest;
}

const RideCard: React.FC<RideCardProps> = ({ ride }) => {
  const getStatusColor = () => {
    switch (ride.status) {
      case "completed":
        return Colors.light.success;
      case "cancelled":
        return Colors.light.danger;
      case "in_progress":
        return Colors.light.primary;
      default:
        return Colors.light.gray;
    }
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.date}>{formatDate(ride.createdAt)}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.statusText}>
            {ride.status ? ride.status.charAt(0).toUpperCase() + ride.status.slice(1).replace("_", " ") : "Unknown"}
          </Text>
        </View>
      </View>

      <View style={styles.addressesContainer}>
        <View style={styles.addressRow}>
          <View style={styles.iconContainer}>
            <View style={[styles.dot, styles.blueDot]} />
          </View>
          <Text style={styles.addressText} numberOfLines={1}>
            {ride.pickupAddress || "Pickup location"}
          </Text>
        </View>
        
        <View style={styles.separator} />
        
        <View style={styles.addressRow}>
          <View style={styles.iconContainer}>
            <MapPin size={16} color={Colors.light.secondary} />
          </View>
          <Text style={styles.addressText} numberOfLines={1}>
            {ride.dropoffAddress || "Dropoff location"}
          </Text>
        </View>
      </View>

      <View style={styles.detailsContainer}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Distance</Text>
          <Text style={styles.detailValue}>{ride.distance} km</Text>
        </View>
        
        <View style={styles.detailDivider} />
        
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Time</Text>
          <View style={styles.timeContainer}>
            <Clock size={14} color={Colors.light.gray} />
            <Text style={styles.detailValue}>{ride.duration} min</Text>
          </View>
        </View>
        
        <View style={styles.detailDivider} />
        
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Price</Text>
          <Text style={styles.detailValue}>₦{ride.price}</Text>
        </View>
      </View>

      {ride.driver && (
        <View style={styles.driverContainer}>
          <Text style={styles.driverLabel}>Driver</Text>
          <Text style={styles.driverName}>{ride.driver.name}</Text>
          <Text style={styles.carInfo}>
            {ride.driver.carModel} • {ride.driver.licensePlate}
          </Text>
        </View>
      )}
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  date: {
    fontSize: 14,
    color: Colors.light.gray,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: Colors.light.white,
    fontWeight: "500",
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
    fontSize: 14,
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
    fontSize: 14,
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
  driverContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.lightGray,
  },
  driverLabel: {
    fontSize: 12,
    color: Colors.light.gray,
    marginBottom: 4,
  },
  driverName: {
    fontSize: 16,
    fontWeight: "600",
  },
  carInfo: {
    fontSize: 14,
    color: Colors.light.gray,
    marginTop: 2,
  },
});

export default RideCard;