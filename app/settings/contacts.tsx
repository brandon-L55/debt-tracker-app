import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useTheme } from "@/context/ThemeContext";
import { RefreshCw, UserX, Eye, Users, BellOff, ChevronRight } from "lucide-react-native";

export default function ContactsSettingsScreen() {
  const router = useRouter();
  const { colors: t } = useTheme();

  const rows = [
    {
      label: "Sync Contacts",
      sub: "Find friends from your phone contacts",
      Icon: RefreshCw,
      route: "/settings/sync-contacts" as const,
      placeholder: false,
    },
    {
      label: "Blocked Contacts",
      sub: "View and unblock people you've blocked",
      Icon: UserX,
      route: "/settings/blocked-contacts" as const,
      placeholder: false,
    },
    {
      label: "Contact Discovery",
      sub: "Choose how people can find you",
      Icon: Eye,
      route: null,
      placeholder: true,
    },
    {
      label: "Friend Requests / Debt Requests",
      sub: "Control who can send you requests",
      Icon: Users,
      route: null,
      placeholder: true,
    },
    {
      label: "Muted Contacts",
      sub: "Manage people whose reminders are silenced",
      Icon: BellOff,
      route: null,
      placeholder: true,
    },
  ];

  return (
    <>
      <Stack.Screen options={{ title: "Contacts", headerBackTitle: "Settings" }} />
      <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={styles.content}>
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
        {rows.map((row, i) => {
          const isLast = i === rows.length - 1;
          return (
            <Pressable
              key={row.label}
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: t.border, borderBottomWidth: isLast ? 0 : 1 },
                row.placeholder && styles.placeholderRow,
                pressed && !row.placeholder && { opacity: 0.85 },
              ]}
              onPress={() => {
                if (row.route) router.push(row.route as any);
              }}
              disabled={row.placeholder}
            >
              <View style={[styles.iconChip, { backgroundColor: t.primarySoft }]}>
                <row.Icon size={20} color={t.primary} strokeWidth={1.8} />
              </View>
              <View style={styles.rowContent}>
                <View style={styles.labelRow}>
                  <Text style={[styles.rowLabel, { color: t.text }]}>{row.label}</Text>
                  {row.placeholder && (
                    <View style={[styles.soonBadge, { backgroundColor: t.primarySoft, borderColor: t.primaryBorder }]}>
                      <Text style={[styles.soonText, { color: t.primary }]}>Soon</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.rowSub, { color: t.textSub }]}>{row.sub}</Text>
              </View>
              <ChevronRight size={18} color={t.textMuted} style={{ opacity: row.placeholder ? 0.4 : 1 } as any} />
            </Pressable>
          );
        })}
      </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 48 },
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  row: {
    flexDirection: "row", alignItems: "center",
    gap: 14, paddingVertical: 14, paddingHorizontal: 16,
  },
  placeholderRow: { opacity: 0.55 },
  iconChip: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowContent: { flex: 1 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowLabel: { fontSize: 15, fontWeight: "600" },
  rowSub: { fontSize: 12, marginTop: 1 },
  soonBadge: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  soonText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
});
