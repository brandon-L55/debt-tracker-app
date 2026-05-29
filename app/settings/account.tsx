import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Share } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/context/ThemeContext";
import { useDebts } from "@/context/DebtContext";
import { useContacts } from "@/context/ContactsContext";
import { useGroups } from "@/context/GroupsContext";

export default function AccountSettingsScreen() {
  const { colors: t } = useTheme();
  const { debts, reset } = useDebts();
  const { individuals } = useContacts();
  const { groups } = useGroups();

  async function exportData() {
    const payload = JSON.stringify({ debts, individuals, groups }, null, 2);
    try {
      await Share.share({ message: payload, title: "Debt Tracker Export" });
    } catch {
      Alert.alert("Export failed", "Could not open the share sheet.");
    }
  }

  function confirmClear() {
    Alert.alert(
      "Clear All Data",
      "This will permanently delete all your debts, friends, and groups. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Everything",
          style: "destructive",
          onPress: async () => {
            reset();
            Alert.alert("Done", "All local data has been cleared.");
          },
        },
      ]
    );
  }

  function confirmReset() {
    Alert.alert(
      "Reset App",
      "This resets the app to its original state, clearing all saved data.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset App",
          style: "destructive",
          onPress: async () => {
            reset();
            await AsyncStorage.removeItem("@debt_tracker/theme_mode");
            await AsyncStorage.removeItem("@debt_tracker/profile");
            Alert.alert("Done", "App has been reset.");
          },
        },
      ]
    );
  }

  const stats = `${individuals.length} individuals · ${groups.length} groups · ${debts.length} debts`;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={styles.content}>
      <View style={[styles.statsCard, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text style={[styles.statsLabel, { color: t.textSub }]}>Stored locally</Text>
        <Text style={[styles.statsValue, { color: t.text }]}>{stats}</Text>
      </View>

      <Text style={[styles.sectionLabel, { color: t.textMuted }]}>DATA</Text>
      <View style={[styles.section, { backgroundColor: t.card, borderColor: t.border }]}>
        <Pressable style={[styles.row, { borderBottomColor: t.border }]} onPress={exportData}>
          <Text style={[styles.rowLabel, { color: t.text }]}>Export Local Data</Text>
          <Text style={[styles.chevron, { color: t.textMuted }]}>›</Text>
        </Pressable>
        <Pressable style={[styles.row, { borderBottomColor: t.border }]} onPress={confirmClear}>
          <Text style={[styles.rowLabel, { color: t.red }]}>Clear Local Data</Text>
        </Pressable>
        <Pressable style={styles.rowLast} onPress={confirmReset}>
          <Text style={[styles.rowLabel, { color: t.red }]}>Reset App</Text>
        </Pressable>
      </View>

      <Text style={[styles.footer, { color: t.textMuted }]}>
        All data is stored on this device only. Clearing or resetting cannot be undone.
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
