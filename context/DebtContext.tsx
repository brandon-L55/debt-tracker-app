import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { getDebts, createDebt, updateDebtStatus as serviceUpdateDebtStatus, updateDebtDetails as serviceUpdateDebtDetails, cancelDebt as serviceCancelDebt, createPayment } from "@/lib/services/debtService";
import type { CreateDebtInput, UpdateDebtDetailsInput } from "@/lib/services/debtService";
import { showDebtNotification } from "@/lib/services/notificationService";

export type Debt = {
  id: string;
  /** Auth user id of whoever created this debt row. */
  creatorId: string;
  person: string;
  /** Contact id of the counterpart (set by debtService). */
  contactId?: string;
  /** Auth user id of the counterpart when they have a real account. */
  linkedUserId?: string;
  amount: number;
  /** Remaining balance after payments. Equals amount when no payments have been made. */
  remainingAmount: number;
  /** Sum of payments made by the current user for this debt. */
  totalPaidAmount: number;
  /** Sum of payments received by the current user for this debt. */
  totalReceivedAmount: number;
  direction: "them" | "me";
  reason: string;
  status: "pending" | "accepted" | "rejected" | "paid" | "disputed" | "partial";
  createdAt: string;
  groupId?: string;
  deadline?: string | null;
};

// Group and GroupMember types remain here so all screens can import them
// from a single location. State management has moved to GroupsContext.
export type GroupMember = {
  id: string;
  name: string;
  phoneOrUsername: string;
  /** id of the linked Individual/contact (matched by normalized phone number). */
  contactId?: string;
};

export type Group = {
  id: string;
  name: string;
  description: string;
  members: GroupMember[];
  imageUri?: string;
  createdAt: string;
  pinned?: boolean;
  silenced?: boolean;
};

export type Individual = {
  id: string;
  name: string;
  nickname: string;
  phoneOrUsername: string;
  notes: string;
  imageUri?: string;
  createdAt: string;
  pinned?: boolean;
  silenced?: boolean;
};

type DebtContextType = {
  debts: Debt[];
  /** Auth user id of the currently signed-in user (null while loading). */
  currentUserId: string | null;
  addDebt: (debt: Omit<Debt, "id" | "createdAt" | "status" | "creatorId" | "remainingAmount" | "totalPaidAmount" | "totalReceivedAmount"> & { status?: Debt["status"]; clientRequestId?: string }) => Promise<void>;
  /** Accept or reject a pending debt; updates local state immediately. */
  updateDebtStatus: (id: string, status: Debt["status"]) => Promise<void>;
  updateDebtDetails: (id: string, updates: UpdateDebtDetailsInput) => Promise<void>;
  cancelDebt: (id: string) => Promise<void>;
  /**
   * Record a payment against an accepted/partial debt (amountCents is an integer).
   * Optimistically updates remainingAmount and status in local state.
   */
  addPayment: (debtId: string, amountCents: number, clientRequestId?: string) => Promise<void>;
  /** Renames a person string inside all local debts. Called by ContactsContext and GroupsContext when a name changes. */
  renameDebtPerson: (oldName: string, newName: string) => void;
  /** Marks the given debt IDs as paid. Used by the Pay All action on individual/group screens. */
  markDebtsPaid: (ids: string[]) => void;
  /** Applies a partial payment amount against a person's active owed debts, oldest-first. Fully paid debts are marked paid; the last debt may be partially reduced. */
  applyPartialPayment: (personName: string, amount: number) => void;
  reset: () => void;
  isLoading: boolean;
};

const DebtContext = createContext<DebtContextType | null>(null);

type DebtRealtimeRow = {
  id: string;
  creator_id: string;
  payer_user_id: string | null;
  borrower_user_id: string | null;
  amount_cents: number;
  description: string | null;
  status: Debt["status"];
  due_date: string | null;
  updated_at: string;
};

type PaymentRealtimeRow = {
  id: string;
  debt_id: string;
  payer_user_id: string | null;
  amount_cents: number;
};

