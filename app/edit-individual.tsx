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

export default function EditIndividualScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { individuals, updateIndividual } = useDebts();

  const resolvedId = Array.isArray(id) ? id[0] : id;
  const person = individuals.find(ind => ind.id === resolvedId);

  const [name, setName] = useState(person?.name ?? "");
  const [nickname, setNickname] = useState(person?.nickname ?? "");
  const [phoneOrUsername, setPhoneOrUsername] = useState(person?.phoneOrUsername ?? "");
  const [notes, setNotes] = useState(person?.notes ?? "");
  const [imageUri, setImageUri] = useState(person?.imageUri ?? "");

  if (!person) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Person not found.</Text>
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

  function handleSave() {
    if (!name.trim()) {
      Alert.alert("Missing field", "Name is required.");
      return;
    }
    updateIndividual(resolvedId, {
      name: name.trim(),
      nickname: nickname.trim(),
      phoneOrUsername: phoneOrUsername.trim(),
      notes: notes.trim(),
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
          <Avatar name={name || person.name} size={88} />
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
        <Text style={styles.label}>Name *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Nickname</Text>
        <TextInput style={styles.input} value={nickname} onChangeText={setNickname} placeholder="What do you call them?" />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Phone or username</Text>
        <TextInput
          style={styles.input}
          value={phoneOrUsername}
          onChangeText={setPhoneOrUsername}
          placeholder="+1 555-000-0000 or @username"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Any notes about this person..."
          multiline
        />
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
  textArea: { minHeight: 100, textAlignVertical: "top" },
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
