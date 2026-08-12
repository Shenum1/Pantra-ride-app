import { Users, UserPlus, Settings, Trash2 } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useThemeStore";
import { Stack } from "expo-router";
import { useAuth } from '@/hooks/useAuthStore';
import { FamilyMember, RiderAccountService } from '@/lib/rider-account-service';
import { SkeletonRow, ShimmerGroup } from '@/components/skeletons';

interface FamilyMemberProps {
  name: string;
  relationship: string;
  phone?: string;
  onEdit: () => void;
  onDelete: () => void;
}

const FamilyMemberCard: React.FC<FamilyMemberProps> = ({ name, relationship, phone, onEdit, onDelete }) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.memberCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.memberAvatar, { backgroundColor: colors.lightGray }]}>
        <Users size={24} color={colors.gray} />
      </View>
      <View style={styles.memberInfo}>
        <Text style={[styles.memberName, { color: colors.text }]}>{name}</Text>
        <Text style={[styles.memberRelationship, { color: colors.gray }]}>{relationship}</Text>
        {phone ? <Text style={[styles.memberRelationship, { color: colors.gray }]}>{phone}</Text> : null}
      </View>
      <Pressable style={styles.memberSettings} onPress={onEdit} testID="family-member-edit-button">
        <Settings size={20} color={colors.gray} />
      </Pressable>
      <Pressable style={styles.memberSettings} onPress={onDelete} testID="family-member-delete-button">
        <Trash2 size={20} color="#FF3B30" />
      </Pressable>
    </View>
  );
};

export default function FamilyProfileScreen() {
  const { colors } = useTheme();
  
  const { user } = useAuth();
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [phone, setPhone] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  useEffect(() => {
    if (!user?.id || user.id === 'test-rider') return;
    setIsLoadingMembers(true);
    RiderAccountService.getFamilyMembers(user.id)
      .then(setFamilyMembers)
      .catch((error) => console.error('Unable to load family members:', error))
      .finally(() => setIsLoadingMembers(false));
  }, [user?.id]);

  const resetForm = () => {
    setName(''); setRelationship(''); setPhone('');
    setIsFormOpen(false); setEditingId(null);
  };

  const handleStartEdit = (member: FamilyMember) => {
    setEditingId(member.id);
    setName(member.name);
    setRelationship(member.relationship);
    setPhone(member.phone ?? '');
    setIsFormOpen(true);
  };

  const handleDeleteMember = (member: FamilyMember) => {
    Alert.alert('Remove family member', `Remove ${member.name} from your family profile?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          RiderAccountService.deleteFamilyMember(member.id)
            .then(() => setFamilyMembers((current) => current.filter((m) => m.id !== member.id)))
            .catch(() => Alert.alert('Unable to remove member', 'Please try again.'));
        },
      },
    ]);
  };

  const handleSubmit = () => {
    if (!user?.id || user.id === 'test-rider' || !name.trim() || !relationship.trim()) return;
    const payload = { name: name.trim(), relationship: relationship.trim(), phone: phone.trim() || undefined };

    if (editingId) {
      RiderAccountService.updateFamilyMember(editingId, payload)
        .then((updated) => {
          setFamilyMembers((current) => current.map((m) => (m.id === editingId ? updated : m)));
          resetForm();
        })
        .catch(() => Alert.alert('Unable to update member', 'Please try again.'));
      return;
    }

    RiderAccountService.addFamilyMember(user.id, payload)
      .then((member) => {
        setFamilyMembers((current) => [...current, member]);
        resetForm();
      })
      .catch(() => Alert.alert('Unable to add member', 'Please try again.'));
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
            {isLoadingMembers ? (
              <ShimmerGroup>
                <SkeletonRow leadingSize={50} />
                <SkeletonRow leadingSize={50} />
              </ShimmerGroup>
            ) : (
              <>
                {familyMembers.length === 0 && <Text style={[styles.subtitle, { color: colors.gray }]}>No family members added yet.</Text>}
                {familyMembers.map((member) => (
                  <FamilyMemberCard
                    key={member.id}
                    name={member.name}
                    relationship={member.relationship}
                    phone={member.phone}
                    onEdit={() => handleStartEdit(member)}
                    onDelete={() => handleDeleteMember(member)}
                  />
                ))}
              </>
            )}
          </View>
          {isFormOpen && (
            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border }]} placeholder="Name" placeholderTextColor={colors.gray} value={name} onChangeText={setName} />
              <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border }]} placeholder="Relationship" placeholderTextColor={colors.gray} value={relationship} onChangeText={setRelationship} />
              <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border }]} placeholder="Phone (optional)" placeholderTextColor={colors.gray} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              <Pressable style={styles.cancelButton} onPress={resetForm} testID="family-form-cancel-button">
                <Text style={[styles.cancelButtonText, { color: colors.gray }]}>Cancel</Text>
              </Pressable>
            </View>
          )}

          <Pressable
            style={[styles.addMemberButton, { backgroundColor: colors.primary }]}
            onPress={isFormOpen ? handleSubmit : () => setIsFormOpen(true)}
          >
            <UserPlus size={20} color={colors.white} />
            <Text style={[styles.addMemberText, { color: colors.white }]}>
              {isFormOpen ? (editingId ? 'Save changes' : 'Save family member') : 'Add Family Member'}
            </Text>
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
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8 },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
