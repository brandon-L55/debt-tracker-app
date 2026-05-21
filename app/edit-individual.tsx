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
import { useContacts } from "@/context/ContactsContext";
import { useTheme } from "@/context/ThemeContext";
import { Avatar } from "@/components/Avatar";

export default function EditIndividualScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { individuals, updateIndividual } = useContacts();
  const { colors: t } = useTheme();

  const resolvedId = Array.isArray(id) ? id[0] : id;
  const person = individuals.find(ind => ind.id === resolvedId);

  const [name, setName] = useState(person?.name ?? "");
  const [nickname, setNickname] = useState(person?.nickname ?? "");
  const [phoneOrUsername, setPhoneOrUsername] = useState(person?.phoneOrUsername ?? "");
  const [notes, setNotes] = useState(person?.notes ?? "");
  const [imageUri, setImageUri] = useState(person?.imageUri ?? "");

  if (!person) {
    return (
      <View style={[styles.notFound, { backgroundColor: t.bg }]}>
        <Text style={{ color: t.textMuted, fontSize: 16 }}>Person not found.</Text>
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
    <ScrollView style={[styles.container, { backgroundColor: t.bg }]} keyboardShouldPersistTaps="handled">
      <View style={styles.avatarSection}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.avatarImage} />
        ) : (
          <Avatar name={name || person.name} size={88} />
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
        <Text style={[styles.label, { color: t.text }]}>Name *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
          placeholder="Full name"
          placeholderTextColor={t.textMuted}
          value={name}
          onChangeText={setName}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: t.text }]}>Nickname</Text>
        <TextInput
          style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
          placeholder="What do you call them?"
          placeholderTextColor={t.textMuted}
          value={nickname}
          onChangeText={setNickname}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: t.text }]}>Phone or username</Text>
        <TextInput
          style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
          placeholder="+1 555-000-0000 or @username"
          placeholderTextColor={t.textMuted}
          value={phoneOrUsername}
          onChangeText={setPhoneOrUsername}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: t.text }]}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
          placeholder="Any notes about this person..."
          placeholderTextColor={t.textMuted}
          value={notes}
          onChangeText={setNotes}
          multiline
        />
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
  textArea: { minHeight: 100, textAlignVertical: "top" },
  saveButton: { padding: 18, borderRadius: 16, alignItems: "center", marginTop: 10, marginBottom: 40 },
  saveButtonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
});
