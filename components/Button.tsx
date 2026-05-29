import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTheme } from "@/hooks/useThemeStore";

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "danger";
  disabled?: boolean;
  loading?: boolean;
  style?: object;
  testID?: string;
  icon?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  style,
  testID,
  icon,
}) => {
  const { colors } = useTheme();

  const getButtonStyle = () => {
    switch (variant) {
      case "primary":
        return { backgroundColor: colors.primary };
      case "secondary":
        return { backgroundColor: colors.secondary };
      case "outline":
        return { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.primary };
      case "danger":
        return { backgroundColor: colors.danger };
      default:
        return { backgroundColor: colors.primary };
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case "primary":
      case "danger":
        return { color: colors.white };
      case "secondary":
        return { color: colors.white };
      case "outline":
        return { color: colors.primary };
      default:
        return { color: colors.white };
    }
  };

  return (
    <View style={[styles.container, style]}>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          getButtonStyle(),
          pressed && styles.buttonPressed,
          disabled && { backgroundColor: colors.lightGray, borderColor: colors.lightGray },
        ]}
        onPress={onPress}
        disabled={disabled || loading}
        testID={testID || "button"}
      >
        {loading ? (
          <ActivityIndicator
            color={variant === "outline" ? colors.primary : colors.white}
            size="small"
          />
        ) : (
          <View style={styles.contentContainer}>
            {icon && <View style={styles.iconContainer}>{icon}</View>}
            <Text
              style={[
                styles.text,
                getTextStyle(),
                disabled && { color: colors.gray },
              ]}
            >
              {title}
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  button: {
    height: 50,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
  },
  contentContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  iconContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
});

export default Button;