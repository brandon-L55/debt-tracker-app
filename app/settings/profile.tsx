import { useEffect, useState } from "react";
import {
  Alert, Image, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "@/context/ThemeContext";
import { Avatar } from "@/components/Avatar";
import { useProfile } from "@/context/ProfileContext";

export default function ProfileSettingsScreen() {
  const { colors: t } = useTheme();
  const { profile, updateProfile } = useProfile();
  const [form, setForm] = useState({
    display_name: "",
    phone: "",
    username: "",
    avatar_url: null as string | null,
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      display_name: profile.display_name,
      phone: profile.phone,
      username: profile.username,
      avatar_url: profile.avatar_url,
    });
  }, [profile.display_name, profile.phone, profile.username, profile.avatar_url]);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setForm(f => ({ ...f, avatar_url: result.assets[0].uri }));
    }
  }

  async function handleSave() {
    setSaving(true);
    const err = await updateProfile(form);
    setSaving(false);
    if (err) {
      Alert.alert("Error", err);
    } else {
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
          {form.avatar_url ? (
            <Image source={{ uri: form.avatar_url }} style={styles.avatarImg} />
          ) : (
            <Avatar name={form.display_name || "Me"} size={88} />
          )}
          <Pressable
            style={[styles.changePhotoBtn, { borderColor: t.border, backgroundColor: t.card }]}
            onPress={pickImage}
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
            value={form.phone}
            onChangeText={v => setForm(f => ({ ...f, phone: v }))}
          />
        </View>

        <Pressable
          style={[
            styles.saveBtn,
            { backgroundColor: saved ? "#16A34A" : t.primary, opacity: saving ? 0.7 : 1 },
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saved ? "Saved ✓" : saving ? "Saving…" : "Save Profile"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 260, flexGrow: 1 },
  avatarSection: { alignItems: "center", marginBottom: 32 },
  avatarImg: { width: 88, height: 88, borderRadius: 44 },
  changePhotoBtn: { marginTop: 12, borderRadius: 10, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8 },
  changePhotoText: { fontSize: 14, fontWeight: "600" },
  formGroup: { marginBottom: 20 },
  label: { fontSize: 15, fontWeight: "700", marginBottom: 8 },
  input: { borderRadius: 14, padding: 16, fontSize: 16, borderWidth: 1 },
  saveBtn: { padding: 18, borderRadius: 16, alignItems: "center", marginTop: 8 },
  saveBtnText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
});
