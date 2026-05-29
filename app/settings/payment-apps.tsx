import { useEffect, useState } from "react";
import {
  Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { useProfile } from "@/context/ProfileContext";
import type { ProfileData } from "@/context/ProfileContext";

type AppConfig = {
  key: keyof Pick<ProfileData, "venmo_handle" | "cashapp_handle" | "paypal_handle">;
  name: string;
  color: string;
  prefix: string;
  placeholder: string;
};

const APPS: AppConfig[] = [
  { key: "venmo_handle",   name: "Venmo",    color: "#3D95CE", prefix: "@", placeholder: "your-venmo-username" },
  { key: "cashapp_handle", name: "Cash App", color: "#00C853", prefix: "$", placeholder: "your-cashtag" },
  { key: "paypal_handle",  name: "PayPal",   color: "#003087", prefix: "",  placeholder: "you@email.com or @username" },
];

type HandleForm = Pick<ProfileData, "venmo_handle" | "cashapp_handle" | "paypal_handle">;

const EMPTY_FORM: HandleForm = { venmo_handle: "", cashapp_handle: "", paypal_handle: "" };

export default function PaymentAppsScreen() {
  const { colors: t } = useTheme();
  const { profile, updateProfile } = useProfile();
  const [form, setForm] = useState<HandleForm>(EMPTY_FORM);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      venmo_handle:   profile.venmo_handle,
      cashapp_handle: profile.cashapp_handle,
      paypal_handle:  profile.paypal_handle,
    });
  }, [profile.venmo_handle, profile.cashapp_handle, profile.paypal_handle]);

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
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.hint, { color: t.textSub }]}>
          Add your payment handles so friends know where to send money. These sync to your profile.
        </Text>

        {APPS.map(app => (
          <View key={app.key} style={styles.formGroup}>
            <View style={styles.labelRow}>
              <View style={[styles.appDot, { backgroundColor: app.color + "22" }]}>
                <Text style={[styles.appInitial, { color: app.color }]}>{app.name[0]}</Text>
              </View>
              <Text style={[styles.label, { color: t.text }]}>{app.name}</Text>
            </View>
            <View style={[styles.inputRow, { backgroundColor: t.input, borderColor: t.border }]}>
              {app.prefix ? (
                <Text style={[styles.prefix, { color: t.textMuted }]}>{app.prefix}</Text>
              ) : null}
              <TextInput
                style={[styles.input, { color: t.text }]}
                placeholder={app.placeholder}
                placeholderTextColor={t.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                value={form[app.key]}
                onChangeText={v => setForm(f => ({ ...f, [app.key]: v.trim() }))}
              />
            </View>
          </View>
        ))}

        <Pressable
          style={[
            styles.saveBtn,
            { backgroundColor: saved ? "#16A34A" : t.primary, opacity: saving ? 0.7 : 1 },
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saved ? "Saved ✓" : saving ? "Saving…" : "Save Payment Handles"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 48 },
  hint: { fontSize: 14, lineHeight: 20, marginBottom: 24 },
  formGroup: { marginBottom: 20 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  appDot: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  appInitial: { fontSize: 14, fontWeight: "700" },
  label: { fontSize: 15, fontWeight: "700" },
  inputRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, paddingHorizontal: 16 },
  prefix: { fontSize: 16, fontWeight: "600", marginRight: 2 },
  input: { flex: 1, paddingVertical: 16, fontSize: 16 },
  saveBtn: { padding: 18, borderRadius: 16, alignItems: "center", marginTop: 8 },
  saveBtnText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
});
