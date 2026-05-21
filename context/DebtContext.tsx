import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export type Debt = {
  id: string;
  person: string;
  amount: number;
  direction: "them" | "me";
  reason: string;
  status: "pending" | "accepted" | "rejected" | "paid" | "disputed";
  createdAt: string;
  groupId?: string;
  deadline?: string | null;
};

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
  groups: "@debt_tracker/groups",
  groupOrder: "@debt_tracker/group_order",
} as const;

type DebtContextType = {
  debts: Debt[];
  addDebt: (debt: Omit<Debt, "id" | "createdAt" | "status"> & { status?: Debt["status"] }) => void;
  groups: Group[];
  addGroup: (group: Omit<Group, "id" | "createdAt">) => void;
  updateGroup: (id: string, updates: Partial<Omit<Group, "id" | "createdAt">>) => void;
  deleteGroup: (id: string) => void;
  groupOrder: string[];
  setGroupOrder: (order: string[]) => void;
  /** Renames a person string inside all local debts. Called by ContactsContext when an individual's name changes. */
  renameDebtPerson: (oldName: string, newName: string) => void;
  reset: () => void;
  isLoading: boolean;
};

const DebtContext = createContext<DebtContextType | null>(null);

function uid() {
  return Math.random().toString(36).slice(2);
}

export function DebtProvider({ children }: { children: ReactNode }) {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupOrder, setGroupOrder] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [debtsJson, groupsJson, grpOrderJson] = await Promise.all([
          AsyncStorage.getItem(KEYS.debts),
          AsyncStorage.getItem(KEYS.groups),
          AsyncStorage.getItem(KEYS.groupOrder),
        ]);
        if (debtsJson) setDebts(JSON.parse(debtsJson));
        if (groupsJson) setGroups(JSON.parse(groupsJson));
        if (grpOrderJson) setGroupOrder(JSON.parse(grpOrderJson));
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

  useEffect(() => {
    if (isLoading) return;
    AsyncStorage.setItem(KEYS.groups, JSON.stringify(groups)).catch(console.error);
  }, [groups, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    AsyncStorage.setItem(KEYS.groupOrder, JSON.stringify(groupOrder)).catch(console.error);
  }, [groupOrder, isLoading]);

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

  function deleteGroup(id: string) {
    setGroups(prev => prev.filter(g => g.id !== id));
    setGroupOrder(prev => prev.filter(oid => oid !== id));
  }

  function addGroup(group: Omit<Group, "id" | "createdAt">) {
    const newId = uid();
    setGroups(prev => [
      { ...group, id: newId, createdAt: new Date().toISOString() },
      ...prev,
    ]);
    setGroupOrder(prev => [...prev, newId]);
  }

  function reset() {
    setDebts([]);
    setGroups([]);
    setGroupOrder([]);
  }

  function updateGroup(id: string, updates: Partial<Omit<Group, "id" | "createdAt">>) {
    if (updates.members !== undefined) {
      const existing = groups.find(g => g.id === id);
      if (existing) {
        for (const oldMember of existing.members) {
          const newMember = updates.members!.find(m => m.id === oldMember.id);
          if (newMember && newMember.name !== oldMember.name) {
            const oldName = oldMember.name;
            const newName = newMember.name;
            setDebts(prev =>
              prev.map(d =>
                d.person === oldName && d.groupId === id ? { ...d, person: newName } : d
              )
            );
          }
        }
      }
    }
    setGroups(prev =>
      prev.map(g => g.id === id ? { ...g, ...updates } : g)
    );
  }

  return (
    <DebtContext.Provider value={{
      debts, addDebt,
      groups, addGroup, updateGroup, deleteGroup,
      groupOrder, setGroupOrder,
      renameDebtPerson,
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
