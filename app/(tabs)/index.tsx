import { useState, useMemo } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useDebts } from "@/context/DebtContext";
import { useTheme } from "@/context/ThemeContext";
import { useRouter } from "expo-router";
import type { Debt } from "@/context/DebtContext";
import { GradientButton } from "@/components/GradientButton";

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
  const { colors: t, isDark } = useTheme();
  const [sort, setSort] = useState<DebtSortOption>("date");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [visibleDebtCount, setVisibleDebtCount] = useState(10);

  const td = today();
  const youOwe = debts.filter(d => d.direction === "me").reduce((s, d) => s + d.amount, 0);
  const owedToYou = debts.filter(d => d.direction === "them").reduce((s, d) => s + d.amount, 0);
  const displayDebts = useMemo(() => sortDebts(debts, sort, td), [debts, sort]);
  const activeSortLabel = DEBT_SORT_OPTIONS.find(o => o.value === sort)?.label ?? "";

  const statCards = [
    {
      label: "You Owe",
      value: `$${youOwe.toFixed(2)}`,
      valueColor: t.red,
      gradient: isDark
        ? ["rgba(255,90,95,0.32)", "rgba(10,13,32,0.96)"] as [string, string]
        : ["#FEF2F2", "#FECACA"] as [string, string],
      borderColor: isDark ? "#4A1518" : "#FECACA",
      cardShadow: isDark ? { shadowColor: "#FF5A5F", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 5 } : {},
      icon: "↑",
      iconBg: isDark ? "#3D1215" : "#FECACA",
      iconColor: t.red,
    },
    {
      label: "Owed to You",
      value: `$${owedToYou.toFixed(2)}`,
      valueColor: t.green,
      gradient: isDark
        ? ["rgba(6,214,160,0.30)", "rgba(10,13,32,0.96)"] as [string, string]
        : ["#E6FAF6", "#CCFAF0"] as [string, string],
      borderColor: isDark ? "#055A45" : "#99E6D8",
      cardShadow: isDark ? { shadowColor: "#06D6A0", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 14, elevation: 5 } : {},
      icon: "↓",
      iconBg: isDark ? "#032A20" : "#99E6D8",
      iconColor: t.green,
    },
    {
      label: "Total Paid",
      value: "$0.00",
      valueColor: isDark ? "#A78BFA" : "#7C3AED",
      gradient: isDark
        ? ["rgba(124,58,237,0.38)", "rgba(10,13,32,0.96)"] as [string, string]
        : ["#F3EFFF", "#DDD6FE"] as [string, string],
      borderColor: isDark ? "#3D2A7A" : "#DDD6FE",
      cardShadow: isDark ? { shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 5 } : {},
      icon: "✓",
      iconBg: isDark ? "#1C1040" : "#DDD6FE",
      iconColor: isDark ? "#A78BFA" : "#7C3AED",
    },
    {
      label: "Total Received",
      value: "$0.00",
      valueColor: isDark ? "#FF4ECD" : "#EC4899",
      gradient: isDark
        ? ["rgba(255,78,205,0.28)", "rgba(6,214,160,0.20)"] as [string, string]
        : ["#FFF0FA", "#E6FAF6"] as [string, string],
      borderColor: isDark ? "#6B2463" : "#F9A8D4",
      cardShadow: isDark ? { shadowColor: "#FF4ECD", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.24, shadowRadius: 14, elevation: 5 } : {},
      icon: "★",
      iconBg: isDark ? "#3D1A36" : "#F9A8D4",
      iconColor: isDark ? "#FF4ECD" : "#EC4899",
    },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: t.text }]}>Dashboard</Text>
      <Text style={[styles.subtitle, { color: t.textSub }]}>Your personal debt dashboard</Text>

      <View style={styles.statsGrid}>
        {statCards.map(card => (
          <LinearGradient
            key={card.label}
            colors={card.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.statCard, { borderColor: card.borderColor }, card.cardShadow]}
          >
            <View style={styles.statTop}>
              <Text style={[styles.statLabel, { color: t.textSub }]}>{card.label}</Text>
              <View style={[styles.statIconBubble, { backgroundColor: card.iconBg }]}>
                <Text style={[styles.statIcon, { color: card.iconColor }]}>{card.icon}</Text>
              </View>
            </View>
            <Text style={[styles.statValue, { color: card.valueColor }]}>{card.value}</Text>
          </LinearGradient>
        ))}
      </View>

      <GradientButton
        label="+ Add New Debt"
        onPress={() => router.push("/add-debt" as any)}
        style={{ marginTop: 4, marginBottom: 4 }}
      />

      {debts.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: t.text }]}>Recent Activity</Text>
            <Pressable
              style={[styles.sortBtn, {
                backgroundColor: sort !== "date" ? t.primarySoft : t.card,
                borderColor: sort !== "date" ? t.primaryBorder : t.border,
              }]}
              onPress={() => setShowSortMenu(true)}
            >
              <Text style={[styles.sortBtnIcon, { color: sort !== "date" ? t.primary : t.textSub }]}>⇅</Text>
            </Pressable>
          </View>
          {sort !== "date" && <Text style={[styles.sortHint, { color: t.textSub }]}>Sorted by: {activeSortLabel}</Text>}

          {displayDebts.length === 0 ? (
            <View style={styles.emptyFiltered}>
              <Text style={[styles.emptyFilteredText, { color: t.textMuted }]}>No debts match this filter.</Text>
            </View>
          ) : (
            <>
              {displayDebts.slice(0, visibleDebtCount).map(debt => {
                const dl = dlInfo(debt.deadline, td);
                const isOwedToMe = debt.direction === "them";
                return (
                  <View key={debt.id} style={[styles.debtRow, {
                    backgroundColor: t.card,
                    borderColor: t.border,
                    ...(isDark ? { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3 } : { shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 }),
                  }]}>
                    <View style={styles.debtLeft}>
                      <Text style={[styles.debtPerson, { color: t.text }]}>{debt.person}</Text>
                      {debt.reason ? <Text style={[styles.debtReason, { color: t.textSub }]}>{debt.reason}</Text> : null}
                      {dl ? <Text style={[styles.dlLabel, { color: dl.overdue ? t.red : t.primary }]}>{dl.label}{dl.overdue ? " · Overdue" : ""}</Text> : null}
                    </View>
                    <View style={styles.debtRight}>
                      <Text style={[styles.debtAmount, { color: isOwedToMe ? t.green : t.red }]}>
                        {isOwedToMe ? "+" : "-"}${debt.amount.toFixed(2)}
                      </Text>
                      <Text style={[styles.debtDir, { color: t.textMuted }]}>{isOwedToMe ? "Owes you" : "You owe"}</Text>
                    </View>
                  </View>
                );
              })}
              {visibleDebtCount < displayDebts.length && (
                <Pressable
                  style={[styles.loadMoreBtn, { backgroundColor: t.card, borderColor: t.border }]}
                  onPress={() => setVisibleDebtCount(c => Math.min(c + 10, displayDebts.length))}
                >
                  <Text style={[styles.loadMoreText, { color: t.primary }]}>
                    Load More ({displayDebts.length - visibleDebtCount} remaining)
                  </Text>
                </Pressable>
              )}
              {visibleDebtCount > 10 && (
                <View style={styles.collapseRow}>
                  <Pressable
                    style={[styles.collapseBtn, { backgroundColor: t.card, borderColor: t.border }]}
                    onPress={() => setVisibleDebtCount(c => Math.max(c - 10, 10))}
                  >
                    <Text style={[styles.collapseBtnText, { color: t.textSub }]}>Show Less</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.collapseBtn, { backgroundColor: t.card, borderColor: t.border }]}
                    onPress={() => setVisibleDebtCount(10)}
                  >
                    <Text style={[styles.collapseBtnText, { color: t.textSub }]}>Back to 10</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>
      )}

      <Modal visible={showSortMenu} transparent animationType="fade" onRequestClose={() => setShowSortMenu(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowSortMenu(false)}>
          <Pressable style={[styles.menu, { backgroundColor: t.elevatedCard, borderColor: t.border, borderWidth: 1 }]} onPress={e => e.stopPropagation()}>
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
  title: { fontSize: 32, fontWeight: "800", marginTop: 60, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, marginTop: 6, marginBottom: 24 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  statCard: { width: "47.5%", borderRadius: 20, padding: 16, borderWidth: 1, gap: 10 },
  statTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  statLabel: { fontSize: 12, fontWeight: "600", flex: 1, marginRight: 4 },
  statIconBubble: { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  statIcon: { fontSize: 13, fontWeight: "800" },
  statValue: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  section: { marginTop: 32 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 20, fontWeight: "700" },
  sortBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sortBtnIcon: { fontSize: 16 },
  sortHint: { fontSize: 12, marginBottom: 10 },
  emptyFiltered: { padding: 20, alignItems: "center" },
  emptyFilteredText: { fontSize: 14, fontStyle: "italic" },
  debtRow: { borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  debtLeft: { flex: 1, marginRight: 12 },
  debtPerson: { fontSize: 16, fontWeight: "700" },
  debtReason: { fontSize: 13, marginTop: 2 },
  dlLabel: { fontSize: 11, marginTop: 3, fontWeight: "600" },
  debtRight: { alignItems: "flex-end" },
  debtAmount: { fontSize: 18, fontWeight: "800" },
  debtDir: { fontSize: 12, marginTop: 2 },
  loadMoreBtn: { borderRadius: 14, borderWidth: 1, padding: 14, alignItems: "center", marginBottom: 10 },
  loadMoreText: { fontSize: 15, fontWeight: "600" },
  collapseRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  collapseBtn: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, alignItems: "center" },
  collapseBtnText: { fontSize: 14, fontWeight: "600" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  menu: { borderRadius: 22, paddingVertical: 8, width: 280, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 10 },
  menuTitle: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  menuRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 8, borderRadius: 12 },
  menuRowText: { flex: 1, fontSize: 15 },
  menuCheck: { fontSize: 15, fontWeight: "700" },
});
