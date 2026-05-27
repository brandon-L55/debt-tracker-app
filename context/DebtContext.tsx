import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export type Debt = {
  id: string;
  person: string;
  amount: number;
  direction: "them" | "me";
  reason: string;
  status: "pending" | "accepted" | "rejected" | "paid" | "disputed" | "partially_paid";
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

const KEYS = {
  debts: "@debt_tracker/debts",
} as const;

type DebtContextType = {
  debts: Debt[];
  addDebt: (debt: Omit<Debt, "id" | "createdAt" | "status"> & { status?: Debt["status"] }) => void;
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

function uid() {
  return Math.random().toString(36).slice(2);
}

export function DebtProvider({ children }: { children: ReactNode }) {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const debtsJson = await AsyncStorage.getItem(KEYS.debts);
        if (debtsJson) setDebts(JSON.parse(debtsJson));
      } catch (e) {
        console.error("Failed to load stored data:", e);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    AsyncStorage.setItem(KEYS.debts, JSON.stringify(debts)).catch(console.error);
  }, [debts, isLoading]);

  function addDebt(debt: Omit<Debt, "id" | "createdAt" | "status"> & { status?: Debt["status"] }) {
    setDebts(prev => [
      { ...debt, status: debt.status ?? "pending", id: uid(), createdAt: new Date().toISOString() },
      ...prev,
    ]);
  }

  function renameDebtPerson(oldName: string, newName: string) {
    setDebts(prev =>
      prev.map(d => d.person === oldName ? { ...d, person: newName } : d)
    );
  }

  function markDebtsPaid(ids: string[]) {
    const idSet = new Set(ids);
    setDebts(prev => prev.map(d => idSet.has(d.id) ? { ...d, status: "paid" } : d));
  }

  function applyPartialPayment(personName: string, amount: number) {
    setDebts(prev => {
      const activeOwed = prev
        .filter(d => d.person === personName && d.direction === "me" && d.status !== "paid" && d.status !== "rejected")
        .sort((a, b) => a.amount - b.amount);

      let remaining = amount;
      const paidIds = new Set<string>();
      const partialUpdates = new Map<string, number>();

      for (const debt of activeOwed) {
        if (remaining <= 0) break;
        if (remaining >= debt.amount) {
          paidIds.add(debt.id);
          remaining -= debt.amount;
        } else {
          partialUpdates.set(debt.id, parseFloat((debt.amount - remaining).toFixed(2)));
          remaining = 0;
        }
      }

      // TODO: preserve payment history record when history feature is implemented
      return prev.map(d => {
        if (paidIds.has(d.id)) return { ...d, status: "paid" };
        if (partialUpdates.has(d.id)) return { ...d, amount: partialUpdates.get(d.id)!, status: "partially_paid" as const };
        return d;
      });
    });
  }

  function reset() {
    setDebts([]);
  }

  return (
    <DebtContext.Provider value={{
      debts, addDebt,
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
