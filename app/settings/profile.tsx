import { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "@/context/ThemeContext";
import { Avatar } from "@/components/Avatar";
import { DoneBar } from "@/components/DoneBar";
import { useProfile } from "@/context/ProfileContext";
import { useAuth } from "@/context/AuthContext";
import { uploadAvatar } from "@/lib/services/storageService";

const ACCESSORY_ID = "settings-profile";

export default function ProfileSettingsScreen() {
  const { colors: t } = useTheme();
  const { profile, updateProfile } = useProfile();
  const { session } = useAuth();
  const [form, setForm] = useState({
    display_name: "",
    phone: "",
    username: "",
    avatar_url: null as string | null,
  });
  // Holds a newly-picked local URI that hasn't been uploaded yet.
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  // Tracks whether the currently-displayed image failed to load so we can fall back to initials.
  const [imageError, setImageError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Derived display values — declared before the effects that reference them.
  const isBusy = uploading || saving;
  // Only treat an avatar_url as displayable if it's an HTTPS URL.
  // This filters out stale file:// URIs that may have been persisted by a previous app version.
  const storedUrl = form.avatar_url?.startsWith("https://") ? form.avatar_url : null;
  // Show the local pick as an immediate preview; fall back to the stored URL.
  const displayUri = pendingUri ?? storedUrl;
  const saveLabel = uploading ? "Uploading…" : saving ? "Saving…" : saved ? "Saved ✓" : "Save Profile";

  useEffect(() => {
    setForm({
      display_name: profile.display_name,
      phone: profile.phone,
      username: profile.username,
      avatar_url: profile.avatar_url,
    });
  }, [profile.display_name, profile.phone, profile.username, profile.avatar_url]);

  // Clear any previous load-error when the URI we're trying to show changes.
  useEffect(() => {
    setImageError(false);
  }, [displayUri]);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setPendingUri(result.assets[0].uri);
    }
  }

  async function handleSave() {
    const userId = session?.user?.id;
    if (!userId) {
      Alert.alert("Error", "Not signed in");
      return;
    }

    // Start from the stored URL (must be https:// or null — never a local path).
    let avatarUrl: string | null = storedUrl;

    // Upload the newly-picked image first, then save the returned public URL.
    if (pendingUri) {
      console.log("[profile] uploading pendingUri:", pendingUri);
      setUploading(true);
      try {
        avatarUrl = await uploadAvatar(userId, pendingUri);
        setPendingUri(null);
        console.log("[profile] upload succeeded, avatarUrl:", avatarUrl);
      } catch (err) {
        setUploading(false);
        console.error("[profile] upload failed:", err);
        Alert.alert("Upload Failed", err instanceof Error ? err.message : "Could not upload photo");
        return;
      }
      setUploading(false);
    }

    console.log("[profile] calling updateProfile with avatar_url:", avatarUrl);
    setSaving(true);
    const patch = { ...form, avatar_url: avatarUrl };
    const err = await updateProfile(patch);
    setSaving(false);

    if (err) {
      Alert.alert("Error", err);
    } else {
      // Explicitly sync form so displayUri updates immediately without relying on
      // the useEffect that fires from the profile context update.
      setForm(f => ({ ...f, avatar_url: avatarUrl }));
      console.log("[profile] save succeeded, form.avatar_url now:", avatarUrl);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 110 : 20}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}
        <View style={styles.avatarSection}>
          {displayUri && !imageError ? (
            <Image
              source={{ uri: displayUri }}
              style={styles.avatarImg}
              onError={() => {
                console.warn("[profile] Image failed to load, uri:", displayUri);
                setImageError(true);
              }}
            />
          ) : (
            <Avatar name={form.display_name || "Me"} size={88} />
          )}
          {pendingUri && (
            <Text style={[styles.pendingLabel, { color: t.textMuted }]}>Unsaved — tap Save Profile</Text>
          )}
          <Pressable
            style={[styles.changePhotoBtn, { borderColor: t.border, backgroundColor: t.card }]}
            onPress={pickImage}
            disabled={isBusy}
          >
            <Text style={[styles.changePhotoText, { color: t.primary }]}>Change Photo</Text>
          </Pressable>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: t.text }]}>Display Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
            placeholder="Your name"
            placeholderTextColor={t.textMuted}
            inputAccessoryViewID={ACCESSORY_ID}
            value={form.display_name}
            onChangeText={v => setForm(f => ({ ...f, display_name: v }))}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: t.text }]}>Username</Text>
          <TextInput
            style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
            placeholder="@username"
            placeholderTextColor={t.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            inputAccessoryViewID={ACCESSORY_ID}
            value={form.username}
            onChangeText={v => setForm(f => ({ ...f, username: v.replace(/\s/g, "") }))}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: t.text }]}>Phone Number</Text>
          <TextInput
            style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
            placeholder="+1 (555) 000-0000"
            placeholderTextColor={t.textMuted}
            keyboardType="phone-pad"
            inputAccessoryViewID={ACCESSORY_ID}
            value={form.phone}
            onChangeText={v => setForm(f => ({ ...f, phone: v }))}
          />
        </View>

        <Pressable
          style={[
            styles.saveBtn,
            { backgroundColor: saved ? "#16A34A" : t.primary, opacity: isBusy ? 0.7 : 1 },
          ]}
          onPress={handleSave}
          disabled={isBusy}
        >
          {isBusy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveBtnText}>{saveLabel}</Text>
          )}
        </Pressable>
      </ScrollView>
      <DoneBar nativeID={ACCESSORY_ID} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 260, flexGrow: 1 },
  avatarSection: { alignItems: "center", marginBottom: 32 },
  avatarImg: { width: 88, height: 88, borderRadius: 44 },
  pendingLabel: { fontSize: 11, marginTop: 6, marginBottom: 2 },
  changePhotoBtn: { marginTop: 12, borderRadius: 10, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8 },
  changePhotoText: { fontSize: 14, fontWeight: "600" },
  formGroup: { marginBottom: 20 },
  label: { fontSize: 15, fontWeight: "700", marginBottom: 8 },
  input: { borderRadius: 14, padding: 16, fontSize: 16, borderWidth: 1 },
  saveBtn: { padding: 18, borderRadius: 16, alignItems: "center", marginTop: 8 },
  saveBtnText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
});
