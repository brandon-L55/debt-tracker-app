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

export default function AddIndividualScreen() {
  const router = useRouter();
  const { addIndividual } = useDebts();
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phoneOrUsername, setPhoneOrUsername] = useState("");
  const [notes, setNotes] = useState("");

  function handleSave() {
    if (!name.trim()) {
      Alert.alert("Missing field", "Please enter a name.");
      return;
    }
    if (!phoneOrUsername.trim()) {
      Alert.alert("Missing field", "Please enter a phone number or username.");
      return;
    }
    addIndividual({
      name: name.trim(),
      nickname: nickname.trim(),
      phoneOrUsername: phoneOrUsername.trim(),
      notes: notes.trim(),
    });
    router.back();
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Add Individual</Text>
      <Text style={styles.subtitle}>
        Add someone you share debts with.
      </Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Full name"
          value={name}
          onChangeText={setName}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Nickname</Text>
        <TextInput
          style={styles.input}
          placeholder="What do you call them?"
          value={nickname}
          onChangeText={setNickname}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Phone number or username *</Text>
        <TextInput
          style={styles.input}
          placeholder="+1 555-000-0000 or @username"
          value={phoneOrUsername}
          onChangeText={setPhoneOrUsername}
          keyboardType="default"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Any notes about this person..."
          multiline
          value={notes}
          onChangeText={setNotes}
        />
      </View>

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save Individual</Text>
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
    minHeight: 100,
    textAlignVertical: "top",
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
