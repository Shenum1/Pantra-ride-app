import { Search } from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Colors from "@/constants/colors";

interface SearchBarProps {
  placeholder?: string;
  onPress?: () => void;
  style?: object;
}

const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = "Where to?",
  onPress,
  style,
}) => {
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push("/search");
    }
  };

  return (
    <Pressable
      style={[styles.container, style]}
      onPress={handlePress}
      testID="search-bar"
    >
      <View style={styles.searchIcon}>
        <Search size={20} color={Colors.light.gray} />
      </View>
      <Text style={styles.placeholder}>{placeholder}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.white,
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  placeholder: {
    fontSize: 16,
    color: Colors.light.gray,
  },
});

export default SearchBar;