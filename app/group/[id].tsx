import { useState, useMemo, useRef, useEffect } from "react";
import { simplifyGroupDebts } from "@/lib/utils/simplifyGroupDebts";
import type { SimplifiedPayment, RawGroupDebt } from "@/lib/utils/simplifyGroupDebts";
import { getGroupDebtsForSimplification } from "@/lib/services/debtService";
import type { SimplificationResult } from "@/lib/services/debtService";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { DebtCancellingIntroModal } from "@/components/DebtCancellingIntroModal";
import {
  getDebtCancellingPref,
  upsertDebtCancellingPref,
} from "@/lib/services/debtCancellingService";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useDebts } from "@/context/DebtContext";
import { useGroups } from "@/context/GroupsContext";
import { useContacts } from "@/context/ContactsContext";
import { useTheme } from "@/context/ThemeContext";
import { Avatar } from "@/components/Avatar";
import { sendNudge } from "@/lib/services/nudgeService";
import type { Debt, GroupMember } from "@/context/DebtContext";

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

const PAGE_SIZE = 8;

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
  const { debts, currentUserId } = useDebts();
  const { groups } = useGroups();
  const { individuals, addIndividual } = useContacts();
  const { colors: t } = useTheme();
  const [sort, setSort] = useState<DebtSortOption>("date");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showSimplified, setShowSimplified] = useState(false);
  const [rawGroupDebts, setRawGroupDebts] = useState<RawGroupDebt[] | null>(null);
  const [hasExcludedDebts, setHasExcludedDebts] = useState(false);
  const [simplifyVersion, setSimplifyVersion] = useState(0);
  const [showCancellingModal, setShowCancellingModal] = useState(false);
  const [cancellingEnabled, setCancellingEnabled] = useState(false);
  const [prefLoaded, setPrefLoaded] = useState(false);
  const [simplifyLoading, setSimplifyLoading] = useState(false);
  const [membersExpanded, setMembersExpanded] = useState(false);
  const [visibleMemberCount, setVisibleMemberCount] = useState(PAGE_SIZE);
  const [addingIds, setAddingIds] = useState<Set<string>>(() => new Set());

  // Group-level nudge state
  const [nudgeLoading, setNudgeLoading] = useState(false);
  const [nudgeCooldown, setNudgeCooldown] = useState(false);
  const nudgeCooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Per-member nudge state
  const [memberNudgeLoadingIds, setMemberNudgeLoadingIds] = useState<Set<string>>(() => new Set());
  const [memberNudgeCooldownIds, setMemberNudgeCooldownIds] = useState<Set<string>>(() => new Set());
  const memberNudgeCooldownTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => () => {
    if (nudgeCooldownRef.current) clearTimeout(nudgeCooldownRef.current);
    memberNudgeCooldownTimers.current.forEach(t => clearTimeout(t));
  }, []);

  // Load Debt Cancelling preference from Supabase once userId + groupId are ready.
  // Shows the intro popup automatically on first visit (intro_seen = false or no row yet).
  useEffect(() => {
    const gId = Array.isArray(id) ? id[0] : id;
    if (!currentUserId || !gId) return;
    let cancelled = false;

    getDebtCancellingPref(gId)
      .then(pref => {
        if (cancelled) return;
        if (pref === null || !pref.introSeen) {
          // First time in this group — show the intro
          setShowCancellingModal(true);
          setCancellingEnabled(false);
        } else {
          setCancellingEnabled(pref.enabled);
        }
        setPrefLoaded(true);
      })
      .catch(e => {
        console.error("[DebtCancelling] pref fetch error:", e);
        if (!cancelled) setPrefLoaded(true);
      });

    return () => { cancelled = true; };
  }, [currentUserId, id]);

  /** "Not Now" or X — marks intro seen, leaves enabled=false */
  function handleCancellingClose() {
    const gId = Array.isArray(id) ? id[0] : id;
    if (gId) upsertDebtCancellingPref(gId, { introSeen: true, enabled: false }).catch(() => {});
    setShowCancellingModal(false);
    setPrefLoaded(true);
  }

  /** "Use Debt Cancelling" — marks intro seen, enables for this group, expands the section */
  function handleCancellingEnable() {
    const gId = Array.isArray(id) ? id[0] : id;
    if (gId) {
      upsertDebtCancellingPref(gId, { introSeen: true, enabled: true })
        .then(() => setSimplifyVersion(v => v + 1)) // re-fetch after write lands
        .catch(() => {});
    }
    setCancellingEnabled(true);
    setShowCancellingModal(false);
    setShowSimplified(true);
    setPrefLoaded(true);
  }

  /** Toggle handler for the on/off switch in the section card */
  async function handleToggleCancelling(value: boolean) {
    const gId = Array.isArray(id) ? id[0] : id;
    setCancellingEnabled(value); // optimistic
    try {
      if (gId) await upsertDebtCancellingPref(gId, { enabled: value });
      setSimplifyVersion(v => v + 1); // re-fetch so opt-in list is current
    } catch {
      setCancellingEnabled(!value); // revert on failure
      Alert.alert("Error", "Couldn't update your preference. Please try again.");
    }
  }

  const td = today();
  const groupId = Array.isArray(id) ? id[0] : id;
  const group = groups.find(g => g.id === groupId);
  const groupDebts = debts.filter(d => d.groupId === groupId);
  const displayDebts = useMemo(() => sortDebts(groupDebts, sort, td), [debts, sort, groupId]);

  // A stable fingerprint of the current user's group debts.
  // When this changes it means a status, amount, or count changed for a debt
  // the viewer is part of — the simplification data should be re-fetched.
  const groupDebtKey = useMemo(
    () =>
      debts
        .filter(d => d.groupId === groupId)
        .map(d => `${d.id}|${d.status}|${Math.round(d.remainingAmount * 100)}`)
        .sort()
        .join(","),
    [debts, groupId],
  );

  // Fetch opted-in debts for the simplified view.
  // Re-runs when debts change (groupDebtKey) or when the user's opt-in preference
  // is saved to the DB (simplifyVersion), so the preview stays in sync.
  useEffect(() => {
    if (!groupId || !currentUserId) return;
    let cancelled = false;
    setSimplifyLoading(true);
    getGroupDebtsForSimplification(groupId, currentUserId)
      .then((result: SimplificationResult) => {
        if (!cancelled) {
          setRawGroupDebts(result.rawDebts);
          setHasExcludedDebts(result.hasExcludedDebts);
        }
      })
      .catch(e => {
        console.error("[group simplify]", e);
        if (!cancelled) { setRawGroupDebts([]); setHasExcludedDebts(false); }
      })
      .finally(() => { if (!cancelled) setSimplifyLoading(false); });
    return () => { cancelled = true; };
  }, [groupId, currentUserId, groupDebtKey, simplifyVersion]);

  const simplifiedPayments = useMemo<SimplifiedPayment[]>(
    () => (rawGroupDebts ? simplifyGroupDebts(rawGroupDebts) : []),
    [rawGroupDebts],
  );

  if (!group) {
    return (
      <View style={[styles.notFound, { backgroundColor: t.bg }]}>
        <Text style={{ color: t.textMuted, fontSize: 16 }}>Group not found.</Text>
      </View>
    );
  }

  const totalMembers = group.members.length;
  const hasMoreThanPage = totalMembers > PAGE_SIZE;
  const allMembersVisible = visibleMemberCount >= totalMembers;
  const atMinMembers = visibleMemberCount <= PAGE_SIZE;
  const visibleMembers = group.members.slice(0, visibleMemberCount);

  function findContactForMember(m: GroupMember) {
    if (m.contactId) {
      const byId = individuals.find(i => i.id === m.contactId);
      if (byId) return byId;
    }
    const nameLower = m.name.toLowerCase();
    const byName = individuals.find(i =>
      i.name.toLowerCase() === nameLower ||
      (i.nickname && i.nickname.toLowerCase() === nameLower)
    );
    if (byName) return byName;
    if (m.phoneOrUsername) {
      const pouLower = m.phoneOrUsername.toLowerCase();
      return individuals.find(i => i.phoneOrUsername && i.phoneOrUsername.toLowerCase() === pouLower);
    }
    return undefined;
  }

  async function handleAddMember(m: GroupMember) {
    if (addingIds.has(m.id)) return;
    setAddingIds(prev => new Set(prev).add(m.id));
    try {
      await addIndividual({
        name: m.name,
        nickname: "",
        phoneOrUsername: m.phoneOrUsername || "",
        notes: "",
        pinned: false,
        silenced: false,
      });
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not add contact.");
    } finally {
      setAddingIds(prev => { const n = new Set(prev); n.delete(m.id); return n; });
    }
  }

  function toggleMembers() {
    if (membersExpanded) {
      setMembersExpanded(false);
      setVisibleMemberCount(PAGE_SIZE);
    } else {
      setMembersExpanded(true);
    }
  }
  function showMoreMembers() {
    setVisibleMemberCount(c => Math.min(c + PAGE_SIZE, totalMembers));
  }
  function showLessMembers() {
    setVisibleMemberCount(c => Math.max(c - PAGE_SIZE, PAGE_SIZE));
  }
  function showAllMembers() {
    setVisibleMemberCount(totalMembers);
  }
  function showNoMembers() {
    setMembersExpanded(false);
    setVisibleMemberCount(PAGE_SIZE);
  }

  const iOwe = groupDebts.filter(d => d.direction === "me").reduce((s, d) => s + d.amount, 0);
  const owedToMe = groupDebts.filter(d => d.direction === "them").reduce((s, d) => s + d.amount, 0);

  const memberBalances = group.members.map(m => {
    const bal = groupDebts.filter(d => d.person === m.name)
      .reduce((s, d) => s + (d.direction === "them" ? d.amount : -d.amount), 0);
    return { member: m, balance: bal };
  });
  const iOweMembers = memberBalances.filter(mb => mb.balance < 0);
  const oweMeMembers = memberBalances.filter(mb => mb.balance > 0);

  // Members who owe me money AND have a linked account — eligible for nudge
  const nudgeEligibleMembers = oweMeMembers.map(({ member, balance }) => {
    const contact = findContactForMember(member);
    return { member, balance, contact, linkedUserId: contact?.linkedUserId ?? null };
  });
  const hasAnyOwingMe = oweMeMembers.length > 0;
  const groupNudgeDisabled = nudgeLoading || nudgeCooldown || !hasAnyOwingMe;

  async function handleGroupNudge() {
    if (!group || nudgeLoading || nudgeCooldown) return;
    if (!hasAnyOwingMe) {
      Alert.alert("Nothing to nudge", "Nobody in this group currently owes you money.");
      return;
    }

    setNudgeLoading(true);
    let sent = 0;
    let skipped = 0;
    try {
      await Promise.all(
        nudgeEligibleMembers.map(async ({ member, balance, contact, linkedUserId }) => {
          if (!linkedUserId) { skipped++; return; }
          await sendNudge({
            recipientUserId: linkedUserId,
            contactId: contact?.id ?? member.id,
            amountCents: Math.round(balance * 100),
            displayName: member.name,
            groupId,
            groupName: group.name,
          });
          sent++;
        })
      );

      if (sent === 0 && skipped > 0) {
        Alert.alert(
          "Couldn't send nudges",
          "People owe you money, but they do not have accounts yet, so they cannot receive in-app nudges.",
        );
      } else if (sent > 0 && skipped > 0) {
        Alert.alert(
          `Nudged ${sent} ${sent === 1 ? "person" : "people"}.`,
          `${skipped} ${skipped === 1 ? "person does" : "people do"} not have accounts yet.`,
        );
        setNudgeCooldown(true);
        nudgeCooldownRef.current = setTimeout(() => setNudgeCooldown(false), 10_000);
      } else if (sent > 0) {
        Alert.alert(`Nudged ${sent} ${sent === 1 ? "person" : "people"}.`);
        setNudgeCooldown(true);
        nudgeCooldownRef.current = setTimeout(() => setNudgeCooldown(false), 10_000);
      }
    } catch (e: any) {
      Alert.alert("Couldn't send nudges", e?.message ?? "Something went wrong. Please try again.");
    } finally {
      setNudgeLoading(false);
    }
  }

  async function handleMemberNudge(member: GroupMember, balance: number) {
    if (!group) return;
    const memberId = member.id;
    if (memberNudgeLoadingIds.has(memberId) || memberNudgeCooldownIds.has(memberId)) return;

    const contact = findContactForMember(member);

    if (balance <= 0) {
      Alert.alert("Nothing to nudge", `${member.name} doesn't owe you anything right now.`);
      return;
    }
    if (!contact?.linkedUserId) {
      Alert.alert(
        "Can't send nudge",
        `${member.name} doesn't have an account yet, so they cannot receive an in-app nudge.`,
      );
      return;
    }

    setMemberNudgeLoadingIds(prev => new Set(prev).add(memberId));
    try {
      await sendNudge({
        recipientUserId: contact.linkedUserId,
        contactId: contact.id,
        amountCents: Math.round(balance * 100),
        displayName: member.name,
        groupId,
        groupName: group.name,
      });
      Alert.alert("Nudge sent.", `${member.name} has been reminded to pay $${balance.toFixed(2)}.`);
      setMemberNudgeCooldownIds(prev => new Set(prev).add(memberId));
      const timer = setTimeout(() => {
        setMemberNudgeCooldownIds(prev => { const n = new Set(prev); n.delete(memberId); return n; });
        memberNudgeCooldownTimers.current.delete(memberId);
      }, 10_000);
      memberNudgeCooldownTimers.current.set(memberId, timer);
    } catch (e: any) {
      Alert.alert("Couldn't send nudge", e?.message ?? "Something went wrong. Please try again.");
    } finally {
      setMemberNudgeLoadingIds(prev => { const n = new Set(prev); n.delete(memberId); return n; });
    }
  }

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
            {group.description ? (
              <Text style={[styles.groupSub, { color: t.textSub }]}>{group.description}</Text>
            ) : null}
            <Pressable onPress={toggleMembers} hitSlop={8}>
              <Text style={[styles.memberCountBtn, { color: t.primary }]}>
                {`${totalMembers} ${totalMembers === 1 ? "member" : "members"} · Tap to ${membersExpanded ? "collapse" : "expand"}`}
              </Text>
            </Pressable>
          </View>
        </View>

        {membersExpanded && (
          <View style={[styles.memberCard, { backgroundColor: t.card, borderColor: t.border }]}>
            {visibleMembers.map((m, i) => {
              const contact = findContactForMember(m);
              const isAdding = addingIds.has(m.id);
              const borderStyle = i < visibleMembers.length - 1
                ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }
                : undefined;

              // Calculate this member's balance in the group
              const memberBal = groupDebts.filter(d => d.person === m.name)
                .reduce((s, d) => s + (d.direction === "them" ? d.amount : -d.amount), 0);
              const memberOwesMe = memberBal > 0;
              const isNudgingMember = memberNudgeLoadingIds.has(m.id);
              const isMemberCoolingDown = memberNudgeCooldownIds.has(m.id);

              if (contact) {
                const canNudge = memberOwesMe && !!contact.linkedUserId;
                const nudgeDimmed = !memberOwesMe || isNudgingMember || isMemberCoolingDown;
                return (
                  <Pressable
                    key={m.id}
                    style={[styles.memberListRow, borderStyle]}
                    onPress={() => router.push(`/individual/${contact.id}` as any)}
                  >
                    <Avatar name={contact.name} imageUri={contact.imageUri} size={32} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.memberListName, { color: t.text }]}>
                        {contact.nickname || contact.name}
                      </Text>
                      {contact.phoneOrUsername ? (
                        <Text style={[styles.memberListSub, { color: t.textMuted }]}>{contact.phoneOrUsername}</Text>
                      ) : null}
                    </View>
                    <Pressable
                      style={[
                        styles.memberNudgeBtn,
                        { borderColor: canNudge && !nudgeDimmed ? t.primaryBorder : t.border },
                        nudgeDimmed && { opacity: 0.4 },
                      ]}
                      onPress={() => handleMemberNudge(m, memberBal)}
                      disabled={isNudgingMember || isMemberCoolingDown}
                      hitSlop={8}
                    >
                      <Text style={[styles.memberNudgeText, { color: canNudge && !nudgeDimmed ? t.primary : t.textMuted }]}>
                        {isNudgingMember ? "…" : isMemberCoolingDown ? "✓" : "Nudge"}
                      </Text>
                    </Pressable>
                    <Text style={[styles.memberChevron, { color: t.primary }]}>›</Text>
                  </Pressable>
                );
              }

              // Member not in contacts — show Add + Nudge
              const nudgeDimmed = !memberOwesMe || isNudgingMember || isMemberCoolingDown;
              return (
                <View key={m.id} style={[styles.memberListRow, borderStyle]}>
                  <Avatar name={m.name} size={32} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.memberListName, { color: t.text }]}>{m.name}</Text>
                    {m.phoneOrUsername ? (
                      <Text style={[styles.memberListSub, { color: t.textMuted }]}>{m.phoneOrUsername}</Text>
                    ) : null}
                  </View>
                  <Pressable
                    style={[
                      styles.memberNudgeBtn,
                      { borderColor: t.border },
                      nudgeDimmed && { opacity: 0.4 },
                    ]}
                    onPress={() => handleMemberNudge(m, memberBal)}
                    disabled={isNudgingMember || isMemberCoolingDown}
                    hitSlop={8}
                  >
                    <Text style={[styles.memberNudgeText, { color: t.textMuted }]}>
                      {isNudgingMember ? "…" : isMemberCoolingDown ? "✓" : "Nudge"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.memberAddBtn, { backgroundColor: t.primarySoft, borderColor: t.primaryBorder, opacity: isAdding ? 0.6 : 1 }]}
                    onPress={() => handleAddMember(m)}
                    disabled={isAdding}
                    hitSlop={8}
                  >
                    <Text style={[styles.memberAddText, { color: t.primary }]}>
                      {isAdding ? "Adding…" : "Add"}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
            {hasMoreThanPage && (
              <View style={[styles.memberControls, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }]}>
                {!atMinMembers && (
                  <Pressable style={[styles.memberCtrlBtn, { backgroundColor: t.card, borderColor: t.border }]} onPress={showLessMembers}>
                    <Text style={[styles.memberCtrlText, { color: t.textSub }]}>Show Less</Text>
                  </Pressable>
                )}
                {!allMembersVisible && (
                  <Pressable style={[styles.memberCtrlBtn, { backgroundColor: t.card, borderColor: t.border }]} onPress={showMoreMembers}>
                    <Text style={[styles.memberCtrlText, { color: t.primary }]}>Show More</Text>
                  </Pressable>
                )}
                {allMembersVisible ? (
                  <Pressable style={[styles.memberCtrlBtn, { backgroundColor: t.card, borderColor: t.border }]} onPress={showNoMembers}>
                    <Text style={[styles.memberCtrlText, { color: t.textSub }]}>Show None</Text>
                  </Pressable>
                ) : (
                  <Pressable style={[styles.memberCtrlBtn, { backgroundColor: t.primarySoft, borderColor: t.primaryBorder }]} onPress={showAllMembers}>
                    <Text style={[styles.memberCtrlText, { color: t.primary }]}>Show All</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        )}

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

        {/* Quick-action row: Add Debt + Nudge */}
        <View style={styles.actionRow}>
          <Pressable
            style={styles.actionBtnPrimary}
            onPress={() => router.push(`/add-group-debt?groupId=${groupId}` as any)}
          >
            <LinearGradient colors={[t.from, t.to] as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionBtnGrad}>
              <Text style={styles.actionBtnPrimText}>+ Add Debt</Text>
            </LinearGradient>
          </Pressable>
          <Pressable
            style={[
              styles.actionBtnSecondary,
              { borderColor: t.border },
              groupNudgeDisabled && { opacity: 0.45 },
            ]}
            onPress={handleGroupNudge}
            disabled={nudgeLoading || nudgeCooldown}
          >
            <Text style={[styles.actionBtnSecText, { color: t.text }]}>
              {nudgeLoading ? "Sending…" : nudgeCooldown ? "Nudged ✓" : "Nudge"}
            </Text>
          </Pressable>
        </View>

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
          {/* ── Section header ───────────────────────────────────────── */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: t.text }]}>Simplified Debts</Text>
            <Pressable onPress={() => setShowSimplified(s => !s)} hitSlop={12}>
              <Text style={[styles.sortBtnIcon, { color: t.textMuted }]}>{showSimplified ? "▲" : "▼"}</Text>
            </Pressable>
          </View>

          {showSimplified && (
            <>
              {/* ── Debt Simplifying toggle card ─────────────────────── */}
              <View style={[
                styles.cancellingCard,
                {
                  backgroundColor: cancellingEnabled ? t.primarySoft : t.card,
                  borderColor: cancellingEnabled ? t.primaryBorder : t.border,
                },
              ]}>
                <View style={styles.cancellingRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.cancellingTitleRow}>
                      <Text style={[styles.cancellingTitle, { color: t.text }]}>Debt Simplifying</Text>
                      <Pressable
                        onPress={() => setShowCancellingModal(true)}
                        hitSlop={8}
                        accessibilityLabel="About Debt Simplifying"
                      >
                        <Text style={[styles.cancellingInfoIcon, { color: t.textMuted }]}>ⓘ</Text>
                      </Pressable>
                    </View>
                    <Text style={[styles.cancellingSub, { color: t.textSub }]}>
                      {cancellingEnabled
                        ? "GotchuLatr previews the fewest payments needed for opted-in members."
                        : "Debt Simplifying is off for this group."}
                    </Text>
                  </View>
                  <Switch
                    value={cancellingEnabled}
                    onValueChange={handleToggleCancelling}
                    trackColor={{ false: t.textMuted, true: t.primary }}
                    thumbColor="#fff"
                    disabled={!prefLoaded}
                  />
                </View>
              </View>

              {/* ── Simplified payments (only when enabled) ──────────── */}
              {cancellingEnabled ? (
                simplifyLoading ? (
                  <View style={[styles.emptyBox, { backgroundColor: t.card, borderColor: t.border }]}>
                    <Text style={[styles.emptyText, { color: t.textMuted }]}>Computing…</Text>
                  </View>
                ) : (
                  <>
                    {simplifiedPayments.length === 0 ? (
                      <View style={[styles.emptyBox, { backgroundColor: t.card, borderColor: t.border }]}>
                        <Text style={[styles.emptyText, { color: t.textMuted }]}>
                          {rawGroupDebts && rawGroupDebts.length > 0
                            ? "Everything cancels out. No payments needed."
                            : hasExcludedDebts
                            ? "Debt Cancelling only includes members who have opted in. Some debts may not appear yet."
                            : "No approved debts to simplify yet."}
                        </Text>
                      </View>
                    ) : (
                      <>
                        {/* Banner: only when some debts were excluded due to opt-out */}
                        {hasExcludedDebts && (
                          <View style={[styles.optInBanner, { backgroundColor: t.primarySoft, borderColor: t.primaryBorder }]}>
                            <Text style={[styles.optInBannerText, { color: t.primary }]}>
                              Some debts are not included because not everyone involved has opted in.
                            </Text>
                          </View>
                        )}
                        {simplifiedPayments.map((p, i) => (
                          <View key={i} style={[styles.simplifiedRow, { backgroundColor: t.card, borderColor: t.border }]}>
                            <Text style={[styles.simplifiedName, { color: t.red }]} numberOfLines={1}>{p.from}</Text>
                            <Text style={[styles.simplifiedArrow, { color: t.textMuted }]}>→</Text>
                            <Text style={[styles.simplifiedName, { color: t.green }]} numberOfLines={1}>{p.to}</Text>
                            <Text style={[styles.simplifiedAmt, { color: t.text }]}>
                              ${(p.amountCents / 100).toFixed(2)}
                            </Text>
                          </View>
                        ))}
                      </>
                    )}
                  </>
                )
              ) : null}
            </>
          )}
        </View>

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
              <Pressable key={debt.id} style={[styles.txRow, { backgroundColor: t.card, borderColor: t.border }]} onPress={() => router.push(`/debt/${debt.id}` as any)}>
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
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <DebtCancellingIntroModal
        visible={showCancellingModal}
        onClose={handleCancellingClose}
        onEnable={handleCancellingEnable}
      />

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
  memberCountBtn: { fontSize: 13, fontWeight: "600", marginTop: 4 },
  memberCard: { borderRadius: 14, borderWidth: 1, marginBottom: 16, overflow: "hidden" },
  memberListRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  memberListName: { fontSize: 14, fontWeight: "600" },
  memberListSub: { fontSize: 12, marginTop: 1 },
  memberChevron: { fontSize: 20, fontWeight: "300", paddingLeft: 4 },
  memberAddBtn: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5 },
  memberAddText: { fontSize: 12, fontWeight: "700" },
  memberNudgeBtn: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  memberNudgeText: { fontSize: 12, fontWeight: "600" },
  memberControls: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 12 },
  memberCtrlBtn: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6 },
  memberCtrlText: { fontSize: 12, fontWeight: "600" },
  cardRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  summaryCard: { flex: 1, borderRadius: 16, padding: 18, borderWidth: 1 },
  summaryLabel: { fontSize: 13 },
  summaryValue: { fontSize: 24, fontWeight: "700", marginTop: 6 },

  // Quick-action row (Add Debt / Nudge)
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 28 },
  actionBtnPrimary: { flex: 1, borderRadius: 14, overflow: "hidden" },
  actionBtnGrad: { height: 46, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  actionBtnPrimText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  actionBtnSecondary: { flex: 1, height: 46, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  actionBtnSecText: { fontSize: 15, fontWeight: "600" },

  section: { marginBottom: 28 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  cancellingCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  cancellingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  cancellingTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  cancellingTitle: { fontSize: 15, fontWeight: "700" },
  cancellingInfoIcon: { fontSize: 15, fontWeight: "600" },
  cancellingSub: { fontSize: 13, lineHeight: 18 },
  sortBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sortBtnIcon: { fontSize: 14 },
  sortHint: { fontSize: 12, marginBottom: 10 },
  breakdownHeader: { fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 8 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1 },
  breakdownName: { fontSize: 15, fontWeight: "600" },
  breakdownAmt: { fontSize: 15, fontWeight: "700" },
  emptyBox: { borderRadius: 14, padding: 20, alignItems: "center", borderWidth: 1 },
  emptyText: { fontSize: 14, textAlign: "center", fontStyle: "italic" },
  optInBanner: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 10 },
  optInBannerText: { fontSize: 13, lineHeight: 19 },
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
  simplifiedRow: { borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  simplifiedName: { fontSize: 14, fontWeight: "700", flex: 1 },
  simplifiedArrow: { fontSize: 16 },
  simplifiedAmt: { fontSize: 14, fontWeight: "700" },
});
