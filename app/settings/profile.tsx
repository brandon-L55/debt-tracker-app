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
import { supabase } from "@/lib/supabase";

const ACCESSORY_ID = "settings-profile";

// Supabase creates a synthetic auth email for phone-registered users.
// Never show this to the user — treat it as "no email set".
const SYNTHETIC_EMAIL_SUFFIX = "@gotchulatr.internal";
function isSyntheticEmail(email: string | null | undefined): boolean {
  return !!email?.endsWith(SYNTHETIC_EMAIL_SUFFIX);
}

export default function ProfileSettingsScreen() {
  const { colors: t } = useTheme();
  const { profile, isLoading, updateProfile } = useProfile();
  const { session } = useAuth();

  const [form, setForm] = useState({
    display_name: "",
    phone: "",
    username: "",
    avatar_url: null as string | null,
  });
  const [email, setEmail] = useState("");
  const [initialEmail, setInitialEmail] = useState("");

  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const isBusy = uploading || saving;
  const storedUrl = form.avatar_url?.startsWith("https://") ? form.avatar_url : null;
  const displayUri = pendingUri ?? storedUrl;
  const saveLabel = uploading ? "Uploading…" : saving ? "Saving…" : saved ? "Saved ✓" : "Save Profile";

  // Populate form from ProfileContext whenever context data changes.
  useEffect(() => {
    setForm({
      display_name: profile.display_name,
      phone: profile.phone,
      username: profile.username,
      avatar_url: profile.avatar_url,
    });
  }, [profile.display_name, profile.phone, profile.username, profile.avatar_url]);

  // Populate email from Supabase Auth session.
  // Filter out synthetic emails so phone-registered users see an empty field
  // (prompting them to add a real email rather than editing the internal one).
  useEffect(() => {
    const authEmail = session?.user?.email;
    const displayEmail = isSyntheticEmail(authEmail) ? "" : (authEmail ?? "");
    setEmail(displayEmail);
    setInitialEmail(displayEmail);
  }, [session?.user?.email]);

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

    const emailTrimmed = email.trim().toLowerCase();
    const emailChanged = emailTrimmed !== initialEmail.trim().toLowerCase();

    // Validate email format only if a value was entered or changed.
    if (emailTrimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    // ── Avatar upload ────────────────────────────────────────────────────────
    let avatarUrl: string | null = storedUrl;
    if (pendingUri) {
      setUploading(true);
      try {
        avatarUrl = await uploadAvatar(userId, pendingUri);
        setPendingUri(null);
      } catch (err) {
        setUploading(false);
        Alert.alert("Upload Failed", err instanceof Error ? err.message : "Could not upload photo");
        return;
      }
      setUploading(false);
    }

    // ── Profile fields ───────────────────────────────────────────────────────
    setSaving(true);
    const profileErr = await updateProfile({ ...form, avatar_url: avatarUrl });

    // ── Email update (Supabase Auth) ─────────────────────────────────────────
    let emailErr: string | null = null;
    if (emailChanged && emailTrimmed) {
      const { error } = await supabase.auth.updateUser({ email: emailTrimmed });
      if (error) {
        emailErr = error.message;
      } else {
        // Mark as committed so a subsequent save doesn't re-trigger the flow.
        setInitialEmail(emailTrimmed);
      }
    }

    setSaving(false);

    if (profileErr || emailErr) {
      const parts = [profileErr, emailErr].filter(Boolean).join("\n\n");
      Alert.alert("Could not save", parts);
      return;
    }

    // Keep form in sync with the uploaded avatar URL.
    setForm(f => ({ ...f, avatar_url: avatarUrl }));

    if (emailChanged && emailTrimmed) {
      Alert.alert(
        "Confirm Your Email",
        `A confirmation link was sent to ${emailTrimmed}. Tap it to finish updating your email.`,
        [{ text: "OK" }],
      );
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  // ── Loading state while ProfileContext fetches from Supabase ────────────────
  if (isLoading) {
    return (
      <View style={[styles.loadingWrapper, { backgroundColor: t.bg }]}>
        <ActivityIndicator size="large" color={t.primary} />
      </View>
    );
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
        {/* ── Avatar ─────────────────────────────────────────────────────── */}
        <View style={styles.avatarSection}>
          {displayUri && !imageError ? (
            <Image
              source={{ uri: displayUri }}
              style={styles.avatarImg}
              onError={() => setImageError(true)}
            />
          ) : (
            <Avatar name={form.display_name || "Me"} size={88} />
          )}
          {pendingUri && (
            <Text style={[styles.pendingLabel, { color: t.textMuted }]}>
              Unsaved — tap Save Profile
            </Text>
          )}
          <Pressable
            style={[styles.changePhotoBtn, { borderColor: t.border, backgroundColor: t.card }]}
            onPress={pickImage}
            disabled={isBusy}
          >
            <Text style={[styles.changePhotoText, { color: t.primary }]}>Change Photo</Text>
          </Pressable>
        </View>

        {/* ── Display Name ────────────────────────────────────────────────── */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: t.text }]}>Display Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
            placeholder="Your name"
            placeholderTextColor={t.textMuted}
            inputAccessoryViewID={ACCESSORY_ID}
            value={form.display_name}
            onChangeText={v => setForm(f => ({ ...f, display_name: v }))}
            editable={!isBusy}
          />
        </View>

        {/* ── Username ────────────────────────────────────────────────────── */}
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
            editable={!isBusy}
          />
        </View>

        {/* ── Phone (read-only — auth identifier) ─────────────────────────── */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: t.text }]}>Phone Number</Text>
          <View
            style={[
              styles.input,
              styles.readonlyInput,
              { backgroundColor: t.input, borderColor: t.border },
            ]}
          >
            <Text style={[styles.readonlyText, { color: form.phone ? t.text : t.textMuted }]}>
              {form.phone || "+1 (555) 000-0000"}
            </Text>
          </View>
          <Text style={[styles.fieldNote, { color: t.textMuted }]}>
            Phone number cannot be changed after registration.
          </Text>
        </View>

        {/* ── Email ───────────────────────────────────────────────────────── */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: t.text }]}>Email</Text>
          <TextInput
            style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
            placeholder="you@example.com"
            placeholderTextColor={t.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            inputAccessoryViewID={ACCESSORY_ID}
            value={email}
            onChangeText={setEmail}
            editable={!isBusy}
          />
          <Text style={[styles.fieldNote, { color: t.textMuted }]}>
            Changing your email will send a confirmation link to the new address.
          </Text>
        </View>

        {/* ── Save button ─────────────────────────────────────────────────── */}
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
  loadingWrapper: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: 24, paddingBottom: 260, flexGrow: 1 },

  avatarSection: { alignItems: "center", marginBottom: 32 },
  avatarImg: { width: 88, height: 88, borderRadius: 44 },
  pendingLabel: { fontSize: 11, marginTop: 6, marginBottom: 2 },
  changePhotoBtn: { marginTop: 12, borderRadius: 10, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8 },
  changePhotoText: { fontSize: 14, fontWeight: "600" },

  formGroup: { marginBottom: 20 },
  label: { fontSize: 15, fontWeight: "700", marginBottom: 8 },
  input: { borderRadius: 14, padding: 16, fontSize: 16, borderWidth: 1 },

  readonlyInput: { justifyContent: "center", opacity: 0.65 },
  readonlyText: { fontSize: 16 },
  fieldNote: { fontSize: 12, marginTop: 6, lineHeight: 17 },

  saveBtn: { padding: 18, borderRadius: 16, alignItems: "center", marginTop: 8 },
  saveBtnText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
});
