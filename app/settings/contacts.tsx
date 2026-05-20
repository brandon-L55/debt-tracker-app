import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/context/ThemeContext";

export default function ContactsScreen() {
  const { colors: t } = useTheme();

  function requestAccess() {
    Alert.alert(
      "Coming Soon",
      "Contacts sync will be available in a future update. Your contacts will never be uploaded — matching happens on-device only.",
      [{ text: "OK" }]
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={styles.content}>
      <View style={[styles.statusCard, { backgroundColor: t.card, borderColor: t.border }]}>
        <View style={[styles.statusDot, { backgroundColor: "#F59E0B" }]} />
        <View style={styles.statusText}>
          <Text style={[styles.statusTitle, { color: t.text }]}>Permission Not Granted</Text>
          <Text style={[styles.statusSub, { color: t.textSub }]}>
            Allow access so debt entries can auto-match names to your contacts.
          </Text>
        </View>
      </View>

      <View style={[styles.infoCard, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text style={[styles.infoTitle, { color: t.text }]}>How it works</Text>
        <Text style={[styles.infoBody, { color: t.textSub }]}>
          When you add a debt, the app can suggest names from your contacts. Matching happens entirely on-device — no contact data is ever sent to a server.
        </Text>
      </View>

      <Pressable style={[styles.requestBtn, { backgroundColor: t.primary }]} onPress={requestAccess}>
        <Text style={styles.requestBtnText}>Request Contacts Access</Text>
      </Pressable>

      <Text style={[styles.note, { color: t.textMuted }]}>
        You can revoke access at any time in your device's Settings app.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 48 },
  statusCard: { flexDirection: "row", alignItems: "flex-start", gap: 14, borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  statusDot: { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
  statusText: { flex: 1 },
  statusTitle: { fontSize: 15, fontWeight: "700" },
  statusSub: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  infoCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 24 },
  infoTitle: { fontSize: 15, fontWeight: "700", marginBottom: 6 },
  infoBody: { fontSize: 13, lineHeight: 20 },
  requestBtn: { padding: 18, borderRadius: 16, alignItems: "center" },
  requestBtnText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  note: { fontSize: 12, textAlign: "center", marginTop: 16, lineHeight: 18 },
});
