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
import { useRouter } from "expo-router";
import { useContacts } from "@/context/ContactsContext";
import { useTheme } from "@/context/ThemeContext";
import { Avatar } from "@/components/Avatar";

export default function AddIndividualScreen() {
  const router = useRouter();
  const { addIndividual } = useContacts();
  const { colors: t } = useTheme();
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phoneOrUsername, setPhoneOrUsername] = useState("");
  const [notes, setNotes] = useState("");
  const [imageUri, setImageUri] = useState("");
  const [saving, setSaving] = useState(false);

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

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert("Missing field", "Please enter a name.");
      return;
    }
    if (!phoneOrUsername.trim()) {
      Alert.alert("Missing field", "Please enter a phone number or username.");
      return;
    }
    setSaving(true);
    try {
      await addIndividual({
        name: name.trim(),
        nickname: nickname.trim(),
        phoneOrUsername: phoneOrUsername.trim(),
        notes: notes.trim(),
        imageUri: imageUri || undefined,
      });
      router.back();
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : (e as { message?: string })?.message ?? "Could not save contact.";
      console.error("ADD INDIVIDUAL ERROR:", e);
      Alert.alert("Save failed", msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: t.bg }]} keyboardShouldPersistTaps="handled">
      <Text style={[styles.title, { color: t.text }]}>Add Individual</Text>
      <Text style={[styles.subtitle, { color: t.textSub }]}>Add someone you share debts with.</Text>

      <View style={styles.avatarSection}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.avatarImage} />
        ) : (
          <Avatar name={name || "?"} size={88} />
        )}
        <Pressable style={[styles.addPhotoButton, { backgroundColor: t.primarySoft, borderColor: t.primaryBorder }]} onPress={pickImage}>
          <Text style={[styles.addPhotoText, { color: t.primary }]}>{imageUri ? "Change Photo" : "Add Photo"}</Text>
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
        <Text style={[styles.label, { color: t.text }]}>Phone number or username *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
          placeholder="+1 555-000-0000 or @username"
          placeholderTextColor={t.textMuted}
          value={phoneOrUsername}
          onChangeText={setPhoneOrUsername}
          keyboardType="default"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: t.text }]}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
          placeholder="Any notes about this person..."
          placeholderTextColor={t.textMuted}
          multiline
          value={notes}
          onChangeText={setNotes}
        />
      </View>

      <Pressable style={[styles.saveButton, { backgroundColor: t.primary, opacity: saving ? 0.6 : 1 }]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? "Saving…" : "Save Individual"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 32, fontWeight: "700", marginTop: 40 },
  subtitle: { fontSize: 16, marginBottom: 4 },
  avatarSection: { alignItems: "center", paddingVertical: 28, gap: 10 },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  addPhotoButton: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  addPhotoText: { fontSize: 14, fontWeight: "600" },
  removePhotoText: { fontSize: 13 },
  formGroup: { marginBottom: 22 },
  label: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  input: { borderRadius: 14, padding: 16, fontSize: 16, borderWidth: 1 },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  saveButton: { padding: 18, borderRadius: 16, alignItems: "center", marginTop: 10, marginBottom: 40 },
  saveButtonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
});
