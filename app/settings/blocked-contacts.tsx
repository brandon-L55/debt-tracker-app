import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { useContacts } from "@/context/ContactsContext";
import { getBlockedUsers, unblockUser } from "@/lib/services/blockService";
import type { BlockedUser } from "@/lib/services/blockService";
import { Avatar } from "@/components/Avatar";

export default function BlockedContactsScreen() {
  const { colors: t } = useTheme();
  const { individuals } = useContacts();

  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockingIds, setUnblockingIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    loadBlockedUsers();
  }, []);

  async function loadBlockedUsers() {
    setLoading(true);
    try {
      const users = await getBlockedUsers();
      setBlockedUsers(users);
    } catch {
      // fail silently — empty state shows
    } finally {
      setLoading(false);
    }
  }

  // Resolve a friendly display name using the contact book first, then profile data.
  function resolveName(bu: BlockedUser): string {
    const contact = individuals.find(i => i.linkedUserId === bu.blockedUserId);
    if (contact) return contact.nickname || contact.name;
    return bu.displayName || bu.username || bu.phone || "Blocked User";
  }

  function resolveSubtitle(bu: BlockedUser): string | null {
    const contact = individuals.find(i => i.linkedUserId === bu.blockedUserId);
    if (contact) {
      // Show username/phone from profile if contact has only a name
      return bu.username || bu.phone || contact.phoneOrUsername || null;
    }
    return bu.username || bu.phone || null;
  }

  function confirmUnblock(bu: BlockedUser) {
    const name = resolveName(bu);
    Alert.alert(
      "Unblock Contact?",
      "They will be able to interact with you again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          onPress: async () => {
            setUnblockingIds(prev => new Set(prev).add(bu.blockedUserId));
            try {
              await unblockUser(bu.blockedUserId);
              setBlockedUsers(prev => prev.filter(u => u.blockedUserId !== bu.blockedUserId));
            } catch (e: unknown) {
              Alert.alert(
                "Error",
                e instanceof Error ? e.message : `Could not unblock ${name}.`,
              );
            } finally {
              setUnblockingIds(prev => {
                const next = new Set(prev);
                next.delete(bu.blockedUserId);
                return next;
              });
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: t.bg }]}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={styles.content}>
      {blockedUsers.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[styles.emptyTitle, { color: t.text }]}>No Blocked Contacts</Text>
          <Text style={[styles.emptyMsg, { color: t.textSub }]}>
            People you block will appear here.
          </Text>
        </View>
      ) : (
        <>
          <Text style={[styles.intro, { color: t.textSub }]}>
            Blocked contacts can't send you debt requests or nudges.
          </Text>
          <View style={[styles.listCard, { backgroundColor: t.card, borderColor: t.border }]}>
            {blockedUsers.map((bu, i) => {
              const name = resolveName(bu);
              const subtitle = resolveSubtitle(bu);
              const isUnblocking = unblockingIds.has(bu.blockedUserId);
              const isLast = i === blockedUsers.length - 1;

              return (
                <View
                  key={bu.blockedUserId}
                  style={[
                    styles.row,
                    !isLast && { borderBottomWidth: 1, borderBottomColor: t.border },
                  ]}
                >
                  <Avatar name={name} size={40} />
                  <View style={styles.rowContent}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.name, { color: t.text }]}>{name}</Text>
                      <View style={[styles.blockedBadge, { backgroundColor: t.redSoft, borderColor: t.redBorder }]}>
                        <Text style={[styles.blockedBadgeText, { color: t.red }]}>Blocked</Text>
                      </View>
                    </View>
                    {subtitle ? (
                      <Text style={[styles.subtitle, { color: t.textMuted }]}>{subtitle}</Text>
                    ) : null}
                  </View>
                  <Pressable
                    style={[
                      styles.unblockBtn,
                      { borderColor: t.border, backgroundColor: t.card },
                      isUnblocking && { opacity: 0.5 },
                    ]}
                    onPress={() => confirmUnblock(bu)}
                    disabled={isUnblocking}
                  >
                    <Text style={[styles.unblockBtnText, { color: t.text }]}>
                      {isUnblocking ? "…" : "Unblock"}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  intro: { fontSize: 13, lineHeight: 19, marginBottom: 16 },

  emptyCard: {
    borderRadius: 16, borderWidth: 1, padding: 32,
    alignItems: "center", gap: 8,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700" },
  emptyMsg: { fontSize: 14, textAlign: "center", lineHeight: 20 },

  listCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  row: {
    flexDirection: "row", alignItems: "center",
    gap: 12, paddingVertical: 14, paddingHorizontal: 16,
  },
  rowContent: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  name: { fontSize: 15, fontWeight: "600" },
  subtitle: { fontSize: 12, marginTop: 2 },

  blockedBadge: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  blockedBadgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },

  unblockBtn: {
    borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  unblockBtnText: { fontSize: 13, fontWeight: "600" },
});
