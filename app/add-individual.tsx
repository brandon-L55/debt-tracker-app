import * as ImagePicker from "expo-image-picker";
import { useState, useRef, useEffect } from "react";
import { Alert, Dimensions, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useContacts } from "@/context/ContactsContext";
import { useTheme } from "@/context/ThemeContext";
import { Avatar } from "@/components/Avatar";
import { GradientButton } from "@/components/GradientButton";

export default function AddIndividualScreen() {
  const router = useRouter();
  const { addIndividual } = useContacts();
  const { colors: t, isDark } = useTheme();
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phoneOrUsername, setPhoneOrUsername] = useState("");
  const [notes, setNotes] = useState("");
  const [imageUri, setImageUri] = useState("");
  const [saving, setSaving] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const notesRef = useRef<View>(null);
  const scrollY = useRef(0);
  const kbHeight = useRef(0);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", e => { kbHeight.current = e.endCoordinates.height; });
    const hide = Keyboard.addListener("keyboardDidHide", () => { kbHeight.current = 0; });
    return () => { show.remove(); hide.remove(); };
  }, []);

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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior="height" enabled={Platform.OS === "android"}>
      <ScrollView
        ref={scrollRef}
        onScroll={e => { scrollY.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={100}
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: 160 }}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: t.text }]}>Add Individual</Text>
        <Text style={[styles.subtitle, { color: t.textSub }]}>Add someone you share debts with.</Text>

        <View style={styles.avatarSection}>
          <View style={[styles.avatarRing, {
            borderColor: isDark ? "#7C3AED" : "#C4B5FD",
            backgroundColor: isDark ? "#1C1040" : "#F3EFFF",
            ...(isDark
              ? { shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.75, shadowRadius: 26 }
              : { shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 14 }),
          }]}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.avatarImage} />
            ) : (
              <Avatar name={name || "?"} size={80} />
            )}
          </View>
          <Pressable
            style={[styles.addPhotoButton, { backgroundColor: t.primarySoft, borderColor: t.primaryBorder }]}
            onPress={pickImage}
          >
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

        <View ref={notesRef} style={styles.formGroup}>
          <Text style={[styles.label, { color: t.text }]}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
            placeholder="Any notes about this person..."
            placeholderTextColor={t.textMuted}
            multiline
            scrollEnabled={false}
            value={notes}
            onChangeText={setNotes}
            onFocus={() => {
              setTimeout(() => {
                notesRef.current?.measureInWindow((_x, y, _w, h) => {
                  const windowH = Dimensions.get("window").height;
                  const fieldBottom = y + h;
                  const clearance = windowH - kbHeight.current - 16;
                  if (fieldBottom > clearance) {
                    scrollRef.current?.scrollTo({ y: scrollY.current + fieldBottom - clearance, animated: true });
                  }
                });
              }, 350);
            }}
          />
        </View>

        <GradientButton
          label={saving ? "Saving…" : "Save Individual"}
          onPress={handleSave}
          disabled={saving}
          style={{ marginTop: 10, marginBottom: 40 }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 32, fontWeight: "800", marginTop: 40, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, marginBottom: 4, marginTop: 6 },
  avatarSection: { alignItems: "center", paddingVertical: 28, gap: 12 },
  avatarRing: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, justifyContent: "center", alignItems: "center" },
  avatarImage: { width: 92, height: 92, borderRadius: 46 },
  addPhotoButton: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  addPhotoText: { fontSize: 14, fontWeight: "600" },
  removePhotoText: { fontSize: 13 },
  formGroup: { marginBottom: 20 },
  label: { fontSize: 15, fontWeight: "700", marginBottom: 8 },
  input: { borderRadius: 16, padding: 16, fontSize: 16, borderWidth: 1 },
  textArea: { minHeight: 100, textAlignVertical: "top" },
});
