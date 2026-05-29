import { useState, useMemo } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useDebts } from "@/context/DebtContext";
import { useTheme } from "@/context/ThemeContext";
import { useRouter } from "expo-router";
import type { Debt } from "@/context/DebtContext";
import { GradientButton } from "@/components/GradientButton";

type DebtSortOption =
  | "date" | "deadline-soonest" | "deadline-latest"
  | "overdue" | "no-deadline" | "nearest" | "farthest";

type FilterTab = "all" | "i-owe" | "owed-to-me" | "pending";

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "all",        label: "All Debts"  },
  { value: "i-owe",      label: "I Owe"      },
  { value: "owed-to-me", label: "Owed to Me" },
  { value: "pending",    label: "Pending"    },
];

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
  const { debts, currentUserId, updateDebtStatus, updateDebtDetails, cancelDebt } = useDebts();
  const { colors: t, isDark } = useTheme();

  async function handleAccept(id: string) {
    try { await updateDebtStatus(id, "accepted"); }
    catch (e: any) { Alert.alert("Error", e?.message ?? "Could not accept debt."); }
  }
  async function handleDecline(id: string) {
    try { await updateDebtStatus(id, "rejected"); }
    catch (e: any) { Alert.alert("Error", e?.message ?? "Could not decline debt."); }
  }
  const [sort, setSort] = useState<DebtSortOption>("date");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [visibleDebtCount, setVisibleDebtCount] = useState(10);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  function openEditDebt(debt: Debt) {
    setEditingDebt(debt);
    setEditAmount(debt.amount.toFixed(2));
    setEditReason(debt.reason);
    setEditDeadline(debt.deadline ?? "");
  }

  async function handleSaveDebtEdit() {
    if (!editingDebt || editSaving) return;
    const amount = parseFloat(editAmount);
    if (!amount || amount <= 0) {
      Alert.alert("Invalid amount", "Please enter a positive amount.");
      return;
    }
    if (editDeadline && !/^\d{4}-\d{2}-\d{2}$/.test(editDeadline)) {
      Alert.alert("Invalid date", "Use YYYY-MM-DD or leave the date blank.");
      return;
    }
    setEditSaving(true);
    try {
      await updateDebtDetails(editingDebt.id, {
        amount,
        reason: editReason.trim(),
        deadline: editDeadline.trim() || null,
      });
      setEditingDebt(null);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not update debt.");
    } finally {
      setEditSaving(false);
    }
  }

  function handleCancelDebt(id: string) {
    Alert.alert("Cancel debt?", "This will remove the pending request from active debt totals.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Cancel Debt",
        style: "destructive",
        onPress: async () => {
          try { await cancelDebt(id); }
          catch (e: any) { Alert.alert("Error", e?.message ?? "Could not cancel debt."); }
        },
      },
    ]);
  }

  const td = today();
  // Accepted + partial debts count toward totals; use remainingAmount so paid-down
  // balances are reflected and fully-paid debts are excluded.
  const youOwe = debts
    .filter(d => d.direction === "me" && (d.status === "accepted" || d.status === "partial"))
    .reduce((s, d) => s + d.remainingAmount, 0);
  const owedToYou = debts
    .filter(d => d.direction === "them" && (d.status === "accepted" || d.status === "partial"))
    .reduce((s, d) => s + d.remainingAmount, 0);
  const totalPaid = debts.reduce((s, d) => s + d.totalPaidAmount, 0);
  const totalReceived = debts.reduce((s, d) => s + d.totalReceivedAmount, 0);
  const displayDebts = useMemo(() => sortDebts(debts, sort, td), [debts, sort, td]);
  const filteredDebts = useMemo(() => {
    switch (filterTab) {
      case "i-owe":      return displayDebts.filter(d => d.direction === "me");
      case "owed-to-me": return displayDebts.filter(d => d.direction === "them");
      case "pending":    return displayDebts.filter(d => d.status === "pending");
      default:           return displayDebts;
    }
  }, [displayDebts, filterTab]);
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
      value: `$${totalPaid.toFixed(2)}`,
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
      value: `$${totalReceived.toFixed(2)}`,
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

          {/* Filter tabs */}
          <View style={styles.filterRow}>
            {FILTER_TABS.map(tab => {
              const active = filterTab === tab.value;
              return (
                <Pressable
                  key={tab.value}
                  style={[
                    styles.filterTab,
                    active
                      ? { backgroundColor: t.primary, borderColor: t.primary }
                      : { backgroundColor: t.card, borderColor: t.border },
                  ]}
                  onPress={() => { setFilterTab(tab.value); setVisibleDebtCount(10); }}
                >
                  <Text style={[styles.filterTabText, { color: active ? "#fff" : t.textSub }]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {filteredDebts.length === 0 ? (
            <View style={styles.emptyFiltered}>
              <Text style={[styles.emptyFilteredText, { color: t.textMuted }]}>No debts match this filter.</Text>
            </View>
          ) : (
            <>
              {filteredDebts.slice(0, visibleDebtCount).map(debt => {
                const dl = dlInfo(debt.deadline, td);
                const isOwedToMe = debt.direction === "them";
                const showActions = debt.status === "pending" && !!currentUserId && debt.creatorId !== currentUserId;
                const showCreatorActions = debt.status === "pending" && !!currentUserId && debt.creatorId === currentUserId;
                return (
                  <View key={debt.id} style={[styles.debtRow, {
                    backgroundColor: t.card,
                    borderColor: showActions || showCreatorActions ? t.primaryBorder : t.border,
                    ...(isDark ? { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3 } : { shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 }),
                  }]}>
                    <View style={styles.debtRowContent}>
                      <View style={styles.debtLeft}>
                        <Text style={[styles.debtPerson, { color: t.text }]}>{debt.person}</Text>
                        {debt.reason ? <Text style={[styles.debtReason, { color: t.textSub }]}>{debt.reason}</Text> : null}
                        {debt.status === "pending" && (
                          <Text style={[styles.pendingBadge, { color: t.textMuted }]}>⏳ Pending verification</Text>
                        )}
                        {dl ? <Text style={[styles.dlLabel, { color: dl.overdue ? t.red : t.primary }]}>{dl.label}{dl.overdue ? " · Overdue" : ""}</Text> : null}
                      </View>
                      <View style={styles.debtRight}>
                        <Text style={[styles.debtAmount, { color: isOwedToMe ? t.green : t.red }]}>
                          {isOwedToMe ? "+" : "-"}${debt.remainingAmount.toFixed(2)}
                        </Text>
                        {debt.status === "partial" && (
                          <Text style={[styles.debtOrig, { color: t.textMuted }]}>of ${debt.amount.toFixed(2)}</Text>
                        )}
                        <Text style={[styles.debtDir, { color: t.textMuted }]}>{isOwedToMe ? "Owes you" : "You owe"}</Text>
                      </View>
                    </View>
                    {showActions && (
                      <View style={styles.debtActionRow}>
                        <Pressable
                          style={[styles.debtActionBtn, { backgroundColor: t.greenSoft, borderColor: t.greenBorder }]}
                          onPress={() => handleAccept(debt.id)}
                        >
                          <Text style={[styles.debtActionText, { color: t.green }]}>✓ Accept</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.debtActionBtn, { backgroundColor: t.redSoft, borderColor: t.redBorder }]}
                          onPress={() => handleDecline(debt.id)}
                        >
                          <Text style={[styles.debtActionText, { color: t.red }]}>✗ Decline</Text>
                        </Pressable>
                      </View>
                    )}
                    {showCreatorActions && (
                      <View style={styles.debtActionRow}>
                        <Pressable
                          style={[styles.debtActionBtn, { backgroundColor: t.primarySoft, borderColor: t.primaryBorder }]}
                          onPress={() => openEditDebt(debt)}
                        >
                          <Text style={[styles.debtActionText, { color: t.primary }]}>Edit</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.debtActionBtn, { backgroundColor: t.redSoft, borderColor: t.redBorder }]}
                          onPress={() => handleCancelDebt(debt.id)}
                        >
                          <Text style={[styles.debtActionText, { color: t.red }]}>Cancel</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
              {visibleDebtCount < filteredDebts.length && (
                <Pressable
                  style={[styles.loadMoreBtn, { backgroundColor: t.card, borderColor: t.border }]}
                  onPress={() => setVisibleDebtCount(c => Math.min(c + 10, filteredDebts.length))}
                >
                  <Text style={[styles.loadMoreText, { color: t.primary }]}>
                    Load More ({filteredDebts.length - visibleDebtCount} remaining)
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

      <Modal visible={editingDebt !== null} transparent animationType="fade" onRequestClose={() => { if (!editSaving) setEditingDebt(null); }}>
        <Pressable style={styles.overlay} onPress={() => { if (!editSaving) setEditingDebt(null); }}>
          <Pressable style={[styles.editModal, { backgroundColor: t.elevatedCard, borderColor: t.border }]} onPress={e => e.stopPropagation()}>
            <Text style={[styles.editTitle, { color: t.text }]}>Edit Pending Debt</Text>
            <TextInput
              style={[styles.editInput, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
              placeholder="Amount"
              placeholderTextColor={t.textMuted}
              keyboardType="decimal-pad"
              value={editAmount}
              onChangeText={setEditAmount}
              editable={!editSaving}
            />
            <TextInput
              style={[styles.editInput, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
              placeholder="Reason"
              placeholderTextColor={t.textMuted}
              value={editReason}
              onChangeText={setEditReason}
              editable={!editSaving}
            />
            <TextInput
              style={[styles.editInput, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
              placeholder="Due date (YYYY-MM-DD)"
              placeholderTextColor={t.textMuted}
              value={editDeadline}
              onChangeText={setEditDeadline}
              editable={!editSaving}
            />
            <View style={styles.editActions}>
              <Pressable
                style={[styles.editBtn, { backgroundColor: t.card, borderColor: t.border }]}
                onPress={() => setEditingDebt(null)}
                disabled={editSaving}
              >
                <Text style={[styles.editBtnText, { color: t.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.editBtn, { backgroundColor: t.primarySoft, borderColor: t.primaryBorder, opacity: editSaving ? 0.6 : 1 }]}
                onPress={handleSaveDebtEdit}
                disabled={editSaving}
              >
                <Text style={[styles.editBtnText, { color: t.primary }]}>{editSaving ? "Saving..." : "Save"}</Text>
              </Pressable>
            </View>
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
  debtRow: { borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1 },
  debtRowContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  debtLeft: { flex: 1, marginRight: 12 },
  debtPerson: { fontSize: 16, fontWeight: "700" },
  debtReason: { fontSize: 13, marginTop: 2 },
  pendingBadge: { fontSize: 11, marginTop: 3, fontWeight: "500" },
  dlLabel: { fontSize: 11, marginTop: 3, fontWeight: "600" },
  debtRight: { alignItems: "flex-end" },
  debtAmount: { fontSize: 18, fontWeight: "800" },
  debtOrig: { fontSize: 11, marginTop: 1 },
  debtDir: { fontSize: 12, marginTop: 2 },
  debtActionRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  debtActionBtn: { flex: 1, borderRadius: 10, borderWidth: 1, paddingVertical: 8, alignItems: "center" },
  debtActionText: { fontSize: 13, fontWeight: "700" },
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
  editModal: { width: 320, borderRadius: 20, borderWidth: 1, padding: 24, gap: 12 },
  editTitle: { fontSize: 18, fontWeight: "700" },
  editInput: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  editActions: { flexDirection: "row", gap: 10 },
  editBtn: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 12, alignItems: "center" },
  editBtnText: { fontSize: 15, fontWeight: "700" },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" },
  filterTab: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
  filterTabText: { fontSize: 13, fontWeight: "600" },
});
