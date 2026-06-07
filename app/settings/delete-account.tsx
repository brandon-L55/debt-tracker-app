import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

const DELETED_ITEMS = [
  "Your account login (email, phone, and password)",
  "All debts and payments you created",
  "All contacts and groups you created",
  "All friend connections and payment nudges",
];

const RETAINED_ITEMS = [
  "Debts created by others where you are listed as a participant — those records belong to the other person and will show an unnamed participant.",
  "Your display name may remain visible in those shared records.",
];

export default function DeleteAccountScreen() {
  const { colors: t } = useTheme();
  const { signOut } = useAuth();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  function confirmDelete() {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all your data. You will not be able to sign back in.\n\nThis cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete My Account", style: "destructive", onPress: doDelete },
      ]
    );
  }

  async function doDelete() {
    setIsDeleting(true);
    try {
      // 20-second timeout — Edge Function runs two operations (RPC + admin delete).
      const result = await Promise.race([
        supabase.functions.invoke("delete-account", { method: "POST" }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("The server is taking too long. Please check your connection and try again.")),
            20_000,
          )
        ),
      ]);
      if (result.error) throw result.error;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again or contact support.";
      console.warn("[DeleteAccount] failed:", msg);
      Alert.alert("Deletion Failed", msg);
      setIsDeleting(false);
      return;
    }

    // Deletion succeeded. Clear the entire local cache — there is no account to return to.
    // signOut() is best-effort; the auth token is already invalid server-side.
    try {
      await AsyncStorage.clear();
    } catch {}
    try {
      await signOut();
    } catch {}

    router.replace("/auth/login");
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={styles.content}
    >
      {/* What gets deleted */}
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text style={[styles.cardTitle, { color: t.text }]}>What gets permanently deleted</Text>
        {DELETED_ITEMS.map((item) => (
          <View key={item} style={styles.bulletRow}>
            <Text style={[styles.bullet, { color: t.red }]}>•</Text>
            <Text style={[styles.bulletText, { color: t.text }]}>{item}</Text>
          </View>
        ))}
      </View>

      {/* What is retained / anonymized */}
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text style={[styles.cardTitle, { color: t.text }]}>What may be retained</Text>
        {RETAINED_ITEMS.map((item) => (
          <View key={item} style={styles.bulletRow}>
            <Text style={[styles.bullet, { color: t.textMuted }]}>•</Text>
            <Text style={[styles.bulletText, { color: t.textSub }]}>{item}</Text>
          </View>
        ))}
      </View>

      <Text style={[styles.warning, { color: t.red }]}>
        This action cannot be undone.{"\n"}You will not be able to sign back in.
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.deleteButton,
          { backgroundColor: t.red, opacity: pressed || isDeleting ? 0.8 : 1 },
        ]}
        onPress={confirmDelete}
        disabled={isDeleting}
      >
        {isDeleting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.deleteButtonText}>Delete My Account</Text>
        )}
      </Pressable>

      <Text style={[styles.footer, { color: t.textMuted }]}>
        Need help instead? Contact support from Settings before deleting.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 48 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 12,
  },
  bulletRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 20,
    width: 12,
  },
  bulletText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  warning: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginVertical: 20,
    lineHeight: 22,
  },
  deleteButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  footer: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});
