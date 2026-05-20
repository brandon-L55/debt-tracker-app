import { useState, useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useDebts } from "@/context/DebtContext";
import { useTheme } from "@/context/ThemeContext";
import { useRouter } from "expo-router";
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
      case "date":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
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

export default function HomeScreen() {
  const router = useRouter();
  const { debts } = useDebts();
  const { colors: t } = useTheme();
  const [sort, setSort] = useState<DebtSortOption>("date");
  const [showSortMenu, setShowSortMenu] = useState(false);

  const td = today();
  const youOwe = debts.filter(d => d.direction === "me").reduce((s, d) => s + d.amount, 0);
  const owedToYou = debts.filter(d => d.direction === "them").reduce((s, d) => s + d.amount, 0);
  const displayDebts = useMemo(() => sortDebts(debts, sort, td), [debts, sort]);
  const activeSortLabel = DEBT_SORT_OPTIONS.find(o => o.value === sort)?.label ?? "";

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: t.text }]}>Dashboard</Text>
      <Text style={[styles.subtitle, { color: t.textSub }]}>Your personal debt dashboard</Text>

      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text style={[styles.cardLabel, { color: t.textSub }]}>You Owe</Text>
        <Text style={[styles.cardValue, { color: t.text }]}>${youOwe.toFixed(2)}</Text>
      </View>
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text style={[styles.cardLabel, { color: t.textSub }]}>Owed to You</Text>
        <Text style={[styles.cardValue, { color: t.text }]}>${owedToYou.toFixed(2)}</Text>
      </View>
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text style={[styles.cardLabel, { color: t.textSub }]}>Total Paid</Text>
        <Text style={[styles.cardValue, { color: t.text }]}>$0.00</Text>
      </View>
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text style={[styles.cardLabel, { color: t.textSub }]}>Total Received</Text>
        <Text style={[styles.cardValue, { color: t.text }]}>$0.00</Text>
      </View>

      <Pressable style={[styles.addBtn, { backgroundColor: t.primary }]} onPress={() => router.push("/add-debt" as any)}>
        <Text style={styles.addBtnText}>+ Add New Debt</Text>
      </Pressable>

      {debts.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: t.text }]}>Recent Activity</Text>
            <Pressable
              style={[styles.sortBtn, { backgroundColor: sort !== "date" ? t.primarySoft : t.card, borderColor: sort !== "date" ? t.primaryBorder : t.border }]}
              onPress={() => setShowSortMenu(true)}
            >
              <Text style={[styles.sortBtnIcon, { color: sort !== "date" ? t.primary : t.text }]}>⇅</Text>
            </Pressable>
          </View>
          {sort !== "date" && <Text style={[styles.sortHint, { color: t.textSub }]}>Sorted by: {activeSortLabel}</Text>}

          {displayDebts.length === 0 ? (
            <View style={styles.emptyFiltered}>
              <Text style={[styles.emptyFilteredText, { color: t.textMuted }]}>No debts match this filter.</Text>
            </View>
          ) : displayDebts.map(debt => {
            const dl = dlInfo(debt.deadline, td);
            return (
              <View key={debt.id} style={[styles.debtRow, { backgroundColor: t.card, borderColor: t.border }]}>
                <View style={styles.debtLeft}>
                  <Text style={[styles.debtPerson, { color: t.text }]}>{debt.person}</Text>
                  {debt.reason ? <Text style={[styles.debtReason, { color: t.textSub }]}>{debt.reason}</Text> : null}
                  {dl ? <Text style={[styles.dlLabel, { color: dl.overdue ? t.red : t.primary }]}>{dl.label}{dl.overdue ? " · Overdue" : ""}</Text> : null}
                </View>
                <View style={styles.debtRight}>
                  <Text style={[styles.debtAmount, { color: debt.direction === "me" ? t.red : t.green }]}>
                    {debt.direction === "me" ? "-" : "+"}${debt.amount.toFixed(2)}
                  </Text>
                  <Text style={[styles.debtDir, { color: t.textSub }]}>{debt.direction === "me" ? "You owe" : "Owes you"}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Modal visible={showSortMenu} transparent animationType="fade" onRequestClose={() => setShowSortMenu(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowSortMenu(false)}>
          <Pressable style={[styles.menu, { backgroundColor: t.card }]} onPress={e => e.stopPropagation()}>
            <Text style={[styles.menuTitle, { color: t.textMuted }]}>Sort By</Text>
            {DEBT_SORT_OPTIONS.map(opt => (
              <Pressable
                key={opt.value}
                style={[styles.menuRow, sort === opt.value && { backgroundColor: t.primarySoft }]}
                onPress={() => { setSort(opt.value); setShowSortMenu(false); }}
              >
                <Text style={[styles.menuRowText, { color: sort === opt.value ? t.primary : t.text }]}>{opt.label}</Text>
                {sort === opt.value && <Text style={[styles.menuCheck, { color: t.primary }]}>✓</Text>}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 32, fontWeight: "700", marginTop: 60 },
  subtitle: { fontSize: 16, marginTop: 8, marginBottom: 24 },
  card: { borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1 },
  cardLabel: { fontSize: 16 },
  cardValue: { fontSize: 28, fontWeight: "700", marginTop: 8 },
  addBtn: { padding: 18, borderRadius: 16, alignItems: "center", marginTop: 8 },
  addBtnText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  section: { marginTop: 32 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  sectionTitle: { fontSize: 20, fontWeight: "700" },
  sortBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sortBtnIcon: { fontSize: 16 },
  sortHint: { fontSize: 12, marginBottom: 10 },
  emptyFiltered: { padding: 20, alignItems: "center" },
  emptyFilteredText: { fontSize: 14, fontStyle: "italic" },
  debtRow: { borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  debtLeft: { flex: 1, marginRight: 12 },
  debtPerson: { fontSize: 16, fontWeight: "600" },
  debtReason: { fontSize: 13, marginTop: 2 },
  dlLabel: { fontSize: 11, marginTop: 3, fontWeight: "500" },
  debtRight: { alignItems: "flex-end" },
  debtAmount: { fontSize: 18, fontWeight: "700" },
  debtDir: { fontSize: 12, marginTop: 2 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", alignItems: "center" },
  menu: { borderRadius: 20, paddingVertical: 8, width: 280, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 8 },
  menuTitle: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  menuRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 8, borderRadius: 10 },
  menuRowText: { flex: 1, fontSize: 15 },
  menuCheck: { fontSize: 15, fontWeight: "700" },
});
