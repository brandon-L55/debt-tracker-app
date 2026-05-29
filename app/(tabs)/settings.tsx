import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useTheme } from "@/context/ThemeContext";
import type { ThemeMode } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { ACCENTS } from "@/constants/theme";
import {
  User, Wallet, BookOpen, Shield, LogOut, ChevronRight, Sun, Moon,
} from "lucide-react-native";

export default function SettingsScreen() {
  const router = useRouter();
  const { colors: t, mode, setMode, accent, setAccent } = useTheme();
  const { signOut, session } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

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

  const navRows = [
    { label: "Profile",          sub: "Name, photo, contact info",      Icon: User,     route: "/settings/profile" },
    { label: "Payment Apps",     sub: "Venmo, Cash App, PayPal",        Icon: Wallet,   route: "/settings/payment-apps" },
    { label: "Contacts Access",  sub: "Auto-match names from contacts", Icon: BookOpen, route: "/settings/contacts" },
    { label: "Account Settings", sub: "Export, clear, or reset data",   Icon: Shield,   route: "/settings/account" },
  ];

  const themeOptions: { id: ThemeMode; label: string; Icon: typeof Sun }[] = [
    { id: "light", label: "Light", Icon: Sun },
    { id: "dark",  label: "Dark",  Icon: Moon },
  ];

  const currentAccent = ACCENTS.find(a => a.id === accent);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: t.text }]}>Settings</Text>

      {/* APP PREFERENCES */}
      <Text style={[styles.sectionLabel, { color: t.textMuted }]}>App Preferences</Text>
      <View style={[styles.sectionCard, { backgroundColor: t.card, borderColor: t.border }]}>

        {/* Theme switch */}
        <View style={[styles.themeRow, { borderBottomColor: t.border }]}>
          <Text style={[styles.rowLabel, { color: t.text }]}>Theme</Text>
          <View style={[styles.segControl, { backgroundColor: t.bg, borderColor: t.border }]}>
            {themeOptions.map(({ id, label, Icon }) => {
              const active = mode === id;
              const inner = (
                <View style={styles.segInner}>
                  <Icon size={14} color={active ? "#fff" : t.textSub} />
                  <Text style={[styles.segText, { color: active ? "#fff" : t.textSub }]}>{label}</Text>
                </View>
              );
              return (
                <Pressable key={id} onPress={() => setMode(id)} style={styles.segPressable}>
                  {active ? (
                    <LinearGradient
                      colors={[t.from, t.to] as [string, string]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={styles.segGradient}
                    >
                      {inner}
                    </LinearGradient>
                  ) : inner}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Accent picker */}
        <View style={styles.accentRow}>
          <View style={styles.accentHeader}>
            <Text style={[styles.rowLabel, { color: t.text }]}>Accent</Text>
            <Text style={[styles.accentName, { color: t.textMuted }]}>{currentAccent?.name}</Text>
          </View>
          <View style={styles.swatchRow}>
            {ACCENTS.map(a => {
              const selected = a.id === accent;
              const swatch = (
                <LinearGradient
                  colors={[a.from, a.to] as [string, string]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.swatch}
                />
              );
              return (
                <Pressable key={a.id} onPress={() => setAccent(a.id)}>
                  {selected ? (
                    <View style={[styles.swatchRing, {
                      borderColor: a.from,
                      shadowColor: a.from,
                      shadowOpacity: 0.35,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 4,
                    }]}>
                      {swatch}
                    </View>
                  ) : swatch}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* ACCOUNT */}
      <Text style={[styles.sectionLabel, { color: t.textMuted, marginTop: 18 }]}>Account</Text>
      <View style={[styles.sectionCard, { backgroundColor: t.card, borderColor: t.border }]}>
        {navRows.map((row, i) => (
          <Pressable
            key={row.label}
            style={({ pressed }) => [
              styles.navRow,
              { borderBottomColor: t.border, borderBottomWidth: i === navRows.length - 1 ? 0 : 1 },
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => router.push(row.route as any)}
          >
            <View style={[styles.iconChip, { backgroundColor: t.primarySoft }]}>
              <row.Icon size={20} color={t.primary} strokeWidth={1.8} />
            </View>
            <View style={styles.navRowContent}>
              <Text style={[styles.navRowLabel, { color: t.text }]}>{row.label}</Text>
              <Text style={[styles.navRowSub, { color: t.textSub }]}>{row.sub}</Text>
            </View>
            <ChevronRight size={18} color={t.textMuted} />
          </Pressable>
        ))}
      </View>

      {/* SESSION */}
      {session ? (
        <>
          <Text style={[styles.sectionLabel, { color: t.textMuted, marginTop: 18 }]}>Session</Text>
          <View style={[styles.sectionCard, { backgroundColor: t.card, borderColor: t.border }]}>
            <Pressable
              style={({ pressed }) => [styles.signOutRow, pressed && { opacity: 0.85 }]}
              onPress={handleSignOut}
              disabled={signingOut}
            >
              <View style={[styles.iconChip, { backgroundColor: t.redSoft }]}>
                {signingOut
                  ? <ActivityIndicator size="small" color={t.red} />
                  : <LogOut size={18} color={t.red} />}
              </View>
              <Text style={[styles.signOutLabel, { color: t.red }]}>
                {signingOut ? "Signing Out…" : "Sign Out"}
              </Text>
              <ChevronRight size={18} color={t.red} style={{ opacity: 0.6 } as any} />
            </Pressable>
          </View>
        </>
      ) : null}

      <Text style={[styles.footer, { color: t.textMuted }]}>
        Your debts, contacts, and profile sync securely to the cloud.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 30, fontWeight: "700", letterSpacing: -0.8, marginTop: 60, marginBottom: 28 },

  sectionLabel: {
    fontSize: 11, fontWeight: "700", letterSpacing: 1.2,
    textTransform: "uppercase", marginBottom: 8, marginLeft: 4,
  },
  sectionCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },

  // Theme switch
  themeRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 16, borderBottomWidth: 1,
  },
  rowLabel: { fontSize: 15, fontWeight: "500" },
  segControl: { flexDirection: "row", gap: 4, padding: 3, borderRadius: 12, borderWidth: 1 },
  segPressable: { flex: 1 },
  segGradient: { borderRadius: 9 },
  segInner: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9 },
  segText: { fontSize: 12, fontWeight: "600" },

  // Accent picker
  accentRow: { padding: 16, paddingBottom: 18 },
  accentHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  accentName: { fontSize: 12, fontWeight: "500" },
  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  swatch: { width: 32, height: 32, borderRadius: 16 },
  swatchRing: { padding: 2, borderRadius: 20, borderWidth: 2 },

  // Nav rows
  navRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
  iconChip: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  navRowContent: { flex: 1 },
  navRowLabel: { fontSize: 15, fontWeight: "600" },
  navRowSub: { fontSize: 12, color: "#64748B" },

  // Sign out
  signOutRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  signOutLabel: { flex: 1, fontSize: 15, fontWeight: "600" },

  footer: { fontSize: 11, textAlign: "center", marginTop: 18 },
});
