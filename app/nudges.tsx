import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View,
} from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { getUnreadNudges, markNudgeRead, type Nudge } from "@/lib/services/nudgeService";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NudgesScreen() {
  const { colors: t } = useTheme();
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setNudges(await getUnreadNudges());
    } catch (e: any) {
      setError(e?.message ?? "Failed to load nudges.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleMarkRead(id: string) {
    setMarkingId(id);
    try {
      await markNudgeRead(id);
      setNudges(prev => prev.filter(n => n.id !== id));
    } catch {
      // silently ignore — nudge stays in list so user can retry
    } finally {
      setMarkingId(null);
    }
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator size="large" color={t.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <Text style={styles.stateIcon}>⚠️</Text>
        <Text style={[styles.stateTitle, { color: t.text }]}>Couldn{"'"}t load nudges</Text>
        <Text style={[styles.stateSub, { color: t.textSub }]}>{error}</Text>
        <Pressable
          style={({ pressed }) => [styles.retryBtn, { backgroundColor: t.primary, opacity: pressed ? 0.8 : 1 }]}
          onPress={load}
        >
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (nudges.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <Text style={styles.stateIcon}>🔔</Text>
        <Text style={[styles.stateTitle, { color: t.text }]}>No new nudges</Text>
        <Text style={[styles.stateSub, { color: t.textSub }]}>
          When someone reminds you about a debt, it will appear here.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={styles.list}
      data={nudges}
      keyExtractor={n => n.id}
      renderItem={({ item }) => (
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[styles.message, { color: t.text }]}>{item.message}</Text>
          <View style={styles.cardFooter}>
            <Text style={[styles.time, { color: t.textMuted }]}>{timeAgo(item.createdAt)}</Text>
            <Pressable
              style={({ pressed }) => [
                styles.markBtn,
                { backgroundColor: t.primarySoft, borderColor: t.primaryBorder, opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={() => handleMarkRead(item.id)}
              disabled={markingId === item.id}
            >
              {markingId === item.id
                ? <ActivityIndicator size="small" color={t.primary} />
                : <Text style={[styles.markBtnText, { color: t.primary }]}>Mark as Read</Text>}
            </Pressable>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32, gap: 10 },
  stateIcon:  { fontSize: 48, marginBottom: 4 },
  stateTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  stateSub:   { fontSize: 14, textAlign: "center", lineHeight: 20 },
  retryBtn:    { marginTop: 8, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 12 },
  retryBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  list: { padding: 16, paddingBottom: 40, gap: 12 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  message: { fontSize: 15, lineHeight: 22 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  time: { fontSize: 12 },
  markBtn: { borderRadius: 10, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 12, minWidth: 40, alignItems: "center" },
  markBtnText: { fontSize: 13, fontWeight: "600" },
});
