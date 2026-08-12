import { LinearGradient } from "expo-linear-gradient";
import React, { createContext, useContext, useEffect, useState } from "react";
import { DimensionValue, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  Easing,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "@/hooks/useThemeStore";

const SHIMMER_DURATION = 1100;

const ShimmerContext = createContext<SharedValue<number> | null>(null);

/**
 * Wrap a group of Skeleton blocks in one ShimmerGroup so they share a single
 * animation driver instead of each block running its own loop.
 */
export const ShimmerGroup: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: SHIMMER_DURATION, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
  }, [progress]);

  return <ShimmerContext.Provider value={progress}>{children}</ShimmerContext.Provider>;
};

function useShimmerProgress(): SharedValue<number> {
  const shared = useContext(ShimmerContext);
  const fallback = useSharedValue(0);

  useEffect(() => {
    if (!shared) {
      fallback.value = withRepeat(
        withTiming(1, { duration: SHIMMER_DURATION, easing: Easing.inOut(Easing.ease) }),
        -1,
        false
      );
    }
  }, [shared, fallback]);

  return shared ?? fallback;
}

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * A single placeholder block with a light sweep animation moving across it.
 * Use inside a ShimmerGroup (composed skeleton layouts already do this) so
 * every block on a screen animates in sync off one shared driver.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = "100%",
  height = 14,
  borderRadius = 6,
  style,
  testID = "skeleton",
}) => {
  const { colors, isDark } = useTheme();
  const progress = useShimmerProgress();
  const [blockWidth, setBlockWidth] = useState(0);

  const sweepStyle = useAnimatedStyle(() => {
    if (!blockWidth) {
      return { opacity: 0 };
    }
    const sweepWidth = blockWidth * 0.6;
    const travel = blockWidth + sweepWidth;
    return {
      opacity: 1,
      transform: [{ translateX: -sweepWidth + progress.value * travel }],
    };
  }, [blockWidth]);

  return (
    <View
      testID={testID}
      onLayout={(e) => setBlockWidth(e.nativeEvent.layout.width)}
      style={[
        styles.base,
        { width, height, borderRadius, backgroundColor: colors.lightGray },
        style,
      ]}
    >
      {blockWidth > 0 && (
        <Animated.View style={[StyleSheet.absoluteFillObject, { width: blockWidth * 0.6 }, sweepStyle]}>
          <LinearGradient
            colors={
              isDark
                ? ["transparent", "rgba(255,255,255,0.07)", "transparent"]
                : ["transparent", "rgba(255,255,255,0.7)", "transparent"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
      )}
    </View>
  );
};

export const SkeletonCircle: React.FC<{ size?: number; style?: StyleProp<ViewStyle> }> = ({ size = 40, style }) => (
  <Skeleton width={size} height={size} borderRadius={size / 2} style={style} />
);

export const SkeletonLine: React.FC<{ width?: DimensionValue; height?: DimensionValue; style?: StyleProp<ViewStyle> }> = ({
  width = "100%",
  height = 12,
  style,
}) => <Skeleton width={width} height={height} borderRadius={4} style={style} />;

const styles = StyleSheet.create({
  base: {
    overflow: "hidden",
  },
});