function createClientRequestId(debtId: string) {
  return `payment:${debtId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export function DebtProvider({ children }: { children: ReactNode }) {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const debtsRef = useRef<Debt[]>([]);
  const paymentInFlightRef = useRef<Set<string>>(new Set());
  const notifiedEventKeysRef = useRef<Set<string>>(new Set());
  const localActionEventKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    debtsRef.current = debts;
  }, [debts]);

  useEffect(() => {
    let isMounted = true;
    let refetchTimer: ReturnType<typeof setTimeout> | null = null;
    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
    let subscribedUserId: string | null = null;
    let isRefetching = false;
    let queuedRefetch = false;

    async function loadDebts(showLoading = true) {
      try {
        if (showLoading) setIsLoading(true);
        const { debts: loaded, userId } = await getDebts();
        if (!isMounted) return;
        setDebts(loaded);
        setCurrentUserId(userId);
      } catch (e) {
        console.error("Failed to load debts:", e);
        if (showLoading) setDebts([]);
      } finally {
        if (isMounted && showLoading) setIsLoading(false);
      }
    }

    async function refetchDebts() {
      if (isRefetching) {
        queuedRefetch = true;
        return;
      }

      isRefetching = true;
      await loadDebts(false);
      isRefetching = false;

      if (queuedRefetch) {
        queuedRefetch = false;
        refetchDebts();
      }
    }

    function scheduleRefetch() {
      if (refetchTimer) clearTimeout(refetchTimer);
      refetchTimer = setTimeout(() => {
        refetchTimer = null;
        refetchDebts();
      }, 250);
    }

    function paymentTouchesLoadedDebt(payload: { new?: { debt_id?: string }; old?: { debt_id?: string } }) {
      const debtId = payload.new?.debt_id ?? payload.old?.debt_id;
      if (!debtId) return true;
      return debtsRef.current.some((debt) => debt.id === debtId);
    }

    function shouldNotify(eventKey: string) {
      const localActionKey = [...localActionEventKeysRef.current].find((key) =>
        eventKey.startsWith(key),
      );
      if (localActionKey) {
        localActionEventKeysRef.current.delete(localActionKey);
        notifiedEventKeysRef.current.add(eventKey);
        return false;
      }
      if (notifiedEventKeysRef.current.has(eventKey)) return false;
      notifiedEventKeysRef.current.add(eventKey);
      return true;
    }

    function notifyDebtChange(userId: string, payload: { eventType: string; new: Partial<DebtRealtimeRow> }) {
      const row = payload.new;
      if (!row.id || !row.creator_id) return;

      const isCreator = row.creator_id === userId;
      const isLinkedParticipant = row.payer_user_id === userId || row.borrower_user_id === userId;
      const debt = debtsRef.current.find((item) => item.id === row.id);
      const person = debt?.person || "Someone";
      const amount = row.amount_cents ? `$${(row.amount_cents / 100).toFixed(2)}` : "a debt";

      if (payload.eventType === "INSERT") {
        const eventKey = `debt:${row.id}:insert`;
        if (row.status === "pending" && !isCreator && isLinkedParticipant && shouldNotify(eventKey)) {
          showDebtNotification("New debt request", `${person} sent you ${amount}.`, {
            debtId: row.id,
            event: "debt_pending",
          });
        }
        return;
      }

      if (payload.eventType !== "UPDATE" || !row.status) return;

      const updateKey = `debt:${row.id}:status:${row.status}:${row.updated_at ?? ""}`;
      if (row.status === "accepted" && isCreator && shouldNotify(updateKey)) {
        showDebtNotification("Debt accepted", `${person} accepted ${amount}.`, {
          debtId: row.id,
          event: "debt_accepted",
        });
        return;
      }

      if (row.status === "rejected") {
        if (isCreator && shouldNotify(updateKey)) {
          showDebtNotification("Debt declined", `${person} declined ${amount}.`, {
            debtId: row.id,
            event: "debt_declined",
          });
        } else if (!isCreator && isLinkedParticipant && shouldNotify(updateKey)) {
          showDebtNotification("Debt cancelled", `${person} cancelled ${amount}.`, {
            debtId: row.id,
            event: "debt_cancelled",
          });
        }
        return;
      }

      const editKey = `debt:${row.id}:edit:${row.updated_at ?? ""}`;
      if (row.status === "pending" && !isCreator && isLinkedParticipant && shouldNotify(editKey)) {
        showDebtNotification("Debt updated", `${person} edited ${amount}.`, {
          debtId: row.id,
          event: "debt_edited",
        });
      }
    }

    function notifyPaymentChange(userId: string, payload: { eventType: string; new: Partial<PaymentRealtimeRow> }) {
      const row = payload.new;
      if (payload.eventType !== "INSERT" || !row.id || !row.debt_id) return;
      if (row.payer_user_id === userId) return;
      const debt = debtsRef.current.find((item) => item.id === row.debt_id);
      if (!debt) return;

      const eventKey = `payment:${row.id}:insert`;
      if (!shouldNotify(eventKey)) return;

      const amount = row.amount_cents ? `$${(row.amount_cents / 100).toFixed(2)}` : "a payment";
      showDebtNotification("Payment made", `${debt.person || "Someone"} paid ${amount}.`, {
        debtId: row.debt_id,
        paymentId: row.id,
        event: "payment_made",
      });
    }

    function stopRealtime() {
      if (refetchTimer) {
        clearTimeout(refetchTimer);
        refetchTimer = null;
      }
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
      }
      subscribedUserId = null;
      queuedRefetch = false;
    }

    function startRealtime(userId: string) {
      if (subscribedUserId === userId && realtimeChannel) return;

      stopRealtime();
      subscribedUserId = userId;
      realtimeChannel = supabase
        .channel(`debt-sync:${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "debts", filter: `creator_id=eq.${userId}` },
          (payload) => {
            notifyDebtChange(userId, payload);
            scheduleRefetch();
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "debts", filter: `payer_user_id=eq.${userId}` },
          (payload) => {
            notifyDebtChange(userId, payload);
            scheduleRefetch();
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "debts", filter: `borrower_user_id=eq.${userId}` },
          (payload) => {
            notifyDebtChange(userId, payload);
            scheduleRefetch();
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "payments" },
          (payload) => {
            if (paymentTouchesLoadedDebt(payload)) {
              notifyPaymentChange(userId, payload);
              scheduleRefetch();
            }
          },
        )
        .subscribe();
    }

    // Load on mount and whenever the auth session changes so direction is
    // always computed relative to the currently signed-in user.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") &&
        session?.user
      ) {
        startRealtime(session.user.id);
        loadDebts();
      } else if (event === "SIGNED_OUT" || (event === "INITIAL_SESSION" && !session?.user)) {
        stopRealtime();
        setDebts([]);
        setCurrentUserId(null);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      stopRealtime();
      subscription.unsubscribe();
    };
  }, []);

  function addDebt(input: Omit<Debt, "id" | "createdAt" | "status" | "creatorId" | "remainingAmount" | "totalPaidAmount" | "totalReceivedAmount"> & { status?: Debt["status"]; clientRequestId?: string }): Promise<void> {
    const debtInput: CreateDebtInput = {
      person: input.person,
      contactId: input.contactId,
      amount: input.amount,
      direction: input.direction,
      reason: input.reason,
      groupId: input.groupId,
      deadline: input.deadline,
      status: input.status,
      clientRequestId: input.clientRequestId,
    };
    // Returns the promise so callers can await and surface errors (e.g. "No account found").
    return createDebt(debtInput)
      .then(created => { setDebts(prev => prev.some(d => d.id === created.id) ? prev : [created, ...prev]); });
  }

  async function updateDebtStatus(id: string, status: Debt["status"]) {
    localActionEventKeysRef.current.add(`debt:${id}:status:${status}:`);
    await serviceUpdateDebtStatus(id, status);
    setDebts(prev => prev.map(d => d.id === id ? { ...d, status } : d));
  }

  async function updateDebtDetails(id: string, updates: UpdateDebtDetailsInput) {
    localActionEventKeysRef.current.add(`debt:${id}:edit:`);
    const updated = await serviceUpdateDebtDetails(id, updates);
    setDebts(prev => prev.map(d => d.id === id ? updated : d));
  }

  async function cancelDebt(id: string) {
    localActionEventKeysRef.current.add(`debt:${id}:status:rejected:`);
    await serviceCancelDebt(id);
    setDebts(prev => prev.map(d => d.id === id ? { ...d, status: "rejected" } : d));
  }

  async function addPayment(debtId: string, amountCents: number, clientRequestId?: string) {
    if (paymentInFlightRef.current.has(debtId)) return;

    paymentInFlightRef.current.add(debtId);
    try {
      const requestId = clientRequestId ?? createClientRequestId(debtId);
      const beforePayment = debtsRef.current.find(d => d.id === debtId);
      const expectedRemainingCents = beforePayment
        ? Math.max(0, Math.round(beforePayment.remainingAmount * 100) - amountCents)
        : null;

      const paymentResult = await createPayment(debtId, amountCents, requestId);
      if (paymentResult === "duplicate") return;

      setDebts(prev => prev.map(d => {
        if (d.id !== debtId || expectedRemainingCents === null) return d;
        const currentRemainingCents = Math.round(d.remainingAmount * 100);
        const newRemainingCents = Math.min(currentRemainingCents, expectedRemainingCents);
        const newStatus: Debt["status"] = newRemainingCents <= 0 ? "paid" : "partial";
        const paymentAmount = amountCents / 100;
        return {
          ...d,
          remainingAmount: newRemainingCents / 100,
          status: newStatus,
          totalPaidAmount: d.totalPaidAmount + paymentAmount,
          totalReceivedAmount:
            d.direction === "them" ? d.totalReceivedAmount + paymentAmount : d.totalReceivedAmount,
        };
      }));
    } finally {
      paymentInFlightRef.current.delete(debtId);
    }
  }

  function renameDebtPerson(oldName: string, newName: string) {
    setDebts(prev =>
      prev.map(d => d.person === oldName ? { ...d, person: newName } : d)
    );
  }

  function markDebtsPaid(ids: string[]) {
    const idSet = new Set(ids);
    for (const id of idSet) {
      const debt = debtsRef.current.find(d => d.id === id);
      // Only the borrower can submit payments; skip debts the user is owed.
      if (!debt || debt.direction !== "me") continue;
      const amountCents = Math.round(debt.remainingAmount * 100);
      if (amountCents <= 0) continue;
      // addPayment handles its own optimistic update and the DB trigger
      // sets paid_cents / status. Realtime sync is the source of truth.
      addPayment(id, amountCents, createClientRequestId(id)).catch(e =>
        console.error("markDebtsPaid: payment failed for", id, e)
      );
    }
  }

  function applyPartialPayment(personName: string, amount: number) {
    // Use the live ref so we read current remainingAmount, not stale closure state.
    const activeOwed = debtsRef.current
      .filter(d =>
        d.person === personName &&
        d.direction === "me" &&
        (d.status === "accepted" || d.status === "partial")
      )
      .sort((a, b) => a.remainingAmount - b.remainingAmount);  // smallest balance first

    let remaining = amount;
    for (const debt of activeOwed) {
      if (remaining <= 0) break;
      // Pay at most what's left on this debt.
      const toPay = Math.min(remaining, debt.remainingAmount);
      const amountCents = Math.round(toPay * 100);
      if (amountCents <= 0) continue;
      remaining = parseFloat((remaining - toPay).toFixed(2));
      // DB trigger decides whether the resulting status is "partial" or "paid".
      addPayment(debt.id, amountCents, createClientRequestId(debt.id)).catch(e =>
        console.error("applyPartialPayment: payment failed for", debt.id, e)
      );
    }
  }

  function reset() {
    setDebts([]);
  }

  return (
    <DebtContext.Provider value={{
      debts, currentUserId, addDebt, updateDebtStatus, updateDebtDetails, cancelDebt, addPayment,
      renameDebtPerson,
      markDebtsPaid,
      applyPartialPayment,
      reset,
      isLoading,
    }}>
      {children}
    </DebtContext.Provider>
  );
}

export function useDebts() {
  const ctx = useContext(DebtContext);
  if (!ctx) throw new Error("useDebts must be used within DebtProvider");
  return ctx;
}
