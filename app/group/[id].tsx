import { useState, useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useDebts } from "@/context/DebtContext";
import { useGroups } from "@/context/GroupsContext";
import { useTheme } from "@/context/ThemeContext";
import { Avatar } from "@/components/Avatar";
import type { Debt } from "@/context/DebtContext";

type DebtSortOption =
  | "date" | "deadline-soonest" | "deadline-latest"
  | "overdue" | "no-deadline" | "nearest" | "farthest";

const DEBT_SORT_OPTIONS: { value: DebtSortOption; label: string }[] = [
  { value: "date", label: "Most Recent" },
  { value: "nearest", label: "Nearest Deadline" },
  { value: "farthest", label: "Farthest Deadline" },
  { value: "deadline-soonest", label: "Deadline: Soonest First" },
  { value: "deadline-latest", label: "Deadline: Latest First" },
  { value: "overdue", label: "Overdue First" },
  { value: "no-deadline", label: "No Deadline" },
];

function today(): string { return new Date().toISOString().split("T")[0]; }

function dlInfo(dl: string | null | undefined, td: string) {
  if (!dl) return null;
  const [y, m, d] = dl.split("-").map(Number);
  const label = `Due ${new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  return { label, overdue: dl < td };
}

function sortDebts(debts: Debt[], sort: DebtSortOption, td: string): Debt[] {
  if (sort === "no-deadline") return debts.filter(d => !d.deadline);
  return [...debts].sort((a, b) => {
    switch (sort) {
      case "date": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "deadline-soonest":
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1; if (!b.deadline) return -1;
        return a.deadline.localeCompare(b.deadline);
      case "deadline-latest":
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1; if (!b.deadline) return -1;
        return b.deadline.localeCompare(a.deadline);
      case "nearest":
      case "overdue": {
        const aO = !!(a.deadline && a.deadline < td);
        const bO = !!(b.deadline && b.deadline < td);
        if (aO && !bO) return -1; if (!aO && bO) return 1;
        if (!a.deadline && !b.deadline) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (!a.deadline) return 1; if (!b.deadline) return -1;
        return a.deadline.localeCompare(b.deadline);
      }
      case "farthest":
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1; if (!b.deadline) return -1;
        return b.deadline.localeCompare(a.deadline);
      default: return 0;
    }
  });
}

function statusStyle(status: string) {
  switch (status) {
    case "paid": return { backgroundColor: "#16A34A" };
    case "accepted": return { backgroundColor: "#2563EB" };
    case "rejected": return { backgroundColor: "#DC2626" };
    case "disputed": return { backgroundColor: "#7C3AED" };
    default: return { backgroundColor: "#F59E0B" };
  }
}

export default function GroupDashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { debts } = useDebts();
  const { groups } = useGroups();
  const { colors: t } = useTheme();
  const [sort, setSort] = useState<DebtSortOption>("date");
  const [showSortMenu, setShowSortMenu] = useState(false);

  const td = today();
  const groupId = Array.isArray(id) ? id[0] : id;
  const group = groups.find(g => g.id === groupId);

  if (!group) {
    return (
      <View style={[styles.notFound, { backgroundColor: t.bg }]}>
        <Text style={{ color: t.textMuted, fontSize: 16 }}>Group not found.</Text>
      </View>
    );
  }

  const groupDebts = debts.filter(d => d.groupId === groupId);
  const iOwe = groupDebts.filter(d => d.direction === "me").reduce((s, d) => s + d.amount, 0);
  const owedToMe = groupDebts.filter(d => d.direction === "them").reduce((s, d) => s + d.amount, 0);

  const memberBalances = group.members.map(m => {
    const bal = groupDebts.filter(d => d.person === m.name)
      .reduce((s, d) => s + (d.direction === "them" ? d.amount : -d.amount), 0);
    return { member: m, balance: bal };
  });
  const iOweMembers = memberBalances.filter(mb => mb.balance < 0);
  const oweMeMembers = memberBalances.filter(mb => mb.balance > 0);

  const displayDebts = useMemo(() => sortDebts(groupDebts, sort, td), [debts, sort, groupId]);
  const activeSortLabel = DEBT_SORT_OPTIONS.find(o => o.value === sort)?.label ?? "";

  return (
    <>
      <Stack.Screen
        options={{
          title: group.name,
          headerRight: () => (
            <Pressable onPress={() => router.push(`/edit-group?id=${groupId}` as any)} style={{ paddingHorizontal: 4 }}>
              <Text style={{ color: t.primary, fontSize: 16, fontWeight: "600" }}>Edit</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Avatar name={group.name} imageUri={group.imageUri} size={72} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.groupName, { color: t.text }]}>{group.name}</Text>
            <Text style={[styles.groupSub, { color: t.textSub }]}>
              {group.description || `${group.members.length} ${group.members.length === 1 ? "member" : "members"}`}
            </Text>
          </View>
        </View>

        <View style={styles.cardRow}>
          <View style={[styles.summaryCard, { backgroundColor: t.redSoft, borderColor: t.redBorder }]}>
            <Text style={[styles.summaryLabel, { color: t.textSub }]}>I Owe</Text>
            <Text style={[styles.summaryValue, { color: t.red }]}>${iOwe.toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: t.greenSoft, borderColor: t.greenBorder }]}>
            <Text style={[styles.summaryLabel, { color: t.textSub }]}>Owed to Me</Text>
            <Text style={[styles.summaryValue, { color: t.green }]}>${owedToMe.toFixed(2)}</Text>
          </View>
        </View>

        <Pressable style={[styles.addBtn, { backgroundColor: t.primary }]}
          onPress={() => router.push(`/add-group-debt?groupId=${groupId}` as any)}>
          <Text style={styles.addBtnText}>+ Add Group Debt</Text>
        </Pressable>

        {(iOweMembers.length > 0 || oweMeMembers.length > 0) && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: t.text }]}>Balance Breakdown</Text>
            {iOweMembers.length > 0 && (
              <>
                <Text style={[styles.breakdownHeader, { color: t.textMuted }]}>You owe</Text>
                {iOweMembers.map(({ member, balance }) => (
                  <View key={member.id} style={[styles.breakdownRow, { borderBottomColor: t.border }]}>
                    <Text style={[styles.breakdownName, { color: t.text }]}>{member.name}</Text>
                    <Text style={[styles.breakdownAmt, { color: t.red }]}>${Math.abs(balance).toFixed(2)}</Text>
                  </View>
                ))}
              </>
            )}
            {oweMeMembers.length > 0 && (
              <>
                <Text style={[styles.breakdownHeader, { color: t.textMuted }]}>Owe you</Text>
                {oweMeMembers.map(({ member, balance }) => (
                  <View key={member.id} style={[styles.breakdownRow, { borderBottomColor: t.border }]}>
                    <Text style={[styles.breakdownName, { color: t.text }]}>{member.name}</Text>
                    <Text style={[styles.breakdownAmt, { color: t.green }]}>${balance.toFixed(2)}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: t.text }]}>Transactions</Text>
            {groupDebts.length > 0 && (
              <Pressable
                style={[styles.sortBtn, { backgroundColor: sort !== "date" ? t.primarySoft : t.card, borderColor: sort !== "date" ? t.primaryBorder : t.border }]}
                onPress={() => setShowSortMenu(true)}
              >
                <Text style={[styles.sortBtnIcon, { color: sort !== "date" ? t.primary : t.text }]}>⇅</Text>
              </Pressable>
            )}
          </View>
          {sort !== "date" && groupDebts.length > 0 && <Text style={[styles.sortHint, { color: t.textSub }]}>Sorted by: {activeSortLabel}</Text>}

          {groupDebts.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: t.card, borderColor: t.border }]}>
              <Text style={[styles.emptyText, { color: t.textMuted }]}>No debts in this group yet.</Text>
            </View>
          ) : displayDebts.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: t.card, borderColor: t.border }]}>
              <Text style={[styles.emptyText, { color: t.textMuted }]}>No transactions match this filter.</Text>
            </View>
          ) : displayDebts.map(debt => {
            const dl = dlInfo(debt.deadline, td);
            return (
              <View key={debt.id} style={[styles.txRow, { backgroundColor: t.card, borderColor: t.border }]}>
                <View style={styles.txLeft}>
                  <Text style={[styles.txPerson, { color: t.text }]}>{debt.person}</Text>
                  {debt.reason ? <Text style={[styles.txReason, { color: t.textSub }]}>{debt.reason}</Text> : null}
                  <View style={styles.txMeta}>
                    <Text style={[styles.txDate, { color: t.textMuted }]}>{new Date(debt.createdAt).toLocaleDateString()}</Text>
                    <View style={[styles.statusBadge, statusStyle(debt.status)]}>
                      <Text style={styles.statusText}>{debt.status}</Text>
                    </View>
                  </View>
                  {dl ? <Text style={[styles.dlLabel, { color: dl.overdue ? t.red : t.primary }]}>{dl.label}{dl.overdue ? " · Overdue" : ""}</Text> : null}
                </View>
                <View style={styles.txRight}>
                  <Text style={[styles.txAmount, { color: debt.direction === "me" ? t.red : t.green }]}>
                    {debt.direction === "me" ? "-" : "+"}${debt.amount.toFixed(2)}
                  </Text>
                  <Text style={[styles.txDir, { color: t.textSub }]}>{debt.direction === "me" ? "You owe" : "Owes you"}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Modal visible={showSortMenu} transparent animationType="fade" onRequestClose={() => setShowSortMenu(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowSortMenu(false)}>
          <Pressable style={[styles.menu, { backgroundColor: t.card }]} onPress={e => e.stopPropagation()}>
            <Text style={[styles.menuTitle, { color: t.textMuted }]}>Sort By</Text>
            {DEBT_SORT_OPTIONS.map(opt => (
              <Pressable key={opt.value} style={[styles.menuRow, sort === opt.value && { backgroundColor: t.primarySoft }]}
                onPress={() => { setSort(opt.value); setShowSortMenu(false); }}>
                <Text style={[styles.menuRowText, { color: sort === opt.value ? t.primary : t.text }]}>{opt.label}</Text>
                {sort === opt.value && <Text style={[styles.menuCheck, { color: t.primary }]}>✓</Text>}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  notFound: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: 24, paddingBottom: 48 },
  header: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 20, marginTop: 8 },
  groupName: { fontSize: 24, fontWeight: "700" },
  groupSub: { fontSize: 14, marginTop: 2 },
  cardRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  summaryCard: { flex: 1, borderRadius: 16, padding: 18, borderWidth: 1 },
  summaryLabel: { fontSize: 13 },
  summaryValue: { fontSize: 24, fontWeight: "700", marginTop: 6 },
  addBtn: { padding: 16, borderRadius: 14, alignItems: "center", marginBottom: 28 },
  addBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  section: { marginBottom: 28 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  sortBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sortBtnIcon: { fontSize: 14 },
  sortHint: { fontSize: 12, marginBottom: 10 },
  breakdownHeader: { fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 8 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1 },
  breakdownName: { fontSize: 15, fontWeight: "600" },
  breakdownAmt: { fontSize: 15, fontWeight: "700" },
  emptyBox: { borderRadius: 14, padding: 20, alignItems: "center", borderWidth: 1 },
  emptyText: { fontSize: 14, textAlign: "center", fontStyle: "italic" },
  txRow: { borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  txLeft: { flex: 1, marginRight: 12 },
  txPerson: { fontSize: 15, fontWeight: "600" },
  txReason: { fontSize: 13, marginTop: 2 },
  txMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  txDate: { fontSize: 12 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: "600", color: "#FFFFFF" },
  dlLabel: { fontSize: 11, marginTop: 4, fontWeight: "500" },
  txRight: { alignItems: "flex-end" },
  txAmount: { fontSize: 17, fontWeight: "700" },
  txDir: { fontSize: 12, marginTop: 2 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", alignItems: "center" },
  menu: { borderRadius: 20, paddingVertical: 8, width: 280, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 8 },
  menuTitle: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  menuRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 8, borderRadius: 10 },
  menuRowText: { flex: 1, fontSize: 15 },
  menuCheck: { fontSize: 15, fontWeight: "700" },
});
