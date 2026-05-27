import { useState, useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
    case "paid": return { backgroundColor: "#16A34A" };
    case "partially_paid": return { backgroundColor: "#0284C7" };
    case "accepted": return { backgroundColor: "#2563EB" };
    case "rejected": return { backgroundColor: "#DC2626" };
    case "disputed": return { backgroundColor: "#7C3AED" };
    default: return { backgroundColor: "#F59E0B" };
  }
}

function statusLabel(status: string) {
  if (status === "partially_paid") return "Partial";
  return status;
}

export default function IndividualDashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { debts, markDebtsPaid, applyPartialPayment } = useDebts();
  const { individuals } = useContacts();
  const { colors: t } = useTheme();
  const [sort, setSort] = useState<DebtSortOption>("date");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showPayAllModal, setShowPayAllModal] = useState(false);
  const [showPayPartialModal, setShowPayPartialModal] = useState(false);
  const [payPartialMode, setPayPartialMode] = useState<"dollar" | "percent">("dollar");
  const [payPartialInput, setPayPartialInput] = useState("");
  const [payPartialPercent, setPayPartialPercent] = useState<number | null>(null);

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
  const allActiveDebts = personDebts.filter(
    d => d.status !== "paid" && d.status !== "rejected"
  );
  const iOwe = allActiveDebts.filter(d => d.direction === "me").reduce((s, d) => s + d.amount, 0);
  const owedToMe = allActiveDebts.filter(d => d.direction === "them").reduce((s, d) => s + d.amount, 0);
  const netDebt = parseFloat((iOwe - owedToMe).toFixed(2));

  const displayDebts = useMemo(() => sortDebts(personDebts, sort, td), [debts, sort, person.name]);
  const activeSortLabel = DEBT_SORT_OPTIONS.find(o => o.value === sort)?.label ?? "";

  function resetAndClosePartial() {
    setShowPayPartialModal(false);
    setPayPartialMode("dollar");
    setPayPartialInput("");
    setPayPartialPercent(null);
  }

  const payAmount = (() => {
    if (netDebt <= 0) return null;
    if (payPartialMode === "dollar") {
      const v = parseFloat(payPartialInput);
      return !isNaN(v) && v > 0 && v <= netDebt ? v : null;
    }
    if (payPartialPercent === null) return null;
    const v = parseFloat((netDebt * payPartialPercent / 100).toFixed(2));
    return v > 0 && v <= netDebt ? v : null;
  })();

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

        {/* NET DEBT card — always visible */}
        <View style={[styles.payCard, { backgroundColor: t.card, borderColor: t.border }]}>
          <View style={styles.payCardTop}>
            <Text style={[styles.payLabel, { color: t.textMuted }]}>NET DEBT</Text>
            {netDebt > 0 ? (
              <>
                <Text style={[styles.payDesc, { color: t.textSub }]}>You owe {person.name}</Text>
                <Text style={[styles.payAmount, { color: t.red }]}>${netDebt.toFixed(2)}</Text>
              </>
            ) : netDebt < 0 ? (
              <>
                <Text style={[styles.payDesc, { color: t.textSub }]}>{person.name} owes you</Text>
                <Text style={[styles.payAmount, { color: t.green }]}>${Math.abs(netDebt).toFixed(2)}</Text>
              </>
            ) : (
              <>
                <Text style={[styles.payDesc, { color: t.textSub }]}>You and {person.name} are settled up.</Text>
                <Text style={[styles.payAmount, { color: t.textMuted }]}>$0.00</Text>
              </>
            )}
          </View>

          {netDebt > 0 ? (
            <View style={styles.payBtns}>
              <Pressable style={styles.payBtnPrimary} onPress={() => setShowPayAllModal(true)}>
                <LinearGradient
                  colors={[t.from, t.to] as [string, string]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.payBtnGrad}
                >
                  <Text style={styles.payBtnPrimText}>✓ Pay All</Text>
                </LinearGradient>
              </Pressable>
              <Pressable
                style={[styles.payBtnSecondary, { borderColor: t.border }]}
                onPress={() => setShowPayPartialModal(true)}
              >
                <Text style={[styles.payBtnSecText, { color: t.text }]}>↳ Pay Partial</Text>
              </Pressable>
            </View>
          ) : netDebt < 0 ? (
            <Text style={[styles.awaitingText, { color: t.textMuted }]}>Awaiting Payment</Text>
          ) : null}
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
          return (
            <View key={debt.id} style={[styles.txRow, { backgroundColor: t.card, borderColor: t.border }]}>
              <View style={styles.txLeft}>
                {debt.reason ? <Text style={[styles.txReason, { color: t.text }]}>{debt.reason}</Text>
                  : <Text style={[styles.txReasonEmpty, { color: t.textMuted }]}>No reason</Text>}
                <View style={styles.txMeta}>
                  <Text style={[styles.txDate, { color: t.textMuted }]}>{new Date(debt.createdAt).toLocaleDateString()}</Text>
                  <View style={[styles.statusBadge, statusStyle(debt.status)]}>
                    <Text style={styles.statusText}>{statusLabel(debt.status)}</Text>
                  </View>
                </View>
                {dl ? <Text style={[styles.dlLabel, { color: dl.overdue ? t.red : t.primary }]}>{dl.label}{dl.overdue ? " · Overdue" : ""}</Text> : null}
              </View>
              <View style={styles.txRight}>
                <Text style={[styles.txAmount, { color: debt.direction === "me" ? t.red : t.green }]}>
                  {debt.direction === "me" ? "-" : "+"}${debt.amount.toFixed(2)}
                </Text>
                <Text style={[styles.txDir, { color: t.textSub }]}>{debt.direction === "me" ? "You owe" : "Owes you"}</Text>
                {debt.status === "partially_paid" && (
                  <Text style={[styles.txPartialNote, { color: t.textMuted }]}>remaining</Text>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Pay All confirmation modal */}
      <Modal visible={showPayAllModal} transparent animationType="fade" onRequestClose={() => setShowPayAllModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowPayAllModal(false)}>
          <Pressable style={[styles.confirmModal, { backgroundColor: t.card }]} onPress={e => e.stopPropagation()}>
            <Text style={[styles.confirmTitle, { color: t.text }]}>Pay Net Balance?</Text>
            <Text style={[styles.confirmMsg, { color: t.textSub }]}>
              Are you sure you want to pay the net balance of ${netDebt.toFixed(2)} to {person.name}? This will settle the active debts between you and this person.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                style={[styles.confirmCancelBtn, { borderColor: t.border }]}
                onPress={() => setShowPayAllModal(false)}
              >
                <Text style={[styles.confirmCancelText, { color: t.textSub }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.confirmPayBtn}
                onPress={() => {
                  setShowPayAllModal(false);
                  markDebtsPaid(allActiveDebts.map(d => d.id));
                }}
              >
                <LinearGradient
                  colors={[t.from, t.to] as [string, string]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.confirmPayGrad}
                >
                  <Text style={styles.confirmPayText}>Confirm Pay All</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Pay Partial modal */}
      <Modal visible={showPayPartialModal} transparent animationType="fade" onRequestClose={resetAndClosePartial}>
        <Pressable style={styles.overlay} onPress={resetAndClosePartial}>
          <Pressable style={[styles.partialModal, { backgroundColor: t.card }]} onPress={e => e.stopPropagation()}>
            <Text style={[styles.ppTitle, { color: t.textMuted }]}>PAY PARTIAL</Text>
            <Text style={[styles.ppDesc, { color: t.textSub }]}>
              {"You owe "}
              <Text style={{ color: t.text, fontWeight: "700" }}>{person.name}</Text>
              {" a net total of "}
              <Text style={{ color: t.red, fontWeight: "700" }}>${netDebt.toFixed(2)}</Text>
              {". How much do you want to pay now?"}
            </Text>

            {/* Mode toggle */}
            <View style={[styles.ppSeg, { backgroundColor: t.bg, borderColor: t.border }]}>
              {(["dollar", "percent"] as const).map(m => {
                const active = payPartialMode === m;
                const label = m === "dollar" ? "Dollar amount" : "Percentage";
                const inner = (
                  <View style={styles.ppSegInner}>
                    <Text style={[styles.ppSegText, { color: active ? "#fff" : t.textSub }]}>{label}</Text>
                  </View>
                );
                return (
                  <Pressable
                    key={m}
                    style={styles.ppSegBtn}
                    onPress={() => {
                      setPayPartialMode(m);
                      setPayPartialInput("");
                      setPayPartialPercent(null);
                    }}
                  >
                    {active ? (
                      <LinearGradient
                        colors={[t.from, t.to] as [string, string]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={styles.ppSegActive}
                      >
                        {inner}
                      </LinearGradient>
                    ) : inner}
                  </Pressable>
                );
              })}
            </View>

            {/* Dollar input */}
            {payPartialMode === "dollar" ? (
              <View style={[styles.ppInputWrap, { borderColor: t.border, backgroundColor: t.input }]}>
                <Text style={[styles.ppDollar, { color: t.textSub }]}>$</Text>
                <TextInput
                  style={[styles.ppInput, { color: t.text }]}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={t.textMuted}
                  value={payPartialInput}
                  onChangeText={setPayPartialInput}
                />
              </View>
            ) : (
              /* Percentage quick-select */
              <View style={styles.ppPercentWrap}>
                <View style={styles.pctRow}>
                  {[25, 50, 75, 100].map(pct => {
                    const sel = payPartialPercent === pct;
                    return (
                      <Pressable
                        key={pct}
                        style={[styles.pctBtn, !sel && { borderWidth: 1, borderColor: t.border, backgroundColor: t.bg }]}
                        onPress={() => setPayPartialPercent(pct)}
                      >
                        {sel ? (
                          <LinearGradient
                            colors={[t.from, t.to] as [string, string]}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                            style={styles.pctBtnGrad}
                          >
                            <Text style={styles.pctBtnActiveText}>{pct}%</Text>
                          </LinearGradient>
                        ) : (
                          <Text style={[styles.pctBtnText, { color: t.text }]}>{pct}%</Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
                {payPartialPercent !== null && (
                  <Text style={[styles.ppCalc, { color: t.textSub }]}>
                    = ${(netDebt * payPartialPercent / 100).toFixed(2)}
                  </Text>
                )}
              </View>
            )}

            {/* Actions */}
            <View style={styles.ppActions}>
              <Pressable
                style={[styles.ppCancelBtn, { borderColor: t.border }]}
                onPress={resetAndClosePartial}
              >
                <Text style={[styles.ppCancelText, { color: t.textSub }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.ppPayWrap, payAmount === null && { opacity: 0.4 }]}
                disabled={payAmount === null}
                onPress={() => {
                  if (payAmount === null) return;
                  applyPartialPayment(person.name, payAmount);
                  resetAndClosePartial();
                }}
              >
                <LinearGradient
                  colors={[t.from, t.to] as [string, string]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.ppPayGrad}
                >
                  <Text style={styles.ppPayText}>✓ Pay</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Sort modal */}
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
  header: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 24, marginTop: 8 },
  personName: { fontSize: 24, fontWeight: "700" },
  nickname: { fontSize: 14, marginTop: 2 },
  contact: { fontSize: 13, marginTop: 2 },
  cardRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  summaryCard: { flex: 1, borderRadius: 16, padding: 18, borderWidth: 1 },
  summaryLabel: { fontSize: 13 },
  summaryValue: { fontSize: 24, fontWeight: "700", marginTop: 6 },

  // NET DEBT card
  payCard: { borderRadius: 16, padding: 18, borderWidth: 1, marginBottom: 20, marginTop: 12 },
  payCardTop: { marginBottom: 14 },
  payLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 },
  payDesc: { fontSize: 14, fontWeight: "500", marginBottom: 4 },
  payAmount: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  awaitingText: { fontSize: 13, fontWeight: "500" },
  payBtns: { flexDirection: "row", gap: 10 },
  payBtnPrimary: { flex: 1, borderRadius: 10, overflow: "hidden" },
  payBtnGrad: { height: 42, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  payBtnPrimText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  payBtnSecondary: { flex: 1, height: 42, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  payBtnSecText: { fontSize: 14, fontWeight: "600" },

  // Transactions section
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  sortBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sortBtnIcon: { fontSize: 14 },
  sortHint: { fontSize: 12, marginBottom: 10 },
  emptyBox: { borderRadius: 14, padding: 20, alignItems: "center", borderWidth: 1 },
  emptyText: { fontSize: 14, textAlign: "center", fontStyle: "italic", lineHeight: 22 },
  txRow: { borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
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
  txDir: { fontSize: 12, marginTop: 2 },
  txPartialNote: { fontSize: 11, marginTop: 1 },

  // Shared modal overlay
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center" },

  // Pay All confirmation modal
  confirmModal: { width: "88%", maxWidth: 340, borderRadius: 20, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 8 },
  confirmTitle: { fontSize: 20, fontWeight: "700", marginBottom: 10 },
  confirmMsg: { fontSize: 14, lineHeight: 21, marginBottom: 24 },
  confirmActions: { flexDirection: "row", gap: 10 },
  confirmCancelBtn: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  confirmCancelText: { fontSize: 14, fontWeight: "600" },
  confirmPayBtn: { flex: 1, borderRadius: 10, overflow: "hidden" },
  confirmPayGrad: { height: 44, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  confirmPayText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // Pay Partial modal
  partialModal: { width: "92%", maxWidth: 380, borderRadius: 20, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 8 },
  ppTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 8 },
  ppDesc: { fontSize: 14, lineHeight: 21, marginBottom: 20 },
  ppSeg: { flexDirection: "row", gap: 4, padding: 3, borderRadius: 12, borderWidth: 1, marginBottom: 20 },
  ppSegBtn: { flex: 1 },
  ppSegActive: { borderRadius: 9 },
  ppSegInner: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, alignItems: "center" },
  ppSegText: { fontSize: 13, fontWeight: "600" },
  ppInputWrap: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 24, gap: 6 },
  ppDollar: { fontSize: 22, fontWeight: "600" },
  ppInput: { flex: 1, fontSize: 28, fontWeight: "700" },
  ppPercentWrap: { marginBottom: 24 },
  pctRow: { flexDirection: "row", gap: 10 },
  pctBtn: { flex: 1, borderRadius: 10, overflow: "hidden", height: 44, alignItems: "center", justifyContent: "center" },
  pctBtnGrad: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  pctBtnActiveText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  pctBtnText: { fontSize: 14, fontWeight: "600" },
  ppCalc: { fontSize: 13, textAlign: "center", marginTop: 12, fontWeight: "500" },
  ppActions: { flexDirection: "row", gap: 10 },
  ppCancelBtn: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  ppCancelText: { fontSize: 14, fontWeight: "600" },
  ppPayWrap: { flex: 1, borderRadius: 10, overflow: "hidden" },
  ppPayGrad: { height: 44, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  ppPayText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // Sort modal
  menu: { borderRadius: 20, paddingVertical: 8, width: 280, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 8 },
  menuTitle: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  menuRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 8, borderRadius: 10 },
  menuRowText: { flex: 1, fontSize: 15 },
  menuCheck: { fontSize: 15, fontWeight: "700" },
});
