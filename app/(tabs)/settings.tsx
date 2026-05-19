import { ScrollView, StyleSheet, Text, View } from "react-native";

const SETTINGS_ROWS = [
  "Profile",
  "Phone Number",
  "Backup Email",
  "Contacts Permission",
  "Payment Apps",
  "Account Settings",
];

export default function SettingsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.section}>
        {SETTINGS_ROWS.map((label, i) => (
          <View
            key={label}
            style={[styles.row, i < SETTINGS_ROWS.length - 1 && styles.rowBorder]}
          >
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    marginTop: 60,
    color: "#111827",
    marginBottom: 24,
  },
  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  rowLabel: {
    fontSize: 16,
    color: "#111827",
  },
  chevron: {
    fontSize: 22,
    color: "#9CA3AF",
  },
});
