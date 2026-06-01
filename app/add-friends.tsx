import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useContacts } from "@/context/ContactsContext";
import { supabase } from "@/lib/supabase";
import { Avatar } from "@/components/Avatar";
import {
  getIncomingFriendRequests,
  getOutgoingFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
} from "@/lib/services/friendRequestsService";
import type { FriendRequest } from "@/lib/services/friendRequestsService";

type ActiveTab = 0 | 1 | 2;

const TABS = [
  { label: "Added You" },
  { label: "Recommended" },
  { label: "Pending" },
];

function personLabel(req: FriendRequest, side: "sender" | "recipient"): string {
  const p = side === "sender" ? req.senderProfile : req.recipientProfile;
  return p?.displayName || p?.username || p?.phone || "Unknown";
}

function personHandle(req: FriendRequest, side: "sender" | "recipient"): string | null {
  const p = side === "sender" ? req.senderProfile : req.recipientProfile;
  if (!p) return null;
  if (p.username) return `@${p.username}`;
  if (p.phone) return p.phone;
  return null;
}

function PersonCard({
  name,
  handle,
  actions,
  showDivider,
}: {
  name: string;
  handle?: string | null;
  actions: ReactNode;
  showDivider: boolean;
}) {
  const { colors: t } = useTheme();
  return (
    <View>
      <View style={styles.personRow}>
        <Avatar name={name} size={40} />
        <View style={styles.personInfo}>
          <Text style={[styles.personName, { color: t.text }]}>{name}</Text>
          {handle ? (
            <Text style={[styles.personHandle, { color: t.textMuted }]}>{handle}</Text>
          ) : null}
        </View>
        {actions}
      </View>
      {showDivider && <View style={[styles.divider, { backgroundColor: t.border }]} />}
    </View>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  const { colors: t } = useTheme();
  return (
    <View style={styles.emptyFull}>
      <Text style={[styles.emptyTitle, { color: t.text }]}>{title}</Text>
      <Text style={[styles.emptySubtitle, { color: t.textMuted }]}>{subtitle}</Text>
    </View>
  );
}

export default function AddFriendsScreen() {
  const { colors: t } = useTheme();
  const { session } = useAuth();
  const { addLinkedIndividual, addCachedIndividuals } = useContacts();

  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [loadingIncoming, setLoadingIncoming] = useState(true);
  const [loadingOutgoing, setLoadingOutgoing] = useState(true);
  const [actingIds, setActingIds] = useState<Set<string>>(new Set());
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());

  const pendingIncoming = incoming.filter(r => !acceptedIds.has(r.id));
  const incomingBadge = pendingIncoming.length;

  const [activeTab, setActiveTab] = useState<ActiveTab>(0);
  const [tabSelectedWhenEmpty, setTabSelectedWhenEmpty] = useState(false);

  useEffect(() => {
    if (activeTab === 0 && incomingBadge === 0 && !loadingIncoming && !tabSelectedWhenEmpty) {
      setActiveTab(1);
    }
  }, [incomingBadge, activeTab, loadingIncoming, tabSelectedWhenEmpty]);

  function selectTab(tab: ActiveTab) {
    if (tab === 0) setTabSelectedWhenEmpty(incomingBadge === 0);
    setActiveTab(tab);
  }

  const loadIncoming = useCallback(async () => {
    setLoadingIncoming(true);
    try {
      setIncoming(await getIncomingFriendRequests());
    } catch (e) {
      console.warn("[WARN] getIncomingFriendRequests:", e);
    } finally {
      setLoadingIncoming(false);
    }
  }, []);

  const loadOutgoing = useCallback(async () => {
    setLoadingOutgoing(true);
    try {
      setOutgoing(await getOutgoingFriendRequests());
    } catch (e) {
      console.warn("[WARN] getOutgoingFriendRequests:", e);
    } finally {
      setLoadingOutgoing(false);
    }
  }, []);

  useEffect(() => { loadIncoming(); }, [loadIncoming]);
  useEffect(() => { loadOutgoing(); }, [loadOutgoing]);

  // Realtime: reload relevant list whenever a friend_request row changes.
  useEffect(() => {
    if (!session) return;

    const uid = session.user.id;
    const channel = supabase
      .channel(`friend-requests-sync:${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_requests", filter: `recipient_user_id=eq.${uid}` },
        () => { loadIncoming(); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_requests", filter: `sender_user_id=eq.${uid}` },
        () => { loadOutgoing(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  function setActing(id: string, active: boolean) {
    setActingIds(prev => {
      const next = new Set(prev);
      active ? next.add(id) : next.delete(id);
      return next;
    });
  }

  async function handleAccept(req: FriendRequest) {
    setActing(req.id, true);
    try {
      const newContact = await acceptFriendRequest(req.id);
      if (newContact) {
        addCachedIndividuals([newContact]);
      }
      setAcceptedIds(prev => new Set([...prev, req.id]));
    } catch (e) {
      console.warn("[WARN] acceptFriendRequest:", e);
    } finally {
      setActing(req.id, false);
    }
  }

  async function handleIgnore(req: FriendRequest) {
    setActing(req.id, true);
    try {
      await rejectFriendRequest(req.id);
      setIncoming(prev => prev.filter(r => r.id !== req.id));
    } catch (e) {
      console.warn("[WARN] rejectFriendRequest:", e);
    } finally {
      setActing(req.id, false);
    }
  }

  async function handleCancel(req: FriendRequest) {
    setActing(req.id, true);
    try {
      await cancelFriendRequest(req.id);
      setOutgoing(prev => prev.filter(r => r.id !== req.id));
    } catch (e) {
      console.warn("[WARN] cancelFriendRequest:", e);
    } finally {
      setActing(req.id, false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: t.border }]}>
        {TABS.map(({ label }, i) => {
          const tab = i as ActiveTab;
          const isActive = activeTab === tab;
          const badge = tab === 0 ? incomingBadge : 0;
          return (
            <Pressable
              key={tab}
              style={[styles.tabBtn, isActive && [styles.tabBtnActive, { borderBottomColor: t.primary }]]}
              onPress={() => selectTab(tab)}
            >
              <View style={styles.tabBtnInner}>
                <Text style={[styles.tabLabel, { color: isActive ? t.primary : t.textMuted }]}>{label}</Text>
                {badge > 0 && (
                  <View style={[styles.tabBadge, { backgroundColor: t.primary }]}>
                    <Text style={styles.tabBadgeText}>{badge}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>

        {/* Tab 0 — Added You (incoming requests) */}
        {activeTab === 0 && (
          loadingIncoming ? (
            <ActivityIndicator style={{ marginTop: 48 }} color={t.primary} />
          ) : incoming.length === 0 ? (
            <EmptyState
              title="No one has added you yet."
              subtitle="When someone sends you a friend or debt request, they'll appear here."
            />
          ) : (
            <View style={[styles.section, { backgroundColor: t.card, borderColor: t.border }]}>
              {incoming.map((req, index) => {
                const name = personLabel(req, "sender");
                const handle = personHandle(req, "sender");
                const isActing = actingIds.has(req.id);
                const accepted = acceptedIds.has(req.id);
                return (
                  <PersonCard
                    key={req.id}
                    name={name}
                    handle={handle}
                    showDivider={index < incoming.length - 1}
                    actions={
                      accepted ? (
                        <View style={[styles.doneBadge, { backgroundColor: t.greenSoft, borderColor: t.greenBorder }]}>
                          <Text style={[styles.doneBadgeText, { color: t.green }]}>Accepted</Text>
                        </View>
                      ) : isActing ? (
                        <ActivityIndicator size="small" color={t.primary} />
                      ) : (
                        <View style={styles.rowActions}>
                          <Pressable
                            style={[styles.actionBtn, { backgroundColor: t.primarySoft, borderColor: t.primaryBorder }]}
                            onPress={() => handleAccept(req)}
                          >
                            <Text style={[styles.actionBtnText, { color: t.primary }]}>Accept</Text>
                          </Pressable>
                          <Pressable
                            style={[styles.actionBtn, { backgroundColor: t.card, borderColor: t.border }]}
                            onPress={() => handleIgnore(req)}
                          >
                            <Text style={[styles.actionBtnText, { color: t.textMuted }]}>Ignore</Text>
                          </Pressable>
                        </View>
                      )
                    }
                  />
                );
              })}
            </View>
          )
        )}

        {/* Tab 1 — Recommended (placeholder) */}
        {activeTab === 1 && (
          <EmptyState
            title="No recommendations yet."
            subtitle="Recommendations are based on your phone number and username."
          />
        )}

        {/* Tab 2 — Pending (outgoing requests) */}
        {activeTab === 2 && (
          loadingOutgoing ? (
            <ActivityIndicator style={{ marginTop: 48 }} color={t.primary} />
          ) : outgoing.length === 0 ? (
            <EmptyState
              title="No pending outgoing requests."
              subtitle="People you add will appear here until they accept."
            />
          ) : (
            <View style={[styles.section, { backgroundColor: t.card, borderColor: t.border }]}>
              {outgoing.map((req, index) => {
                const name = personLabel(req, "recipient");
                const handle = personHandle(req, "recipient");
                const isActing = actingIds.has(req.id);
                return (
                  <PersonCard
                    key={req.id}
                    name={name}
                    handle={handle}
                    showDivider={index < outgoing.length - 1}
                    actions={
                      isActing ? (
                        <ActivityIndicator size="small" color={t.red} />
                      ) : (
                        <View style={styles.rowActions}>
                          <View style={[styles.pendingBadge, { backgroundColor: t.card, borderColor: t.border }]}>
                            <Text style={[styles.pendingBadgeText, { color: t.textMuted }]}>Pending</Text>
                          </View>
                          <Pressable
                            style={[styles.actionBtn, { backgroundColor: t.redSoft, borderColor: t.redBorder }]}
                            onPress={() => handleCancel(req)}
                          >
                            <Text style={[styles.actionBtnText, { color: t.red }]}>Cancel</Text>
                          </Pressable>
                        </View>
                      )
                    }
                  />
                );
              })}
            </View>
          )
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: { flexDirection: "row", borderBottomWidth: 1 },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabBtnActive: { borderBottomWidth: 2 },
  tabBtnInner: { flexDirection: "row", alignItems: "center", gap: 6 },
  tabLabel: { fontSize: 13, fontWeight: "700" },
  tabBadge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  tabBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  content: { padding: 20, paddingBottom: 48 },
  section: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  personRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  personInfo: { flex: 1 },
  personName: { fontSize: 15, fontWeight: "700" },
  personHandle: { fontSize: 13, marginTop: 2 },
  divider: { height: 1, marginLeft: 68 },
  rowActions: { flexDirection: "row", gap: 8 },
  actionBtn: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
  actionBtnText: { fontSize: 13, fontWeight: "700" },
  doneBadge: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  doneBadgeText: { fontSize: 13, fontWeight: "700" },
  pendingBadge: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  pendingBadgeText: { fontSize: 12, fontWeight: "600" },
  emptyFull: { paddingTop: 64, alignItems: "center", gap: 10, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  emptySubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
