import { useState, useMemo, useRef } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useDebts } from "@/context/DebtContext";
import { useContacts } from "@/context/ContactsContext";
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
    case "paid":     return { backgroundColor: "#16A34A" };
    case "accepted": return { backgroundColor: "#2563EB" };
    case "partial":  return { backgroundColor: "#0891B2" };
    case "rejected": return { backgroundColor: "#DC2626" };
    case "disputed": return { backgroundColor: "#7C3AED" };
    default:         return { backgroundColor: "#F59E0B" };
  }
}

function createPaymentRequestId(debtId: string) {
  return `payment:${debtId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export default function IndividualDashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { debts, currentUserId, updateDebtStatus, addPayment } = useDebts();
  const { individuals } = useContacts();
  const { colors: t } = useTheme();
  const [sort, setSort] = useState<DebtSortOption>("date");
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Payment modal state
  const [payingDebt, setPayingDebt] = useState<{ id: string; remaining: number; clientRequestId: string } | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const paymentSubmittingRef = useRef<Map<string, string>>(new Map());
  const [paymentSavingIds, setPaymentSavingIds] = useState<Set<string>>(() => new Set());

  function startPaymentSubmit(debtId: string, clientRequestId: string) {
    if (paymentSubmittingRef.current.has(debtId)) return null;
    paymentSubmittingRef.current.set(debtId, clientRequestId);
    setPaymentSavingIds(prev => new Set(prev).add(debtId));
    return clientRequestId;
  }

  function finishPaymentSubmit(debtId: string) {
    paymentSubmittingRef.current.delete(debtId);
    setPaymentSavingIds(prev => {
      const next = new Set(prev);
      next.delete(debtId);
      return next;
    });
  }

  async function handleAccept(debtId: string) {
    try { await updateDebtStatus(debtId, "accepted"); }
    catch (e: any) { Alert.alert("Error", e?.message ?? "Could not accept debt."); }
  }
  async function handleDecline(debtId: string) {
    try { await updateDebtStatus(debtId, "rejected"); }
    catch (e: any) { Alert.alert("Error", e?.message ?? "Could not decline debt."); }
  }

  function openPayModal(debtId: string, remaining: number) {
    if (paymentSubmittingRef.current.has(debtId)) return;
    setPayAmount("");
    setPayingDebt({ id: debtId, remaining, clientRequestId: createPaymentRequestId(debtId) });
  }

  async function handleMarkPaid(debtId: string, remaining: number) {
    const clientRequestId = startPaymentSubmit(debtId, createPaymentRequestId(debtId));
    if (!clientRequestId) return;
    try {
      await addPayment(debtId, Math.round(remaining * 100), clientRequestId);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not mark as paid.");
    } finally {
      finishPaymentSubmit(debtId);
    }
  }

  async function handleConfirmPayment() {
    if (!payingDebt || payLoading) return;
    const cents = Math.round(parseFloat(payAmount) * 100);
    if (!cents || cents <= 0) {
      Alert.alert("Invalid amount", "Please enter a positive amount.");
      return;
    }
    if (cents > Math.round(payingDebt.remaining * 100)) {
      Alert.alert("Too much", `Maximum payment is $${payingDebt.remaining.toFixed(2)}.`);
      return;
    }
    const clientRequestId = startPaymentSubmit(payingDebt.id, payingDebt.clientRequestId);
    if (!clientRequestId) return;
    setPayLoading(true);
    const debtId = payingDebt.id;
    try {
      await addPayment(debtId, cents, clientRequestId);
      setPayingDebt(null);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not record payment.");
    } finally {
      finishPaymentSubmit(debtId);
      setPayLoading(false);
    }
  }

  const td = today();
  const resolvedId = Array.isArray(id) ? id[0] : id;
  const person = individuals.find(ind => ind.id === resolvedId);

  if (!person) {
    return (
      <View style={[styles.notFound, { backgroundColor: t.bg }]}>
        <Text style={{ color: t.textMuted, fontSize: 16 }}>Person not found.</Text>
      </View>
    );
  }

  const personDebts = debts.filter(d => d.person === person.name);
  // Accepted + partial debts use remainingAmount for per-person totals.
  const iOwe = personDebts
    .filter(d => d.direction === "me" && (d.status === "accepted" || d.status === "partial"))
    .reduce((s, d) => s + d.remainingAmount, 0);
  const owedToMe = personDebts
    .filter(d => d.direction === "them" && (d.status === "accepted" || d.status === "partial"))
    .reduce((s, d) => s + d.remainingAmount, 0);
  const displayDebts = useMemo(() => sortDebts(personDebts, sort, td), [debts, sort, person.name]);
  const activeSortLabel = DEBT_SORT_OPTIONS.find(o => o.value === sort)?.label ?? "";

  return (
    <>
      <Stack.Screen
        options={{
          title: person.name,
          headerRight: () => (
            <Pressable onPress={() => router.push(`/edit-individual?id=${resolvedId}` as any)} style={{ paddingHorizontal: 4 }}>
              <Text style={{ color: t.primary, fontSize: 16, fontWeight: "600" }}>Edit</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Avatar name={person.name} imageUri={person.imageUri} size={72} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.personName, { color: t.text }]}>{person.name}</Text>
            {person.nickname ? <Text style={[styles.nickname, { color: t.textSub }]}>"{person.nickname}"</Text> : null}
            {person.phoneOrUsername ? <Text style={[styles.contact, { color: t.textMuted }]}>{person.phoneOrUsername}</Text> : null}
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

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: t.text }]}>Transactions</Text>
          {personDebts.length > 0 && (
            <Pressable
              style={[styles.sortBtn, { backgroundColor: sort !== "date" ? t.primarySoft : t.card, borderColor: sort !== "date" ? t.primaryBorder : t.border }]}
              onPress={() => setShowSortMenu(true)}
            >
              <Text style={[styles.sortBtnIcon, { color: sort !== "date" ? t.primary : t.text }]}>⇅</Text>
            </Pressable>
          )}
        </View>
        {sort !== "date" && personDebts.length > 0 && <Text style={[styles.sortHint, { color: t.textSub }]}>Sorted by: {activeSortLabel}</Text>}

        {personDebts.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.emptyText, { color: t.textMuted }]}>No transactions with {person.name} yet.{"\n"}Add debts from the main Dashboard.</Text>
          </View>
        ) : displayDebts.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.emptyText, { color: t.textMuted }]}>No transactions match this filter.</Text>
          </View>
        ) : displayDebts.map(debt => {
          const dl = dlInfo(debt.deadline, td);
          const showActions = debt.status === "pending" && !!currentUserId && debt.creatorId !== currentUserId;
          return (
            <View key={debt.id} style={[styles.txRow, { backgroundColor: t.card, borderColor: showActions ? t.primaryBorder : t.border }]}>
              <View style={styles.txRowContent}>
                <View style={styles.txLeft}>
                  {debt.reason ? <Text style={[styles.txReason, { color: t.text }]}>{debt.reason}</Text>
                    : <Text style={[styles.txReasonEmpty, { color: t.textMuted }]}>No reason</Text>}
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
                    {debt.direction === "me" ? "-" : "+"}${debt.remainingAmount.toFixed(2)}
                  </Text>
                  {debt.status === "partial" && (
                    <Text style={[styles.txOrig, { color: t.textMuted }]}>of ${debt.amount.toFixed(2)}</Text>
                  )}
                  <Text style={[styles.txDir, { color: t.textSub }]}>{debt.direction === "me" ? "You owe" : "Owes you"}</Text>
                </View>
              </View>
              {showActions && (
                <View style={styles.txActionRow}>
                  <Pressable
                    style={[styles.txActionBtn, { backgroundColor: t.greenSoft, borderColor: t.greenBorder }]}
                    onPress={() => handleAccept(debt.id)}
                  >
                    <Text style={[styles.txActionText, { color: t.green }]}>✓ Accept</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.txActionBtn, { backgroundColor: t.redSoft, borderColor: t.redBorder }]}
                    onPress={() => handleDecline(debt.id)}
                  >
                    <Text style={[styles.txActionText, { color: t.red }]}>✗ Decline</Text>
                  </Pressable>
                </View>
              )}
              {(debt.status === "accepted" || debt.status === "partial") && (
                <View style={styles.txActionRow}>
                  <Pressable
                    style={[styles.txActionBtn, { backgroundColor: t.primarySoft, borderColor: t.primaryBorder, opacity: paymentSavingIds.has(debt.id) ? 0.6 : 1 }]}
                    onPress={() => openPayModal(debt.id, debt.remainingAmount)}
                    disabled={paymentSavingIds.has(debt.id)}
                  >
                    <Text style={[styles.txActionText, { color: t.primary }]}>💳 Add Payment</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.txActionBtn, { backgroundColor: t.greenSoft, borderColor: t.greenBorder, opacity: paymentSavingIds.has(debt.id) ? 0.6 : 1 }]}
                    onPress={() => handleMarkPaid(debt.id, debt.remainingAmount)}
                    disabled={paymentSavingIds.has(debt.id)}
                  >
                    <Text style={[styles.txActionText, { color: t.green }]}>✓ Mark Paid</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
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

      {/* ── Add Payment modal ── */}
      <Modal visible={payingDebt !== null} transparent animationType="fade" onRequestClose={() => { if (!payLoading) setPayingDebt(null); }}>
        <Pressable style={styles.overlay} onPress={() => { if (!payLoading) setPayingDebt(null); }}>
          <Pressable style={[styles.payModal, { backgroundColor: t.elevatedCard, borderColor: t.border }]} onPress={e => e.stopPropagation()}>
            <Text style={[styles.payTitle, { color: t.text }]}>Add Payment</Text>
            {payingDebt && (
              <Text style={[styles.payHint, { color: t.textSub }]}>
                Remaining: ${payingDebt.remaining.toFixed(2)}
              </Text>
            )}
            <TextInput
              style={[styles.payInput, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
              placeholder="Amount (e.g. 50.00)"
              placeholderTextColor={t.textMuted}
              keyboardType="decimal-pad"
              value={payAmount}
              onChangeText={setPayAmount}
              autoFocus
              editable={!payLoading}
            />
            <View style={styles.payActions}>
              <Pressable
                style={[styles.payBtn, { backgroundColor: t.card, borderColor: t.border }]}
                onPress={() => setPayingDebt(null)}
                disabled={payLoading}
              >
                <Text style={[styles.payBtnText, { color: t.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.payBtn, { backgroundColor: t.primarySoft, borderColor: t.primaryBorder, opacity: payLoading ? 0.6 : 1 }]}
                onPress={handleConfirmPayment}
                disabled={payLoading}
              >
                <Text style={[styles.payBtnText, { color: t.primary }]}>{payLoading ? "Saving…" : "Confirm"}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  notFound: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: 24, paddingBottom: 48 },
  header: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 24, marginTop: 8 },
  personName: { fontSize: 24, fontWeight: "700" },
  nickname: { fontSize: 14, marginTop: 2 },
  contact: { fontSize: 13, marginTop: 2 },
  cardRow: { flexDirection: "row", gap: 12, marginBottom: 28 },
  summaryCard: { flex: 1, borderRadius: 16, padding: 18, borderWidth: 1 },
  summaryLabel: { fontSize: 13 },
  summaryValue: { fontSize: 24, fontWeight: "700", marginTop: 6 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  sortBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sortBtnIcon: { fontSize: 14 },
  sortHint: { fontSize: 12, marginBottom: 10 },
  emptyBox: { borderRadius: 14, padding: 20, alignItems: "center", borderWidth: 1 },
  emptyText: { fontSize: 14, textAlign: "center", fontStyle: "italic", lineHeight: 22 },
  txRow: { borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1 },
  txRowContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  txLeft: { flex: 1, marginRight: 12 },
  txReason: { fontSize: 15, fontWeight: "600" },
  txReasonEmpty: { fontSize: 15, fontStyle: "italic" },
  txMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  txDate: { fontSize: 12 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: "600", color: "#FFFFFF" },
  dlLabel: { fontSize: 11, marginTop: 4, fontWeight: "500" },
  txRight: { alignItems: "flex-end" },
  txAmount: { fontSize: 17, fontWeight: "700" },
  txOrig: { fontSize: 11, marginTop: 1 },
  txDir: { fontSize: 12, marginTop: 2 },
  txActionRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  txActionBtn: { flex: 1, borderRadius: 10, borderWidth: 1, paddingVertical: 8, alignItems: "center" },
  txActionText: { fontSize: 13, fontWeight: "700" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  payModal: { width: 320, borderRadius: 20, borderWidth: 1, padding: 24, gap: 14 },
  payTitle: { fontSize: 18, fontWeight: "700" },
  payHint: { fontSize: 13 },
  payInput: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  payActions: { flexDirection: "row", gap: 10 },
  payBtn: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 12, alignItems: "center" },
  payBtnText: { fontSize: 15, fontWeight: "700" },
  menu: { borderRadius: 20, paddingVertical: 8, width: 280, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 8 },
  menuTitle: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  menuRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 8, borderRadius: 10 },
  menuRowText: { flex: 1, fontSize: 15 },
  menuCheck: { fontSize: 15, fontWeight: "700" },
});
