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
  createdAt: string;
};

export type Individual = {
  id: string;
  name: string;
  nickname: string;
  phoneOrUsername: string;
  notes: string;
  createdAt: string;
};

const KEYS = {
  debts: "@debt_tracker/debts",
  individuals: "@debt_tracker/individuals",
  groups: "@debt_tracker/groups",
} as const;

type DebtContextType = {
  debts: Debt[];
  addDebt: (debt: Omit<Debt, "id" | "createdAt" | "status"> & { status?: Debt["status"] }) => void;
  individuals: Individual[];
  addIndividual: (individual: Omit<Individual, "id" | "createdAt">) => void;
  groups: Group[];
  addGroup: (group: Omit<Group, "id" | "createdAt">) => void;
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
  const [isLoading, setIsLoading] = useState(true);

  // Hydrate from storage on mount
  useEffect(() => {
    async function load() {
      try {
        const [debtsJson, individualsJson, groupsJson] = await Promise.all([
          AsyncStorage.getItem(KEYS.debts),
          AsyncStorage.getItem(KEYS.individuals),
          AsyncStorage.getItem(KEYS.groups),
        ]);
        if (debtsJson) setDebts(JSON.parse(debtsJson));
        if (individualsJson) setIndividuals(JSON.parse(individualsJson));
        if (groupsJson) setGroups(JSON.parse(groupsJson));
      } catch (e) {
        console.error("Failed to load stored data:", e);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  // Persist debts whenever they change (skip during initial load)
  useEffect(() => {
    if (isLoading) return;
    AsyncStorage.setItem(KEYS.debts, JSON.stringify(debts)).catch(console.error);
  }, [debts, isLoading]);

  // Persist individuals whenever they change
  useEffect(() => {
    if (isLoading) return;
    AsyncStorage.setItem(KEYS.individuals, JSON.stringify(individuals)).catch(console.error);
  }, [individuals, isLoading]);

  // Persist groups whenever they change
  useEffect(() => {
    if (isLoading) return;
    AsyncStorage.setItem(KEYS.groups, JSON.stringify(groups)).catch(console.error);
  }, [groups, isLoading]);

  function addDebt(debt: Omit<Debt, "id" | "createdAt" | "status"> & { status?: Debt["status"] }) {
    setDebts(prev => [
      {
        ...debt,
        status: debt.status ?? "pending",
        id: uid(),
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    // Auto-create an Individual entry if one doesn't already exist for this person.
    setIndividuals(prev => {
      const exists = prev.some(
        ind => ind.name === debt.person || ind.phoneOrUsername === debt.person
      );
      if (exists) return prev;
      return [
        {
          id: uid(),
          name: debt.person,
          nickname: "",
          phoneOrUsername: "",
          notes: "",
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ];
    });
  }

  function addIndividual(individual: Omit<Individual, "id" | "createdAt">) {
    setIndividuals(prev => [
      { ...individual, id: uid(), createdAt: new Date().toISOString() },
      ...prev,
    ]);
  }

  function addGroup(group: Omit<Group, "id" | "createdAt">) {
    setGroups(prev => [
      { ...group, id: uid(), createdAt: new Date().toISOString() },
      ...prev,
    ]);
  }

  return (
    <DebtContext.Provider value={{ debts, addDebt, individuals, addIndividual, groups, addGroup, isLoading }}>
      {children}
    </DebtContext.Provider>
  );
}

export function useDebts() {
  const ctx = useContext(DebtContext);
  if (!ctx) throw new Error("useDebts must be used within DebtProvider");
  return ctx;
}
