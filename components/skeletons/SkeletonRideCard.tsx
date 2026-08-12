import React from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/hooks/useThemeStore";
import { Skeleton, SkeletonLine } from "./Skeleton";

/**
 * Mirrors components/RideCard.tsx: date + status badge header, two address
 * rows, a details row (distance/time/price), matching its spacing/radius.
 */
export const SkeletonRideCard: React.FC<{ showDriver?: boolean }> = ({ showDriver = false }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <SkeletonLine width={90} height={13} />
        <Skeleton width={70} height={22} borderRadius={12} />
      </View>

      <View style={styles.addressesContainer}>
        <View style={styles.addressRow}>
          <Skeleton width={10} height={10} borderRadius={5} style={styles.dot} />
          <SkeletonLine width="70%" height={14} />
        </View>
        <View style={[styles.separator, { backgroundColor: colors.border }]} />
        <View style={styles.addressRow}>
          <Skeleton width={10} height={10} borderRadius={5} style={styles.dot} />
          <SkeletonLine width="60%" height={14} />
        </View>
      </View>

      <View style={[styles.detailsContainer, { borderTopColor: colors.lightGray }]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.detailItem}>
            <SkeletonLine width={40} height={11} />
            <SkeletonLine width={50} height={14} style={styles.detailValueSpacing} />
          </View>
        ))}
      </View>

      {showDriver && (
        <View style={[styles.driverContainer, { borderTopColor: colors.lightGray }]}>
          <SkeletonLine width={44} height={11} />
          <SkeletonLine width={120} height={16} style={styles.detailValueSpacing} />
          <SkeletonLine width={90} height={13} style={styles.detailValueSpacing} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  addressesContainer: {
    marginBottom: 16,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
  },
  dot: {
    marginRight: 12,
    marginLeft: 7,
  },
  separator: {
    height: 16,
    width: 1,
    marginLeft: 12,
  },
  detailsContainer: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: 16,
  },
  detailItem: {
    flex: 1,
    alignItems: "center",
  },
  detailValueSpacing: {
    marginTop: 4,
  },
  driverContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
});
