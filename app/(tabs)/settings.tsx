import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { useTheme } from "@/context/ThemeContext";
import type { ThemeMode } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "☀️" },
  { value: "dark", label: "Dark", icon: "🌙" },
];

type NavRow = { label: string; route: string; subtitle?: string; icon: string; iconBg: string };

export default function SettingsScreen() {
  const router = useRouter();
  const { colors: t, mode, setMode, isDark } = useTheme();
  const { signOut, session } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const NAV_ROWS: NavRow[] = [
    { label: "Profile", route: "/settings/profile", subtitle: "Name, photo, contact info", icon: "👤", iconBg: isDark ? "#1C1040" : "#F3EFFF" },
    { label: "Payment Apps", route: "/settings/payment-apps", subtitle: "Venmo, Cash App, PayPal", icon: "💳", iconBg: isDark ? "#021A14" : "#E6FAF6" },
    { label: "Contacts Access", route: "/settings/contacts", subtitle: "Auto-match names from contacts", icon: "📒", iconBg: isDark ? "#130A2E" : "#EFE9FF" },
    { label: "Account Settings", route: "/settings/account", subtitle: "Export, clear, or reset data", icon: "⚙️", iconBg: isDark ? "#1A2038" : "#F6F3FF" },
  ];

  async function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          setSigningOut(true);
          await signOut();
          setSigningOut(false);
          router.replace("/auth/login");
        },
      },
    ]);
  }

  const btnShadow = isDark ? {
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  } : {};

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: t.text }]}>Settings</Text>

      <Text style={[styles.sectionLabel, { color: t.textMuted }]}>APP PREFERENCES</Text>
      <View style={[styles.section, { backgroundColor: t.card, borderColor: t.border }]}>
        <View style={styles.themeRow}>
          <Text style={[styles.rowLabel, { color: t.text }]}>Theme</Text>
          <View style={[styles.segmentedControl, { backgroundColor: t.elevatedCard, borderColor: t.border }]}>
            {THEME_OPTIONS.map(opt => {
              const isActive = mode === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[
                    styles.segment,
                    isActive && [styles.segmentActive, { backgroundColor: t.primary }, btnShadow],
                  ]}
                  onPress={() => setMode(opt.value)}
                >
                  <Text style={styles.segmentIcon}>{opt.icon}</Text>
                  <Text style={[styles.segmentText, { color: isActive ? "#FFFFFF" : t.textSub }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

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
            <View style={[styles.rowIcon, { backgroundColor: row.iconBg }]}>
              <Text style={styles.rowIconText}>{row.icon}</Text>
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowLabel, { color: t.text }]}>{row.label}</Text>
              {row.subtitle && <Text style={[styles.rowSub, { color: t.textSub }]}>{row.subtitle}</Text>}
            </View>
            <Text style={[styles.chevron, { color: t.textMuted }]}>›</Text>
          </Pressable>
        ))}
      </View>

      {session ? (
        <>
          <Text style={[styles.sectionLabel, { color: t.textMuted }]}>SESSION</Text>
          <View style={[styles.section, { backgroundColor: t.card, borderColor: t.border }]}>
            <Pressable
              style={styles.rowLast}
              onPress={handleSignOut}
              disabled={signingOut}
            >
              <View style={[styles.rowIcon, { backgroundColor: isDark ? "#2A0F10" : "#FEF2F2" }]}>
                <Text style={styles.rowIconText}>🚪</Text>
              </View>
              <View style={styles.rowContent}>
                <Text style={[styles.rowLabel, { color: t.red }]}>
                  {signingOut ? "Signing Out…" : "Sign Out"}
                </Text>
              </View>
              {signingOut
                ? <ActivityIndicator size="small" color={t.red} />
                : <Text style={[styles.chevron, { color: t.red }]}>›</Text>
              }
            </Pressable>
          </View>
        </>
      ) : null}

      <Text style={[styles.footer, { color: t.textMuted }]}>
        All data is stored locally on this device.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 32, fontWeight: "800", marginTop: 60, marginBottom: 28, letterSpacing: -0.5 },
  sectionLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  section: { borderRadius: 20, borderWidth: 1, overflow: "hidden", marginBottom: 24 },
  themeRow: { padding: 16, gap: 12 },
  segmentedControl: { flexDirection: "row", borderRadius: 14, borderWidth: 1, padding: 3, gap: 3 },
  segment: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 11, paddingVertical: 8 },
  segmentActive: { borderRadius: 11 },
  segmentIcon: { fontSize: 14 },
  segmentText: { fontSize: 14, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, gap: 12 },
  rowLast: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  rowIconText: { fontSize: 18 },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 16, fontWeight: "500" },
  rowSub: { fontSize: 12, marginTop: 2 },
  chevron: { fontSize: 22 },
  footer: { fontSize: 12, textAlign: "center", marginTop: 8 },
});
