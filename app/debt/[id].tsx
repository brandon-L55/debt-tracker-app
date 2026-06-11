import { useState, useRef } from "react";
import {
  Alert, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { useDebts } from "@/context/DebtContext";
import { useContacts } from "@/context/ContactsContext";
import { useGroups } from "@/context/GroupsContext";
import { useTheme } from "@/context/ThemeContext";
import { Avatar } from "@/components/Avatar";
import { DoneBar } from "@/components/DoneBar";

function today(): string { return new Date().toISOString().split("T")[0]; }

function dlInfo(dl: string | null | undefined, td: string) {
  if (!dl) return null;
  const [y, m, d] = dl.split("-").map(Number);
  const label = `Due ${new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  return { label, overdue: dl < td };
}

function statusColors(status: string) {
  switch (status) {
    case "paid":     return { bg: "#16A34A" };
    case "partial":  return { bg: "#0891B2" };
    case "accepted": return { bg: "#2563EB" };
    case "rejected": return { bg: "#DC2626" };
    case "disputed": return { bg: "#7C3AED" };
    default:         return { bg: "#F59E0B" };
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "partial":  return "Partial";
    case "accepted": return "Accepted";
    case "rejected": return "Rejected";
    case "disputed": return "Disputed";
    case "paid":     return "Paid";
    default:         return "Pending";
  }
}

function createRequestId(debtId: string) {
  return `payment:${debtId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export default function DebtDetailScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const router = useRouter();
  const { debts, currentUserId, addPayment, markDebtManuallyPaid, undoManualPaid, updateDebtStatus, updateDebtDetails, cancelDebt } = useDebts();
  const { individuals } = useContacts();
  const { groups } = useGroups();
  const { colors: t } = useTheme();

  // Pay modal state
  const [payingDebt, setPayingDebt] = useState<{ id: string; remaining: number; clientRequestId: string; deadline: string | null } | null>(null);
  const [payInputAmount, setPayInputAmount] = useState("");
  const [payPctSelected, setPayPctSelected] = useState<number | null>(null);
  const [payPctCustom, setPayPctCustom] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const paymentSubmittingRef = useRef<Map<string, string>>(new Map());
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [markPaidSaving, setMarkPaidSaving] = useState(false);
  const [undoPaidSaving, setUndoPaidSaving] = useState(false);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editAmount, setEditAmount] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const td = today();
  const resolvedId = Array.isArray(id) ? id[0] : id;
  const found = debts.find(d => d.id === resolvedId);

  if (!found) {
    return (
      <View style={[styles.notFound, { backgroundColor: t.bg }]}>
        <Text style={{ color: t.textMuted, fontSize: 16 }}>Debt not found.</Text>
      </View>
    );
  }

  // Reassign as a non-nullable const so TypeScript can use this type in closures below.
  const debt = found;

  const contact = debt.contactId ? individuals.find(i => i.id === debt.contactId) : null;
  const group = debt.groupId ? groups.find(g => g.id === debt.groupId) : null;
  const isLinked = !!debt.linkedUserId;
  const iOwe = debt.direction === "me";
  const dl = dlInfo(debt.deadline, td);

  const canMakePayment = iOwe && (debt.status === "accepted" || debt.status === "partial");
  const canMarkManually = canMakePayment && !isLinked;
  const canUndoPaid = iOwe && !!debt.manuallyPaid && debt.status === "paid";
  const showIncomingActions = debt.status === "pending" && !!currentUserId && debt.creatorId !== currentUserId;
  const showCreatorActions = debt.status === "pending" && !!currentUserId && debt.creatorId === currentUserId;
  const hasActions = canMakePayment || canMarkManually || canUndoPaid || showIncomingActions || showCreatorActions;

  const isFullyPaid = debt.status === "paid";
  const isPartial = debt.status === "partial";
  const paidSoFar = debt.amount - debt.remainingAmount;
  const progressPercent = debt.amount > 0 ? Math.min(100, Math.max(0, (paidSoFar / debt.amount) * 100)) : 0;

  const personName = contact?.nickname || contact?.name || debt.person;
  const personSubName = contact?.nickname ? contact.name : null;
  const personContact = contact?.phoneOrUsername || null;

  function startPaymentSubmit(debtId: string, clientRequestId: string) {
    if (paymentSubmittingRef.current.has(debtId)) return null;
    paymentSubmittingRef.current.set(debtId, clientRequestId);
    setPaymentSaving(true);
    return clientRequestId;
  }

  function finishPaymentSubmit(debtId: string) {
    paymentSubmittingRef.current.delete(debtId);
    setPaymentSaving(false);
  }

  function openPayModal() {
    if (paymentSubmittingRef.current.has(debt.id)) return;
    setPayInputAmount("");
    setPayPctSelected(null);
    setPayPctCustom("");
    setPayingDebt({ id: debt.id, remaining: debt.remainingAmount, clientRequestId: createRequestId(debt.id), deadline: debt.deadline ?? null });
  }

  async function handlePayFull() {
    if (!payingDebt || payLoading) return;
    const crid = startPaymentSubmit(payingDebt.id, payingDebt.clientRequestId);
    if (!crid) return;
    setPayLoading(true);
    const { id: dId, remaining } = payingDebt;
    try {
      await addPayment(dId, Math.round(remaining * 100), crid);
      setPayingDebt(null);
    } catch (e: any) { Alert.alert("Error", e?.message ?? "Could not record payment."); }
    finally { finishPaymentSubmit(dId); setPayLoading(false); }
  }

  async function handleConfirmPayment() {
    if (!payingDebt || payLoading) return;
    const cents = Math.round(parseFloat(payInputAmount) * 100);
    if (!cents || cents <= 0) { Alert.alert("Invalid amount", "Please enter a positive amount."); return; }
    if (cents > Math.round(payingDebt.remaining * 100)) {
      Alert.alert("Too much", `Maximum payment is $${payingDebt.remaining.toFixed(2)}.`); return;
    }
    const crid = startPaymentSubmit(payingDebt.id, payingDebt.clientRequestId);
    if (!crid) return;
    setPayLoading(true);
    const dId = payingDebt.id;
    try {
      await addPayment(dId, cents, crid);
      setPayingDebt(null);
    } catch (e: any) { Alert.alert("Error", e?.message ?? "Could not record payment."); }
    finally { finishPaymentSubmit(dId); setPayLoading(false); }
  }

  async function handleMarkPaid() {
    setMarkPaidSaving(true);
    try { await markDebtManuallyPaid(debt.id); }
    catch (e: any) { Alert.alert("Error", e?.message ?? "Could not mark as paid."); }
    finally { setMarkPaidSaving(false); }
  }

  async function handleUndoPaid() {
    setUndoPaidSaving(true);
    try { await undoManualPaid(debt.id); }
    catch (e: any) { Alert.alert("Error", e?.message ?? "Could not undo paid status."); }
    finally { setUndoPaidSaving(false); }
  }

  async function handleAccept() {
    try { await updateDebtStatus(debt.id, "accepted"); }
    catch (e: any) { Alert.alert("Error", e?.message ?? "Could not accept."); }
  }

  async function handleDecline() {
    try { await updateDebtStatus(debt.id, "rejected"); }
    catch (e: any) { Alert.alert("Error", e?.message ?? "Could not decline."); }
  }

  function openEdit() {
    setEditAmount(debt.amount.toFixed(2));
    setEditReason(debt.reason);
    setEditDeadline(debt.deadline ?? "");
    setShowEditModal(true);
  }

  async function handleSaveEdit() {
    if (editSaving) return;
    const amount = parseFloat(editAmount);
    if (!amount || amount <= 0) { Alert.alert("Invalid amount", "Please enter a positive amount."); return; }
    if (editDeadline && !/^\d{4}-\d{2}-\d{2}$/.test(editDeadline)) {
      Alert.alert("Invalid date", "Use YYYY-MM-DD or leave blank."); return;
    }
    setEditSaving(true);
    try {
      await updateDebtDetails(debt.id, { amount, reason: editReason.trim(), deadline: editDeadline.trim() || null });
      setShowEditModal(false);
    } catch (e: any) { Alert.alert("Error", e?.message ?? "Could not update."); }
    finally { setEditSaving(false); }
  }

  function handleCancelDebt() {
    Alert.alert("Cancel debt?", "This will remove the pending request from active debt totals.", [
      { text: "Keep", style: "cancel" },
      { text: "Cancel Debt", style: "destructive", onPress: async () => {
        try { await cancelDebt(debt.id); router.back(); }
        catch (e: any) { Alert.alert("Error", e?.message ?? "Could not cancel debt."); }
      }},
    ]);
  }

  const sc = statusColors(debt.status);

  const backTitleMap: Record<string, string> = {
    dashboard: "Dashboard",
    contacts: "Back",
    groups: "Back",
    debt: "Back",
  };
  const backTitle = backTitleMap[from ?? ""] ?? "Back";

  return (
    <>
      <Stack.Screen options={{ title: `Debt with ${personName}`, headerBackTitle: backTitle }} />
      <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={styles.content}>

        {/* ── Person Card ── */}
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <View style={styles.personRow}>
            <Avatar name={contact?.name || debt.person} imageUri={contact?.imageUri} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.personName, { color: t.text }]}>{personName}</Text>
              {personSubName ? <Text style={[styles.personSub, { color: t.textSub }]}>{personSubName}</Text> : null}
              {personContact ? <Text style={[styles.personContact, { color: t.textMuted }]}>{personContact}</Text> : null}
              <View style={[styles.contactTypePill, { backgroundColor: isLinked ? t.primarySoft : t.card, borderColor: isLinked ? t.primaryBorder : t.border }]}>
                <Text style={[styles.contactTypeText, { color: isLinked ? t.primary : t.textMuted }]}>
                  {isLinked ? "App user" : "Manual contact"}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.oweRow, { backgroundColor: iOwe ? t.redSoft : t.greenSoft, borderColor: iOwe ? t.redBorder : t.greenBorder }]}>
            <Text style={[styles.oweLabel, { color: iOwe ? t.red : t.green }]}>
              {iOwe ? `You owe ${personName}` : `${personName} owes you`}
            </Text>
            <Text style={[styles.oweAmount, { color: iOwe ? t.red : t.green }]}>
              ${debt.remainingAmount.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* ── Amount Card ── */}
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[styles.cardLabel, { color: t.textMuted }]}>AMOUNT</Text>
          <View style={styles.amountHeader}>
            <View>
              <Text style={[styles.amountOrigLabel, { color: t.textSub }]}>Original</Text>
              <Text style={[styles.amountOrig, { color: t.text }]}>${debt.amount.toFixed(2)}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
              <Text style={styles.statusBadgeText}>{statusLabel(debt.status)}</Text>
            </View>
          </View>

          {isPartial && (
            <>
              <View style={[styles.progressTrack, { backgroundColor: t.border }]}>
                <View style={[styles.progressFill, { width: `${progressPercent}%` as any, backgroundColor: t.green }]} />
              </View>
              <View style={styles.amountBreakdown}>
                <View style={styles.breakdownItem}>
                  <Text style={[styles.breakdownLabel, { color: t.textSub }]}>{iOwe ? "Paid" : "Received"}</Text>
                  <Text style={[styles.breakdownVal, { color: t.green }]}>${paidSoFar.toFixed(2)}</Text>
                </View>
                <View style={styles.breakdownItem}>
                  <Text style={[styles.breakdownLabel, { color: t.textSub }]}>Remaining</Text>
                  <Text style={[styles.breakdownVal, { color: iOwe ? t.red : t.text }]}>${debt.remainingAmount.toFixed(2)}</Text>
                </View>
              </View>
            </>
          )}

          {isFullyPaid && (
            <View style={[styles.paidBanner, { backgroundColor: t.greenSoft, borderColor: t.greenBorder }]}>
              <Text style={[styles.paidBannerText, { color: t.green }]}>
                {debt.manuallyPaid ? "✓ Marked paid manually" : "✓ Paid in full"}
              </Text>
              {debt.manuallyPaid && (
                <Text style={[styles.paidBannerSub, { color: t.textMuted }]}>
                  Confirmed offline — no payment record
                </Text>
              )}
            </View>
          )}
        </View>

        {/* ── Details Card ── */}
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[styles.cardLabel, { color: t.textMuted }]}>DETAILS</Text>

          <View style={styles.detailRow}>
            <Text style={[styles.detailKey, { color: t.textSub }]}>Reason</Text>
            <Text style={[styles.detailVal, { color: debt.reason ? t.text : t.textMuted }]}>{debt.reason || "N/A"}</Text>
          </View>

          <View style={[styles.detailRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }]}>
            <Text style={[styles.detailKey, { color: t.textSub }]}>Due date</Text>
            {dl ? (
              <Text style={[styles.detailVal, { color: dl.overdue ? t.red : t.text }]}>
                {dl.label}{dl.overdue ? " · Overdue" : ""}
              </Text>
            ) : (
              <Text style={[styles.detailVal, { color: t.textMuted }]}>N/A</Text>
            )}
          </View>

          {debt.status === "paid" && debt.paidAt && (
            <View style={[styles.detailRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }]}>
              <Text style={[styles.detailKey, { color: t.textSub }]}>Paid</Text>
              <Text style={[styles.detailVal, { color: t.green }]}>
                {new Date(debt.paidAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </Text>
            </View>
          )}

          <View style={[styles.detailRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }]}>
            <Text style={[styles.detailKey, { color: t.textSub }]}>Created</Text>
            <Text style={[styles.detailVal, { color: t.text }]}>
              {new Date(debt.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </Text>
          </View>

          {group && (
            <View style={[styles.detailRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }]}>
              <Text style={[styles.detailKey, { color: t.textSub }]}>Group</Text>
              <Pressable onPress={() => router.push(`/group/${debt.groupId}?from=debt` as any)}>
                <Text style={[styles.detailVal, { color: t.primary }]}>{group.name} →</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* ── Actions Card ── */}
        {hasActions && (
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
            <Text style={[styles.cardLabel, { color: t.textMuted }]}>ACTIONS</Text>

            {canMakePayment && (
              <Pressable
                style={[styles.actionPrimary, { opacity: paymentSaving ? 0.6 : 1 }]}
                onPress={openPayModal}
                disabled={paymentSaving}
              >
                <LinearGradient colors={[t.from, t.to] as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionGrad}>
                  <Text style={styles.actionPrimaryText}>✓ Pay Debt</Text>
                </LinearGradient>
              </Pressable>
            )}

            {canMarkManually && (
              <Pressable
                style={[styles.actionSecondary, { backgroundColor: t.greenSoft, borderColor: t.greenBorder, opacity: markPaidSaving ? 0.6 : 1 }]}
                onPress={handleMarkPaid}
                disabled={markPaidSaving}
              >
                <Text style={[styles.actionSecondaryText, { color: t.green }]}>
                  {markPaidSaving ? "Saving…" : "✓ Mark Paid"}
                </Text>
              </Pressable>
            )}

            {canUndoPaid && (
              <Pressable
                style={[styles.actionSecondary, { backgroundColor: t.card, borderColor: t.border, opacity: undoPaidSaving ? 0.6 : 1 }]}
                onPress={handleUndoPaid}
                disabled={undoPaidSaving}
              >
                <Text style={[styles.actionSecondaryText, { color: t.textSub }]}>
                  {undoPaidSaving ? "Undoing…" : "↩ Undo Paid"}
                </Text>
              </Pressable>
            )}

            {showIncomingActions && (
              <View style={styles.actionRow}>
                <Pressable style={[styles.actionHalf, { backgroundColor: t.greenSoft, borderColor: t.greenBorder }]} onPress={handleAccept}>
                  <Text style={[styles.actionHalfText, { color: t.green }]}>✓ Accept</Text>
                </Pressable>
                <Pressable style={[styles.actionHalf, { backgroundColor: t.redSoft, borderColor: t.redBorder }]} onPress={handleDecline}>
                  <Text style={[styles.actionHalfText, { color: t.red }]}>✗ Decline</Text>
                </Pressable>
              </View>
            )}

            {showCreatorActions && (
              <View style={styles.actionRow}>
                <Pressable style={[styles.actionHalf, { backgroundColor: t.primarySoft, borderColor: t.primaryBorder }]} onPress={openEdit}>
                  <Text style={[styles.actionHalfText, { color: t.primary }]}>Edit</Text>
                </Pressable>
                <Pressable style={[styles.actionHalf, { backgroundColor: t.redSoft, borderColor: t.redBorder }]} onPress={handleCancelDebt}>
                  <Text style={[styles.actionHalfText, { color: t.red }]}>Cancel Debt</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* Link to person's full history */}
        {contact && (
          <Pressable
            style={[styles.viewPersonBtn, { backgroundColor: t.card, borderColor: t.border }]}
            onPress={() => router.push(`/individual/${contact.id}?from=debt` as any)}
          >
            <Text style={[styles.viewPersonText, { color: t.primary }]}>
              View all debts with {personName} →
            </Text>
          </Pressable>
        )}

      </ScrollView>

      {/* Edit Pending Debt Modal */}
      <Modal visible={showEditModal} transparent animationType="fade" onRequestClose={() => { if (!editSaving) setShowEditModal(false); }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <Pressable style={styles.overlay} onPress={() => { if (!editSaving) setShowEditModal(false); }}>
            <Pressable style={[styles.editModal, { backgroundColor: t.elevatedCard, borderColor: t.border }]} onPress={e => e.stopPropagation()}>
              <Text style={[styles.editTitle, { color: t.text }]}>Edit Pending Debt</Text>
              <TextInput style={[styles.editInput, { backgroundColor: t.input, borderColor: t.border, color: t.text }]} placeholder="Amount" placeholderTextColor={t.textMuted} keyboardType="decimal-pad" inputAccessoryViewID="debt-detail-edit" value={editAmount} onChangeText={setEditAmount} editable={!editSaving} />
              <TextInput style={[styles.editInput, { backgroundColor: t.input, borderColor: t.border, color: t.text }]} placeholder="Reason" placeholderTextColor={t.textMuted} inputAccessoryViewID="debt-detail-edit" value={editReason} onChangeText={setEditReason} editable={!editSaving} />
              <TextInput style={[styles.editInput, { backgroundColor: t.input, borderColor: t.border, color: t.text }]} placeholder="Due date (YYYY-MM-DD)" placeholderTextColor={t.textMuted} inputAccessoryViewID="debt-detail-edit" value={editDeadline} onChangeText={setEditDeadline} editable={!editSaving} />
              <View style={styles.editActions}>
                <Pressable style={[styles.editBtn, { backgroundColor: t.card, borderColor: t.border }]} onPress={() => setShowEditModal(false)} disabled={editSaving}>
                  <Text style={[styles.editBtnText, { color: t.text }]}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.editBtn, { backgroundColor: t.primarySoft, borderColor: t.primaryBorder, opacity: editSaving ? 0.6 : 1 }]} onPress={handleSaveEdit} disabled={editSaving}>
                  <Text style={[styles.editBtnText, { color: t.primary }]}>{editSaving ? "Saving..." : "Save"}</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
        <DoneBar nativeID="debt-detail-edit" />
      </Modal>

      {/* Pay Debt Modal */}
      <Modal visible={payingDebt !== null} transparent animationType="slide" onRequestClose={() => { if (!payLoading) setPayingDebt(null); }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <Pressable style={styles.overlay} onPress={() => { if (!payLoading) setPayingDebt(null); }}>
            <Pressable style={[styles.payModal, { backgroundColor: t.elevatedCard, borderColor: t.border }]} onPress={e => e.stopPropagation()}>
              <Text style={[styles.payTitle, { color: t.text }]}>Pay Debt</Text>

              {payingDebt && (() => {
                const dl2 = dlInfo(payingDebt.deadline, td);
                return (
                  <>
                    <Text style={[styles.payRemaining, { color: t.textSub }]}>
                      Remaining: <Text style={{ color: t.text, fontWeight: "700" }}>${payingDebt.remaining.toFixed(2)}</Text>
                    </Text>
                    {dl2 && (
                      <Text style={[styles.payDue, { color: dl2.overdue ? t.red : t.textSub }]}>
                        {dl2.label}{dl2.overdue ? " · Overdue" : ""}
                      </Text>
                    )}
                  </>
                );
              })()}

              <Pressable style={[styles.payFullBtn, { opacity: payLoading ? 0.6 : 1 }]} disabled={payLoading} onPress={handlePayFull}>
                <LinearGradient colors={[t.from, t.to] as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.payFullGrad}>
                  <Text style={styles.payFullText}>✓ Pay in Full — ${payingDebt?.remaining.toFixed(2) ?? "0.00"}</Text>
                </LinearGradient>
              </Pressable>

              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: t.border }]} />
                <Text style={[styles.dividerText, { color: t.textMuted }]}>or pay partial</Text>
                <View style={[styles.dividerLine, { backgroundColor: t.border }]} />
              </View>

              <View style={styles.pctRow}>
                {[25, 50, 75, 100].map(pct => {
                  const sel = payPctSelected === pct;
                  return (
                    <Pressable
                      key={pct}
                      style={[styles.pctBtn, !sel && { borderWidth: 1, borderColor: t.border, backgroundColor: t.bg }]}
                      onPress={() => {
                        const amt = payingDebt ? parseFloat((payingDebt.remaining * pct / 100).toFixed(2)) : 0;
                        setPayPctSelected(pct);
                        setPayPctCustom("");
                        setPayInputAmount(amt > 0 ? amt.toFixed(2) : "");
                      }}
                      disabled={payLoading}
                    >
                      {sel ? (
                        <LinearGradient colors={[t.from, t.to] as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pctBtnGrad}>
                          <Text style={styles.pctBtnActiveText}>{pct}%</Text>
                        </LinearGradient>
                      ) : (
                        <Text style={[styles.pctBtnText, { color: t.text }]}>{pct}%</Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              <View style={[styles.pctInputWrap, { borderColor: t.border, backgroundColor: t.input }]}>
                <TextInput
                  style={[styles.pctInput, { color: t.text }]}
                  placeholder="Custom %"
                  placeholderTextColor={t.textMuted}
                  keyboardType="decimal-pad"
                  inputAccessoryViewID="debt-detail-pay"
                  value={payPctCustom}
                  onChangeText={text => {
                    setPayPctCustom(text);
                    setPayPctSelected(null);
                    const pct = parseFloat(text);
                    if (payingDebt && !isNaN(pct) && pct > 0 && pct <= 100) {
                      const amt = parseFloat((payingDebt.remaining * pct / 100).toFixed(2));
                      setPayInputAmount(amt > 0 ? amt.toFixed(2) : "");
                    } else {
                      setPayInputAmount("");
                    }
                  }}
                  editable={!payLoading}
                />
                <Text style={[styles.pctSuffix, { color: t.textSub }]}>%</Text>
                {payPctCustom !== "" && payInputAmount !== "" && (
                  <Text style={[styles.pctCalc, { color: t.textMuted }]}>= ${payInputAmount}</Text>
                )}
              </View>

              <TextInput
                style={[styles.payInput, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
                placeholder="Or enter amount (e.g. 5.00)"
                placeholderTextColor={t.textMuted}
                keyboardType="decimal-pad"
                inputAccessoryViewID="debt-detail-pay"
                value={payInputAmount}
                onChangeText={text => {
                  setPayInputAmount(text);
                  setPayPctSelected(null);
                  setPayPctCustom("");
                }}
                editable={!payLoading}
              />

              <View style={styles.payActions}>
                <Pressable style={[styles.payBtn, { backgroundColor: t.card, borderColor: t.border }]} onPress={() => setPayingDebt(null)} disabled={payLoading}>
                  <Text style={[styles.payBtnText, { color: t.text }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.payBtn, { backgroundColor: t.primarySoft, borderColor: t.primaryBorder, opacity: (payLoading || !payInputAmount) ? 0.5 : 1 }]}
                  onPress={handleConfirmPayment}
                  disabled={payLoading || !payInputAmount}
                >
                  <Text style={[styles.payBtnText, { color: t.primary }]}>{payLoading ? "Saving…" : "Pay Partial"}</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
        <DoneBar nativeID="debt-detail-pay" />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  notFound: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: 16, paddingBottom: 48, gap: 12 },

  card: { borderRadius: 16, padding: 18, borderWidth: 1 },
  cardLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 14 },

  // Person card
  personRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14 },
  personName: { fontSize: 20, fontWeight: "700" },
  personSub: { fontSize: 14, marginTop: 2 },
  personContact: { fontSize: 13, marginTop: 2 },
  contactTypePill: { marginTop: 6, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start" },
  contactTypeText: { fontSize: 11, fontWeight: "600" },
  oweRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 12, padding: 14, borderWidth: 1 },
  oweLabel: { fontSize: 15, fontWeight: "600" },
  oweAmount: { fontSize: 22, fontWeight: "800" },

  // Amount card
  amountHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  amountOrigLabel: { fontSize: 12, marginBottom: 2 },
  amountOrig: { fontSize: 28, fontWeight: "800" },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { fontSize: 12, fontWeight: "600", color: "#FFFFFF" },
  progressTrack: { height: 6, borderRadius: 3, marginBottom: 12 },
  progressFill: { height: 6, borderRadius: 3 },
  amountBreakdown: { flexDirection: "row", gap: 28 },
  breakdownItem: { gap: 2 },
  breakdownLabel: { fontSize: 12 },
  breakdownVal: { fontSize: 17, fontWeight: "700" },
  paidBanner: { borderRadius: 10, borderWidth: 1, padding: 12, alignItems: "center", marginTop: 4 },
  paidBannerText: { fontSize: 15, fontWeight: "700" },
  paidBannerSub: { fontSize: 12, marginTop: 2 },

  // Details card
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  detailKey: { fontSize: 14, fontWeight: "600" },
  detailVal: { fontSize: 14, maxWidth: "60%", textAlign: "right" },

  // Actions card
  actionPrimary: { borderRadius: 14, overflow: "hidden", marginBottom: 10 },
  actionGrad: { height: 50, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  actionPrimaryText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  actionSecondary: { borderRadius: 12, borderWidth: 1, height: 46, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  actionSecondaryText: { fontSize: 15, fontWeight: "700" },
  actionRow: { flexDirection: "row", gap: 10 },
  actionHalf: { flex: 1, borderRadius: 12, borderWidth: 1, height: 46, alignItems: "center", justifyContent: "center" },
  actionHalfText: { fontSize: 14, fontWeight: "700" },

  // View person link
  viewPersonBtn: { borderRadius: 14, borderWidth: 1, padding: 16, alignItems: "center" },
  viewPersonText: { fontSize: 15, fontWeight: "600" },

  // Overlay
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center" },

  // Edit modal
  editModal: { width: 320, borderRadius: 20, borderWidth: 1, padding: 24, gap: 12 },
  editTitle: { fontSize: 18, fontWeight: "700" },
  editInput: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  editActions: { flexDirection: "row", gap: 10 },
  editBtn: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 12, alignItems: "center" },
  editBtnText: { fontSize: 15, fontWeight: "700" },

  // Pay Debt modal
  payModal: { width: "90%", maxWidth: 360, borderRadius: 20, borderWidth: 1, padding: 24, gap: 14 },
  payTitle: { fontSize: 18, fontWeight: "700" },
  payRemaining: { fontSize: 14 },
  payDue: { fontSize: 12, fontWeight: "500", marginTop: -6 },
  payFullBtn: { borderRadius: 14, overflow: "hidden" },
  payFullGrad: { height: 48, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  payFullText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  divider: { flexDirection: "row", alignItems: "center", gap: 10 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: "500" },
  pctRow: { flexDirection: "row", gap: 10 },
  pctBtn: { flex: 1, borderRadius: 10, overflow: "hidden", height: 44, alignItems: "center", justifyContent: "center" },
  pctBtnGrad: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  pctBtnActiveText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  pctBtnText: { fontSize: 14, fontWeight: "600" },
  pctInputWrap: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  pctInput: { flex: 1, fontSize: 16, fontWeight: "600", minWidth: 60 },
  pctSuffix: { fontSize: 16, fontWeight: "600" },
  pctCalc: { fontSize: 13, fontWeight: "500" },
  payInput: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  payActions: { flexDirection: "row", gap: 10 },
  payBtn: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 12, alignItems: "center" },
  payBtnText: { fontSize: 15, fontWeight: "700" },
});
