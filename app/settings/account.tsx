import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useTheme } from "@/context/ThemeContext";
import { useDebts } from "@/context/DebtContext";
import { useContacts } from "@/context/ContactsContext";
import { useGroups } from "@/context/GroupsContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export default function AccountSettingsScreen() {
  const { colors: t } = useTheme();
  const { debts } = useDebts();
  const { individuals } = useContacts();
  const { groups } = useGroups();
  const { signOut } = useAuth();
  const router = useRouter();

  const [isResetting, setIsResetting] = useState(false);

  async function exportData() {
    const payload = JSON.stringify({ debts, individuals, groups }, null, 2);
    try {
      await Share.share({ message: payload, title: "Debt Tracker Export" });
    } catch {
      Alert.alert("Export failed", "Could not open the share sheet.");
    }
  }

  function confirmReset() {
    Alert.alert(
      "Reset Account Data",
      "This will permanently delete all your debts, payments, contacts, groups, friend connections, and nudges.\n\nWhat stays:\n• Your account login remains active — you can sign back in.\n• Your display name may remain visible in shared debt records.\n• Debts that others created, where you are listed as a participant, may be retained for their records.\n\nThis cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset Everything",
          style: "destructive",
          onPress: doReset,
        },
      ]
    );
  }

  async function doReset() {
    setIsResetting(true);
    try {
      // 15-second client-side timeout so the spinner cannot hang forever.
      const { error } = await Promise.race([
        supabase.rpc("reset_account"),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("The server is taking too long. Please check your connection and try again.")),
            15_000,
          )
        ),
      ]);
      if (error) throw error;

      console.log("[AccountReset] RPC succeeded — display_name preserved in DB");

      // Patch the local cache to clear only the fields the RPC nulled out
      // (payment handles).  display_name and avatar_url are preserved by the
      // RPC, so keeping them in the cache avoids a blank-name flash on the
      // next sign-in while the Supabase fetch completes.
      try {
        const raw = await AsyncStorage.getItem("@debt_tracker/profile_v2");
        if (raw) {
          const cached = JSON.parse(raw);
          console.log("[AccountReset] display_name in cache before patch:", cached.display_name);
          await AsyncStorage.setItem(
            "@debt_tracker/profile_v2",
            JSON.stringify({ ...cached, venmo_handle: "", cashapp_handle: "", paypal_handle: "" })
          );
        }
      } catch {}
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      console.warn("[AccountReset] failed:", msg);
      Alert.alert("Reset Failed", msg);
      setIsResetting(false);
      return;
    }

    // RPC succeeded. Sign out, then navigate explicitly.
    // We can't rely solely on the <Redirect> guard in (tabs)/_layout.tsx
    // because that guard lives on a background screen while this Stack
    // screen is focused and may not process the redirect.
    try {
      await signOut();
    } catch (err) {
      console.warn("[AccountReset] signOut error (non-fatal):", err);
    }
    router.replace("/auth/login");
  }

  const stats = `${individuals.length} contacts · ${groups.length} groups · ${debts.length} debts`;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={styles.content}>
      <View style={[styles.statsCard, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text style={[styles.statsLabel, { color: t.textSub }]}>In your account</Text>
        <Text style={[styles.statsValue, { color: t.text }]}>{stats}</Text>
      </View>

      <Text style={[styles.sectionLabel, { color: t.textMuted }]}>DATA</Text>
      <View style={[styles.section, { backgroundColor: t.card, borderColor: t.border }]}>
        <Pressable style={[styles.row, { borderBottomColor: t.border }]} onPress={exportData}>
          <Text style={[styles.rowLabel, { color: t.text }]}>Export Data</Text>
          <Text style={[styles.chevron, { color: t.textMuted }]}>›</Text>
        </Pressable>
        <Pressable
          style={styles.rowLast}
          onPress={confirmReset}
          disabled={isResetting}
        >
          {isResetting ? (
            <ActivityIndicator size="small" color={t.red} />
          ) : (
            <Text style={[styles.rowLabel, { color: t.red }]}>Reset Account Data</Text>
          )}
        </Pressable>
      </View>

      <Text style={[styles.footer, { color: t.textMuted }]}>
        Resetting deletes your debts, contacts, and groups. Your account login and display name are preserved.{"\n\n"}To permanently delete your account and login, use Request Account Deletion in Settings.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 48 },
  statsCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 28 },
  statsLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  statsValue: { fontSize: 15, fontWeight: "600", marginTop: 4 },
  sectionLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 },
  section: { borderRadius: 16, borderWidth: 1, overflow: "hidden", marginBottom: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1 },
  rowLast: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 16, paddingHorizontal: 20 },
  rowLabel: { fontSize: 16 },
  chevron: { fontSize: 22 },
  footer: { fontSize: 12, textAlign: "center", lineHeight: 18 },
});
