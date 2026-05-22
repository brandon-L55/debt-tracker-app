import { useEffect, useState } from "react";
import {
  Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "@/context/ThemeContext";
import { Avatar } from "@/components/Avatar";

const PROFILE_KEY = "@debt_tracker/profile";

type Profile = {
  name: string;
  phone: string;
  email: string;
  imageUri?: string;
};

const EMPTY: Profile = { name: "", phone: "", email: "" };

export default function ProfileSettingsScreen() {
  const { colors: t } = useTheme();
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(PROFILE_KEY).then(v => {
      if (v) setProfile(JSON.parse(v));
    });
  }, []);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setProfile(p => ({ ...p, imageUri: result.assets[0].uri }));
    }
  }

  async function handleSave() {
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 110 : 20}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"} showsVerticalScrollIndicator={false}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        {profile.imageUri ? (
          <Image source={{ uri: profile.imageUri }} style={styles.avatarImg} />
        ) : (
          <Avatar name={profile.name || "Me"} size={88} />
        )}
        <Pressable style={[styles.changePhotoBtn, { borderColor: t.border, backgroundColor: t.card }]} onPress={pickImage}>
          <Text style={[styles.changePhotoText, { color: t.primary }]}>Change Photo</Text>
        </Pressable>
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: t.text }]}>Display Name</Text>
        <TextInput
          style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
          placeholder="Your name"
          placeholderTextColor={t.textMuted}
          value={profile.name}
          onChangeText={v => setProfile(p => ({ ...p, name: v }))}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: t.text }]}>Phone Number</Text>
        <TextInput
          style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
          placeholder="+1 (555) 000-0000"
          placeholderTextColor={t.textMuted}
          keyboardType="phone-pad"
          value={profile.phone}
          onChangeText={v => setProfile(p => ({ ...p, phone: v }))}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: t.text }]}>Backup Email <Text style={{ color: t.textMuted, fontWeight: "400" }}>(optional)</Text></Text>
        <TextInput
          style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
          placeholder="you@example.com"
          placeholderTextColor={t.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          value={profile.email}
          onChangeText={v => setProfile(p => ({ ...p, email: v }))}
        />
      </View>

      <Pressable
        style={[styles.saveBtn, { backgroundColor: saved ? "#16A34A" : t.primary }]}
        onPress={handleSave}
      >
        <Text style={styles.saveBtnText}>{saved ? "Saved ✓" : "Save Profile"}</Text>
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
