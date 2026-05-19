import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useDebts } from "@/context/DebtContext";
import type { GroupMember } from "@/context/DebtContext";

export default function CreateGroupScreen() {
  const router = useRouter();
  const { addGroup } = useDebts();

  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [members, setMembers] = useState<GroupMember[]>([]);

  const [memberName, setMemberName] = useState("");
  const [memberContact, setMemberContact] = useState("");

  function handleAddMember() {
    if (!memberName.trim() || !memberContact.trim()) {
      Alert.alert("Missing field", "Enter both a name and phone number or username.");
      return;
    }
    setMembers(prev => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        name: memberName.trim(),
        phoneOrUsername: memberContact.trim(),
      },
    ]);
    setMemberName("");
    setMemberContact("");
  }

  function handleRemoveMember(id: string) {
    setMembers(prev => prev.filter(m => m.id !== id));
  }

  function handleSave() {
    if (!groupName.trim()) {
      Alert.alert("Missing field", "Please enter a group name.");
      return;
    }
    addGroup({
      name: groupName.trim(),
      description: description.trim(),
      members,
    });
    router.back();
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Create Group</Text>
      <Text style={styles.subtitle}>Organize debts for a trip, event, or friend group.</Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Group name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Cabo Trip, Apartment, Dinner Club"
          value={groupName}
          onChangeText={setGroupName}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="What is this group for?"
          multiline
          value={description}
          onChangeText={setDescription}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Members</Text>

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

        {members.length > 0 && (
          <View style={styles.memberList}>
            {members.map(m => (
              <View key={m.id} style={styles.memberRow}>
                <View>
                  <Text style={styles.memberName}>{m.name}</Text>
                  <Text style={styles.memberContact}>{m.phoneOrUsername}</Text>
                </View>
                <Pressable onPress={() => handleRemoveMember(m.id)}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save Group</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#F8FAFC",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    marginTop: 40,
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 16,
    color: "#64748B",
    marginBottom: 28,
  },
  formGroup: {
    marginBottom: 22,
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  memberInputRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  memberNameInput: {
    flex: 1,
  },
  memberContactInput: {
    flex: 1,
  },
  addMemberButton: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  addMemberText: {
    color: "#2563EB",
    fontSize: 15,
    fontWeight: "600",
  },
  memberList: {
    marginTop: 14,
    gap: 8,
  },
  memberRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  memberName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  memberContact: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  removeText: {
    fontSize: 14,
    color: "#DC2626",
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: "#2563EB",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 40,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
});
