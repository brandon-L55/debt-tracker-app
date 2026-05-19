import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useDebts } from "@/context/DebtContext";
import { Avatar } from "@/components/Avatar";
import type { GroupMember } from "@/context/DebtContext";

function uid() {
  return Math.random().toString(36).slice(2);
}

export default function EditGroupScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { groups, updateGroup } = useDebts();

  const resolvedId = Array.isArray(id) ? id[0] : id;
  const group = groups.find(g => g.id === resolvedId);

  const [groupName, setGroupName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [imageUri, setImageUri] = useState(group?.imageUri ?? "");
  const [members, setMembers] = useState<GroupMember[]>(group?.members ?? []);

  const [memberName, setMemberName] = useState("");
  const [memberContact, setMemberContact] = useState("");

  if (!group) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Group not found.</Text>
      </View>
    );
  }

  async function pickImage() {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert("Permission needed", "Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  }

  function handleAddMember() {
    if (!memberName.trim() || !memberContact.trim()) {
      Alert.alert("Missing field", "Enter both a name and phone number or username.");
      return;
    }
    setMembers(prev => [
      ...prev,
      { id: uid(), name: memberName.trim(), phoneOrUsername: memberContact.trim() },
    ]);
    setMemberName("");
    setMemberContact("");
  }

  function handleRemoveMember(memberId: string) {
    setMembers(prev => prev.filter(m => m.id !== memberId));
  }

  function handleSave() {
    if (!groupName.trim()) {
      Alert.alert("Missing field", "Group name is required.");
      return;
    }
    updateGroup(resolvedId, {
      name: groupName.trim(),
      description: description.trim(),
      members,
      imageUri: imageUri || undefined,
    });
    router.back();
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* Avatar picker */}
      <View style={styles.avatarSection}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.avatarImage} />
        ) : (
          <Avatar name={groupName || group.name} size={88} />
        )}
        <Pressable style={styles.changePhotoButton} onPress={pickImage}>
          <Text style={styles.changePhotoText}>Change Photo</Text>
        </Pressable>
        {imageUri ? (
          <Pressable onPress={() => setImageUri("")}>
            <Text style={styles.removePhotoText}>Remove Photo</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Group name *</Text>
        <TextInput style={styles.input} value={groupName} onChangeText={setGroupName} placeholder="Group name" />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="What is this group for?"
          multiline
        />
      </View>

      {/* Member management */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Members</Text>

        {members.map(m => (
          <View key={m.id} style={styles.memberRow}>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{m.name}</Text>
              <Text style={styles.memberContact}>{m.phoneOrUsername}</Text>
            </View>
            <Pressable onPress={() => handleRemoveMember(m.id)}>
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
        ))}

        <View style={styles.memberInputRow}>
          <TextInput
            style={[styles.input, styles.memberNameInput]}
            placeholder="Name"
            value={memberName}
            onChangeText={setMemberName}
          />
          <TextInput
            style={[styles.input, styles.memberContactInput]}
            placeholder="Phone or @username"
            value={memberContact}
            onChangeText={setMemberContact}
            autoCapitalize="none"
          />
        </View>
        <Pressable style={styles.addMemberButton} onPress={handleAddMember}>
          <Text style={styles.addMemberText}>+ Add Member</Text>
        </Pressable>
      </View>

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save Changes</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#F8FAFC" },
  notFound: { flex: 1, justifyContent: "center", alignItems: "center" },
  notFoundText: { fontSize: 16, color: "#9CA3AF" },
  avatarSection: { alignItems: "center", paddingVertical: 28, gap: 10 },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  changePhotoButton: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  changePhotoText: { color: "#2563EB", fontSize: 14, fontWeight: "600" },
  removePhotoText: { color: "#9CA3AF", fontSize: 13 },
  formGroup: { marginBottom: 22 },
  label: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginBottom: 8 },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  memberRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  memberContact: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  removeText: { fontSize: 14, color: "#DC2626", fontWeight: "600" },
  memberInputRow: { flexDirection: "row", gap: 8, marginBottom: 10, marginTop: 4 },
  memberNameInput: { flex: 1 },
  memberContactInput: { flex: 1 },
  addMemberButton: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  addMemberText: { color: "#2563EB", fontSize: 15, fontWeight: "600" },
  saveButton: {
    backgroundColor: "#2563EB",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 40,
  },
  saveButtonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
});
