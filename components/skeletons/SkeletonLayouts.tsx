import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { useTheme } from "@/hooks/useThemeStore";
import { Skeleton, SkeletonCircle, SkeletonLine, ShimmerGroup } from "./Skeleton";

function keyRange(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i);
}

/**
 * A bordered card shell matching the app's standard card chrome
 * (white/card background, 12px radius, 16px padding) with a row of
 * placeholder lines inside. Use for promo cards, generic content cards.
 */
export const SkeletonCard: React.FC<{
  lines?: number;
  showIcon?: boolean;
  style?: StyleProp<ViewStyle>;
}> = ({ lines = 2, showIcon = false, style }) => {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
    >
      {showIcon && <SkeletonCircle size={40} style={styles.cardIcon} />}
      <View style={styles.cardBody}>
        {keyRange(lines).map((i) => (
          <SkeletonLine
            key={i}
            width={i === 0 ? "70%" : `${90 - i * 15}%`}
            height={i === 0 ? 16 : 12}
            style={i > 0 ? styles.lineSpacing : undefined}
          />
        ))}
      </View>
    </View>
  );
};

/**
 * A single list row: optional leading circle (avatar/icon), 1-2 lines of
 * text, optional trailing block. Mirrors notification/address/family/
 * payment-method row layouts.
 */
export const SkeletonRow: React.FC<{
  showLeadingCircle?: boolean;
  leadingSize?: number;
  showTrailing?: boolean;
  subtitleWidth?: string;
  style?: StyleProp<ViewStyle>;
}> = ({ showLeadingCircle = true, leadingSize = 40, showTrailing = false, subtitleWidth = "50%", style }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      {showLeadingCircle && <SkeletonCircle size={leadingSize} style={styles.rowLeading} />}
      <View style={styles.rowBody}>
        <SkeletonLine width="65%" height={15} />
        <SkeletonLine width={subtitleWidth as never} height={11} style={styles.lineSpacing} />
      </View>
      {showTrailing && <Skeleton width={24} height={24} borderRadius={12} style={styles.rowTrailing} />}
    </View>
  );
};

/**
 * A card with a leading icon and trailing amount, for transaction / earnings
 * / expense rows (title + subtitle on the left, amount + meta on the right).
 */
export const SkeletonTransactionRow: React.FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      <SkeletonCircle size={36} style={styles.rowLeading} />
      <View style={styles.rowBody}>
        <SkeletonLine width="55%" height={15} />
        <SkeletonLine width="35%" height={11} style={styles.lineSpacing} />
      </View>
      <View style={styles.trailingColumn}>
        <SkeletonLine width={64} height={15} />
        <SkeletonLine width={40} height={10} style={styles.lineSpacing} />
      </View>
    </View>
  );
};

/**
 * Avatar + name + subtitle block for profile/detail screen headers.
 */
export const SkeletonProfileHeader: React.FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => (
  <View style={[styles.profileHeader, style]}>
    <SkeletonCircle size={72} />
    <SkeletonLine width={140} height={18} style={styles.profileLine} />
    <SkeletonLine width={100} height={13} style={styles.lineSpacing} />
  </View>
);

/**
 * A grid of stat tiles (icon + big value + label) for dashboards.
 */
export const SkeletonStatsGrid: React.FC<{ count?: number; columns?: number; style?: StyleProp<ViewStyle> }> = ({
  count = 4,
  columns = 2,
  style,
}) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.statsGrid, style]}>
      {keyRange(count).map((i) => (
        <View
          key={i}
          style={[
            styles.statTile,
            { backgroundColor: colors.card, borderColor: colors.border, width: `${100 / columns - 3}%` as never },
          ]}
        >
          <SkeletonCircle size={32} />
          <SkeletonLine width="60%" height={18} style={styles.profileLine} />
          <SkeletonLine width="40%" height={11} style={styles.lineSpacing} />
        </View>
      ))}
    </View>
  );
};

/**
 * Table header + N rows of M columns, for admin data tables.
 */
export const SkeletonTable: React.FC<{ rows?: number; columns?: number; style?: StyleProp<ViewStyle> }> = ({
  rows = 6,
  columns = 4,
  style,
}) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.table, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      <View style={[styles.tableRow, styles.tableHeaderRow, { borderColor: colors.border }]}>
        {keyRange(columns).map((i) => (
          <SkeletonLine key={i} width="18%" height={11} />
        ))}
      </View>
      {keyRange(rows).map((r) => (
        <View key={r} style={[styles.tableRow, { borderColor: colors.border }]}>
          {keyRange(columns).map((c) => (
            <SkeletonLine key={c} width={c === 0 ? "24%" : "16%"} height={13} />
          ))}
        </View>
      ))}
    </View>
  );
};

/**
 * Convenience wrapper: renders `count` copies of `children` (a render prop
 * receiving the index) inside a single shared ShimmerGroup so a whole list
 * shimmers in sync off one animation driver.
 */
export const SkeletonGroup: React.FC<{
  count: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  children: (index: number) => React.ReactNode;
}> = ({ count, gap = 12, style, children }) => (
  <ShimmerGroup>
    <View style={[{ gap }, style]}>{keyRange(count).map((i) => children(i))}</View>
  </ShimmerGroup>
);

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  cardIcon: {
    marginRight: 12,
  },
  cardBody: {
    flex: 1,
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  rowLeading: {
    marginRight: 12,
  },
  rowBody: {
    flex: 1,
    justifyContent: "center",
  },
  rowTrailing: {
    marginLeft: 12,
  },
  trailingColumn: {
    alignItems: "flex-end",
  },
  lineSpacing: {
    marginTop: 8,
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: 24,
  },
  profileLine: {
    marginTop: 12,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statTile: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: "flex-start",
  },
  table: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 8,
  },
  tableHeaderRow: {
    paddingVertical: 10,
  },
});
