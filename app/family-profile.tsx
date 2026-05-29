import { Users, UserPlus, Settings } from "lucide-react-native";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useThemeStore";
import { Stack } from "expo-router";

interface FamilyMemberProps {
  name: string;
  relationship: string;
  isOwner?: boolean;
}

const FamilyMember: React.FC<FamilyMemberProps> = ({ name, relationship, isOwner = false }) => {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.memberCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.memberAvatar, { backgroundColor: colors.lightGray }]}>
        <Users size={24} color={colors.gray} />
      </View>
      <View style={styles.memberInfo}>
        <Text style={[styles.memberName, { color: colors.text }]}>{name}</Text>
        <Text style={[styles.memberRelationship, { color: colors.gray }]}>{relationship}</Text>
        {isOwner && (
          <Text style={[styles.ownerBadge, { color: colors.primary }]}>Account Owner</Text>
        )}
      </View>
      <Pressable style={styles.memberSettings}>
        <Settings size={20} color={colors.gray} />
      </Pressable>
    </View>
  );
};

export default function FamilyProfileScreen() {
  const { colors } = useTheme();
  
  const [familyMembers] = useState([
    { name: 'Kelvin Johnson', relationship: 'You', isOwner: true },
    { name: 'Sarah Johnson', relationship: 'Spouse' },
    { name: 'Emma Johnson', relationship: 'Daughter' },
  ]);
  
  const handleAddMember = () => {
    Alert.alert(
      'Add Family Member',
      'Send an invitation to add a family member to your profile.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send Invite', onPress: () => Alert.alert('Invite Sent', 'Family member invitation has been sent.') },
      ]
    );
  };
  
  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Family Profile',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
        }} 
      />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["bottom"]}>
        <ScrollView style={styles.content}>
          <View style={styles.headerSection}>
            <Text style={[styles.title, { color: colors.text }]}>Family Members</Text>
            <Text style={[styles.subtitle, { color: colors.gray }]}>
              Manage your family profile and shared rides
            </Text>
          </View>
          
          <View style={styles.membersContainer}>
            {familyMembers.map((member, index) => (
              <FamilyMember
                key={index}
                name={member.name}
                relationship={member.relationship}
                isOwner={member.isOwner}
              />
            ))}
          </View>
          
          <Pressable 
            style={[styles.addMemberButton, { backgroundColor: colors.primary }]}
            onPress={handleAddMember}
          >
            <UserPlus size={20} color={colors.white} />
            <Text style={[styles.addMemberText, { color: colors.white }]}>Add Family Member</Text>
          </Pressable>
          
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>Family Profile Benefits</Text>
            <Text style={[styles.infoText, { color: colors.gray }]}>
              • Share payment methods{'\n'}
              • Track family rides{'\n'}
              • Set spending limits{'\n'}
              • Emergency contacts
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  headerSection: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  membersContainer: {
    gap: 12,
    marginBottom: 24,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  memberAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  memberRelationship: {
    fontSize: 14,
  },
  ownerBadge: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  memberSettings: {
    padding: 8,
  },
  addMemberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 8,
  },
  addMemberText: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
});