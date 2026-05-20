import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/context/ThemeContext";
import type { ThemeMode } from "@/context/ThemeContext";

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

type NavRow = { label: string; route: string; subtitle?: string };

const NAV_ROWS: NavRow[] = [
  { label: "Profile", route: "/settings/profile", subtitle: "Name, photo, contact info" },
  { label: "Payment Apps", route: "/settings/payment-apps", subtitle: "Venmo, Cash App, PayPal" },
  { label: "Contacts Access", route: "/settings/contacts", subtitle: "Auto-match names from contacts" },
  { label: "Account Settings", route: "/settings/account", subtitle: "Export, clear, or reset data" },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { colors: t, mode, setMode } = useTheme();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: t.text }]}>Settings</Text>

      {/* App Preferences */}
      <Text style={[styles.sectionLabel, { color: t.textMuted }]}>APP PREFERENCES</Text>
      <View style={[styles.section, { backgroundColor: t.card, borderColor: t.border }]}>
        <View style={[styles.themeRow, { borderBottomColor: t.border }]}>
          <Text style={[styles.rowLabel, { color: t.text }]}>Theme</Text>
          <View style={styles.themeToggle}>
            {THEME_OPTIONS.map(opt => (
              <Pressable
                key={opt.value}
                style={[
                  styles.themeOption,
                  { borderColor: t.border },
                  mode === opt.value && { backgroundColor: t.primary, borderColor: t.primary },
                ]}
                onPress={() => setMode(opt.value)}
              >
                <Text style={[styles.themeOptionText, { color: mode === opt.value ? "#FFFFFF" : t.textSub }]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* Navigation rows */}
      <Text style={[styles.sectionLabel, { color: t.textMuted }]}>ACCOUNT</Text>
      <View style={[styles.section, { backgroundColor: t.card, borderColor: t.border }]}>
        {NAV_ROWS.map((row, i) => (
          <Pressable
            key={row.label}
            style={[
              styles.row,
              { borderBottomColor: t.border },
              i === NAV_ROWS.length - 1 && styles.rowLast,
            ]}
            onPress={() => router.push(row.route as any)}
          >
            <View style={styles.rowContent}>
              <Text style={[styles.rowLabel, { color: t.text }]}>{row.label}</Text>
              {row.subtitle && <Text style={[styles.rowSub, { color: t.textSub }]}>{row.subtitle}</Text>}
            </View>
            <Text style={[styles.chevron, { color: t.textMuted }]}>›</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.footer, { color: t.textMuted }]}>
        All data is stored locally on this device.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 32, fontWeight: "700", marginTop: 60, marginBottom: 28 },
  sectionLabel: {
    fontSize: 12, fontWeight: "600", textTransform: "uppercase",
    letterSpacing: 0.6, marginBottom: 8, marginLeft: 4,
  },
  section: { borderRadius: 16, borderWidth: 1, overflow: "hidden", marginBottom: 24 },
  themeRow: { borderBottomWidth: 0, padding: 16, gap: 12 },
  themeToggle: { flexDirection: "row", gap: 8 },
  themeOption: { flex: 1, borderRadius: 10, borderWidth: 1, paddingVertical: 8, alignItems: "center" },
  themeOptionText: { fontSize: 13, fontWeight: "600" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1 },
  rowLast: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, paddingHorizontal: 20 },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 16 },
  rowSub: { fontSize: 12, marginTop: 2 },
  chevron: { fontSize: 22 },
  footer: { fontSize: 12, textAlign: "center", marginTop: 8 },
});
