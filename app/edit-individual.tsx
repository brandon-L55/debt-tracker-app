import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
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
import { GradientButton } from "@/components/GradientButton";

export default function EditIndividualScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { individuals, updateIndividual } = useContacts();
  const { colors: t, isDark } = useTheme();

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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 110 : 20}>
      <ScrollView style={[styles.container, { backgroundColor: t.bg }]} contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: 260 }} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"} showsVerticalScrollIndicator={false}>
      <View style={styles.avatarSection}>
        <View style={[styles.avatarRing, {
          borderColor: isDark ? "#7C3AED" : "#C4B5FD",
          backgroundColor: isDark ? "#1C1040" : "#F3EFFF",
          ...(isDark ? { shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 16 } : {}),
        }]}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.avatarImage} />
          ) : (
            <Avatar name={name || person.name} size={80} />
          )}
        </View>
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

      <GradientButton
        label="Save Changes"
        onPress={handleSave}
        style={{ marginTop: 10, marginBottom: 40 }}
      />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notFound: { flex: 1, justifyContent: "center", alignItems: "center" },
  avatarSection: { alignItems: "center", paddingVertical: 28, gap: 12 },
  avatarRing: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, justifyContent: "center", alignItems: "center" },
  avatarImage: { width: 92, height: 92, borderRadius: 46 },
  changePhotoButton: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  changePhotoText: { fontSize: 14, fontWeight: "600" },
  removePhotoText: { fontSize: 13 },
  formGroup: { marginBottom: 20 },
  label: { fontSize: 15, fontWeight: "700", marginBottom: 8 },
  input: { borderRadius: 16, padding: 16, fontSize: 16, borderWidth: 1 },
  textArea: { minHeight: 100, textAlignVertical: "top" },
});
