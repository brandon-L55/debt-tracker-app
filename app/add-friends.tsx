import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { Avatar } from "@/components/Avatar";

type Person = { id: string; name: string; handle?: string };
type ActiveTab = 0 | 1 | 2;

const MOCK_ADDED_YOU: Person[] = [
  { id: "a1", name: "Chris Martin", handle: "@chrism" },
  { id: "a2", name: "Sam Rodriguez", handle: "+1 555-876-5432" },
];

const MOCK_RECOMMENDED: Person[] = [
  { id: "r1", name: "Alex Johnson", handle: "@alexj" },
  { id: "r2", name: "Maya Patel", handle: "+1 555-234-5678" },
  { id: "r3", name: "Jordan Lee", handle: "@jordanlee" },
];

const MOCK_PENDING: Person[] = [
  { id: "p1", name: "Taylor Kim", handle: "@taylork" },
  { id: "p2", name: "River Chen", handle: "+1 555-111-2222" },
];

const TABS = [
  { label: "Added You" },
  { label: "Recommended" },
  { label: "Pending" },
];

function PersonCard({
  person,
  actions,
  showDivider,
}: {
  person: Person;
  actions: ReactNode;
  showDivider: boolean;
}) {
  const { colors: t } = useTheme();
  return (
    <View>
      <View style={styles.personRow}>
        <Avatar name={person.name} size={40} />
        <View style={styles.personInfo}>
          <Text style={[styles.personName, { color: t.text }]}>{person.name}</Text>
          {person.handle ? (
            <Text style={[styles.personHandle, { color: t.textMuted }]}>{person.handle}</Text>
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

  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set());
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set());

  // Visible = not ignored. Accepted ones stay visible with a badge.
  const visibleAddedYou = MOCK_ADDED_YOU.filter(p => !ignoredIds.has(p.id));
  // Pending = not yet accepted or ignored (drives the auto-switch and badge count).
  const pendingAddedYou = visibleAddedYou.filter(p => !acceptedIds.has(p.id));
  const visiblePending = MOCK_PENDING.filter(p => !cancelledIds.has(p.id));

  // Default to "Added You" if there are incoming requests, otherwise "Recommended".
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    MOCK_ADDED_YOU.length > 0 ? 0 : 1
  );
  // True when the user manually navigated to tab 0 while it was already empty.
  // Prevents auto-switching away when the user intentionally views the empty state.
  const [tabSelectedWhenEmpty, setTabSelectedWhenEmpty] = useState(false);

  useEffect(() => {
    if (activeTab === 0 && pendingAddedYou.length === 0 && !tabSelectedWhenEmpty) {
      setActiveTab(1);
    }
  }, [pendingAddedYou.length, activeTab, tabSelectedWhenEmpty]);

  function selectTab(tab: ActiveTab) {
    if (tab === 0) setTabSelectedWhenEmpty(pendingAddedYou.length === 0);
    setActiveTab(tab);
  }

  const incomingBadge = pendingAddedYou.length;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* Segmented tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: t.border }]}>
        {TABS.map(({ label }, i) => {
          const tab = i as ActiveTab;
          const isActive = activeTab === tab;
          const badge = tab === 0 ? incomingBadge : 0;
          return (
            <Pressable
              key={tab}
              style={[
                styles.tabBtn,
                isActive && [styles.tabBtnActive, { borderBottomColor: t.primary }],
              ]}
              onPress={() => selectTab(tab)}
            >
              <View style={styles.tabBtnInner}>
                <Text style={[styles.tabLabel, { color: isActive ? t.primary : t.textMuted }]}>
                  {label}
                </Text>
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

        {/* Tab 0 — People who added you */}
        {activeTab === 0 && (
          visibleAddedYou.length === 0 ? (
            <EmptyState
              title="No one has added you yet."
              subtitle="When someone adds you, they will appear here."
            />
          ) : (
            <View style={[styles.section, { backgroundColor: t.card, borderColor: t.border }]}>
              {visibleAddedYou.map((person, index) => (
                <PersonCard
                  key={person.id}
                  person={person}
                  showDivider={index < visibleAddedYou.length - 1}
                  actions={
                    acceptedIds.has(person.id) ? (
                      <View style={[styles.doneBadge, { backgroundColor: t.greenSoft, borderColor: t.greenBorder }]}>
                        <Text style={[styles.doneBadgeText, { color: t.green }]}>Accepted</Text>
                      </View>
                    ) : (
                      <View style={styles.rowActions}>
                        <Pressable
                          style={[styles.actionBtn, { backgroundColor: t.primarySoft, borderColor: t.primaryBorder }]}
                          onPress={() => setAcceptedIds(prev => new Set([...prev, person.id]))}
                        >
                          <Text style={[styles.actionBtnText, { color: t.primary }]}>Accept</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.actionBtn, { backgroundColor: t.card, borderColor: t.border }]}
                          onPress={() => setIgnoredIds(prev => new Set([...prev, person.id]))}
                        >
                          <Text style={[styles.actionBtnText, { color: t.textMuted }]}>Ignore</Text>
                        </Pressable>
                      </View>
                    )
                  }
                />
              ))}
            </View>
          )
        )}

        {/* Tab 1 — Recommended friends */}
        {activeTab === 1 && (
          MOCK_RECOMMENDED.length === 0 ? (
            <EmptyState
              title="No recommendations yet."
              subtitle="Recommendations are based on your phone number and username."
            />
          ) : (
            <>
              <View style={[styles.section, { backgroundColor: t.card, borderColor: t.border }]}>
                {MOCK_RECOMMENDED.map((person, index) => (
                  <PersonCard
                    key={person.id}
                    person={person}
                    showDivider={index < MOCK_RECOMMENDED.length - 1}
                    actions={
                      addedIds.has(person.id) ? (
                        <View style={[styles.doneBadge, { backgroundColor: t.greenSoft, borderColor: t.greenBorder }]}>
                          <Text style={[styles.doneBadgeText, { color: t.green }]}>Added</Text>
                        </View>
                      ) : (
                        <Pressable
                          style={[styles.actionBtn, { backgroundColor: t.primarySoft, borderColor: t.primaryBorder }]}
                          onPress={() => setAddedIds(prev => new Set([...prev, person.id]))}
                        >
                          <Text style={[styles.actionBtnText, { color: t.primary }]}>Add</Text>
                        </Pressable>
                      )
                    }
                  />
                ))}
              </View>
              <Text style={[styles.footer, { color: t.textMuted }]}>
                Recommendations are based on your phone number and username.
              </Text>
            </>
          )
        )}

        {/* Tab 2 — People who haven't added you back (outgoing pending) */}
        {activeTab === 2 && (
          visiblePending.length === 0 ? (
            <EmptyState
              title="No pending outgoing requests."
              subtitle="People you add will appear here until they accept."
            />
          ) : (
            <View style={[styles.section, { backgroundColor: t.card, borderColor: t.border }]}>
              {visiblePending.map((person, index) => (
                <PersonCard
                  key={person.id}
                  person={person}
                  showDivider={index < visiblePending.length - 1}
                  actions={
                    <View style={styles.rowActions}>
                      <View style={[styles.pendingBadge, { backgroundColor: t.card, borderColor: t.border }]}>
                        <Text style={[styles.pendingBadgeText, { color: t.textMuted }]}>Pending</Text>
                      </View>
                      <Pressable
                        style={[styles.actionBtn, { backgroundColor: t.redSoft, borderColor: t.redBorder }]}
                        onPress={() => setCancelledIds(prev => new Set([...prev, person.id]))}
                      >
                        <Text style={[styles.actionBtnText, { color: t.red }]}>Cancel</Text>
                      </Pressable>
                    </View>
                  }
                />
              ))}
            </View>
          )
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabBtnActive: {
    borderBottomWidth: 2,
  },
  tabBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  tabBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  content: { padding: 20, paddingBottom: 48 },
  section: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
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
  footer: { fontSize: 12, textAlign: "center", lineHeight: 18, marginTop: 16 },
});
