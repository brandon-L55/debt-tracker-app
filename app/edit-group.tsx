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
import { useGroups } from "@/context/GroupsContext";
import { useTheme } from "@/context/ThemeContext";
import { Avatar } from "@/components/Avatar";
import type { GroupMember } from "@/context/DebtContext";

function uid() {
  return Math.random().toString(36).slice(2);
}

export default function EditGroupScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { groups, updateGroup } = useGroups();
  const { colors: t } = useTheme();

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
      <View style={[styles.notFound, { backgroundColor: t.bg }]}>
        <Text style={{ color: t.textMuted, fontSize: 16 }}>Group not found.</Text>
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
    <ScrollView style={[styles.container, { backgroundColor: t.bg }]} keyboardShouldPersistTaps="handled">
      <View style={styles.avatarSection}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.avatarImage} />
        ) : (
          <Avatar name={groupName || group.name} size={88} />
        )}
        <Pressable style={[styles.changePhotoButton, { backgroundColor: t.primarySoft, borderColor: t.primaryBorder }]} onPress={pickImage}>
          <Text style={[styles.changePhotoText, { color: t.primary }]}>Change Photo</Text>
        </Pressable>
        {imageUri ? (
          <Pressable onPress={() => setImageUri("")}>
            <Text style={[styles.removePhotoText, { color: t.textMuted }]}>Remove Photo</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: t.text }]}>Group name *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
          placeholder="Group name"
          placeholderTextColor={t.textMuted}
          value={groupName}
          onChangeText={setGroupName}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: t.text }]}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
          placeholder="What is this group for?"
          placeholderTextColor={t.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: t.text }]}>Members</Text>

        {members.map(m => (
          <View key={m.id} style={[styles.memberRow, { backgroundColor: t.card, borderColor: t.border }]}>
            <View style={styles.memberInfo}>
              <Text style={[styles.memberName, { color: t.text }]}>{m.name}</Text>
              <Text style={[styles.memberContact, { color: t.textSub }]}>{m.phoneOrUsername}</Text>
            </View>
            <Pressable onPress={() => handleRemoveMember(m.id)}>
              <Text style={[styles.removeText, { color: t.red }]}>Remove</Text>
            </Pressable>
          </View>
        ))}

        <View style={styles.memberInputRow}>
          <TextInput
            style={[styles.input, styles.memberNameInput, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
            placeholder="Name"
            placeholderTextColor={t.textMuted}
            value={memberName}
            onChangeText={setMemberName}
          />
          <TextInput
            style={[styles.input, styles.memberContactInput, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
            placeholder="Phone or @username"
            placeholderTextColor={t.textMuted}
            value={memberContact}
            onChangeText={setMemberContact}
            autoCapitalize="none"
          />
        </View>
        <Pressable style={[styles.addMemberButton, { backgroundColor: t.primarySoft, borderColor: t.primaryBorder }]} onPress={handleAddMember}>
          <Text style={[styles.addMemberText, { color: t.primary }]}>+ Add Member</Text>
        </Pressable>
      </View>

      <Pressable style={[styles.saveButton, { backgroundColor: t.primary }]} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save Changes</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  notFound: { flex: 1, justifyContent: "center", alignItems: "center" },
  avatarSection: { alignItems: "center", paddingVertical: 28, gap: 10 },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  changePhotoButton: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  changePhotoText: { fontSize: 14, fontWeight: "600" },
  removePhotoText: { fontSize: 13 },
  formGroup: { marginBottom: 22 },
  label: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  input: { borderRadius: 14, padding: 16, fontSize: 16, borderWidth: 1 },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  memberRow: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: "600" },
  memberContact: { fontSize: 13, marginTop: 2 },
  removeText: { fontSize: 14, fontWeight: "600" },
  memberInputRow: { flexDirection: "row", gap: 8, marginBottom: 10, marginTop: 4 },
  memberNameInput: { flex: 1 },
  memberContactInput: { flex: 1 },
  addMemberButton: { borderWidth: 1, padding: 14, borderRadius: 14, alignItems: "center" },
  addMemberText: { fontSize: 15, fontWeight: "600" },
  saveButton: { padding: 18, borderRadius: 16, alignItems: "center", marginTop: 10, marginBottom: 40 },
  saveButtonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
});
