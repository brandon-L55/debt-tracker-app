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
};

export type Individual = {
  id: string;
  name: string;
  nickname: string;
  phoneOrUsername: string;
  notes: string;
  imageUri?: string;
  createdAt: string;
};

const KEYS = {
  debts: "@debt_tracker/debts",
  individuals: "@debt_tracker/individuals",
  groups: "@debt_tracker/groups",
  individualOrder: "@debt_tracker/individual_order",
  groupOrder: "@debt_tracker/group_order",
} as const;

type DebtContextType = {
  debts: Debt[];
  addDebt: (debt: Omit<Debt, "id" | "createdAt" | "status"> & { status?: Debt["status"] }) => void;
  individuals: Individual[];
  addIndividual: (individual: Omit<Individual, "id" | "createdAt">) => void;
  updateIndividual: (id: string, updates: Partial<Omit<Individual, "id" | "createdAt">>) => void;
  groups: Group[];
  addGroup: (group: Omit<Group, "id" | "createdAt">) => void;
  updateGroup: (id: string, updates: Partial<Omit<Group, "id" | "createdAt">>) => void;
  individualOrder: string[];
  setIndividualOrder: (order: string[]) => void;
  groupOrder: string[];
  setGroupOrder: (order: string[]) => void;
  reset: () => void;
  isLoading: boolean;
};

const DebtContext = createContext<DebtContextType | null>(null);

function uid() {
  return Math.random().toString(36).slice(2);
}

export function DebtProvider({ children }: { children: ReactNode }) {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [individuals, setIndividuals] = useState<Individual[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [individualOrder, setIndividualOrder] = useState<string[]>([]);
  const [groupOrder, setGroupOrder] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [debtsJson, individualsJson, groupsJson, indOrderJson, grpOrderJson] = await Promise.all([
          AsyncStorage.getItem(KEYS.debts),
          AsyncStorage.getItem(KEYS.individuals),
          AsyncStorage.getItem(KEYS.groups),
          AsyncStorage.getItem(KEYS.individualOrder),
          AsyncStorage.getItem(KEYS.groupOrder),
        ]);
        if (debtsJson) setDebts(JSON.parse(debtsJson));
        if (individualsJson) setIndividuals(JSON.parse(individualsJson));
        if (groupsJson) setGroups(JSON.parse(groupsJson));
        if (indOrderJson) setIndividualOrder(JSON.parse(indOrderJson));
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
    AsyncStorage.setItem(KEYS.individuals, JSON.stringify(individuals)).catch(console.error);
  }, [individuals, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    AsyncStorage.setItem(KEYS.groups, JSON.stringify(groups)).catch(console.error);
  }, [groups, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    AsyncStorage.setItem(KEYS.individualOrder, JSON.stringify(individualOrder)).catch(console.error);
  }, [individualOrder, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    AsyncStorage.setItem(KEYS.groupOrder, JSON.stringify(groupOrder)).catch(console.error);
  }, [groupOrder, isLoading]);

  function addDebt(debt: Omit<Debt, "id" | "createdAt" | "status"> & { status?: Debt["status"] }) {
    setDebts(prev => [
      { ...debt, status: debt.status ?? "pending", id: uid(), createdAt: new Date().toISOString() },
      ...prev,
    ]);
    // Auto-create individual if they don't already exist.
    // Their ID is appended to individualOrder via reconciliation in the Individuals tab.
    setIndividuals(prev => {
      const exists = prev.some(
        ind => ind.name === debt.person || ind.phoneOrUsername === debt.person
      );
      if (exists) return prev;
      return [
        { id: uid(), name: debt.person, nickname: "", phoneOrUsername: "", notes: "", createdAt: new Date().toISOString() },
        ...prev,
      ];
    });
  }

  function addIndividual(individual: Omit<Individual, "id" | "createdAt">) {
    const newId = uid();
    setIndividuals(prev => [
      { ...individual, id: newId, createdAt: new Date().toISOString() },
      ...prev,
    ]);
    setIndividualOrder(prev => [...prev, newId]);
  }

  function updateIndividual(id: string, updates: Partial<Omit<Individual, "id" | "createdAt">>) {
    if (updates.name !== undefined) {
      const existing = individuals.find(ind => ind.id === id);
      if (existing && updates.name !== existing.name) {
        const oldName = existing.name;
        const newName = updates.name;
        setDebts(prev =>
          prev.map(d => d.person === oldName ? { ...d, person: newName } : d)
        );
      }
    }
    setIndividuals(prev =>
      prev.map(ind => ind.id === id ? { ...ind, ...updates } : ind)
    );
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
    setIndividuals([]);
    setGroups([]);
    setIndividualOrder([]);
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
      individuals, addIndividual, updateIndividual,
      groups, addGroup, updateGroup,
      individualOrder, setIndividualOrder,
      groupOrder, setGroupOrder,
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
