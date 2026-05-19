import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

export type Debt = {
  id: string;
  person: string;
  amount: number;
  direction: "them" | "me";
  reason: string;
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

type DebtContextType = {
  debts: Debt[];
  addDebt: (debt: Omit<Debt, "id" | "createdAt">) => void;
  individuals: Individual[];
  addIndividual: (individual: Omit<Individual, "id" | "createdAt">) => void;
  groups: Group[];
  addGroup: (group: Omit<Group, "id" | "createdAt">) => void;
};

const DebtContext = createContext<DebtContextType | null>(null);

export function DebtProvider({ children }: { children: ReactNode }) {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [individuals, setIndividuals] = useState<Individual[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  function addDebt(debt: Omit<Debt, "id" | "createdAt">) {
    setDebts(prev => [
      {
        ...debt,
        id: Math.random().toString(36).slice(2),
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  }

  function addIndividual(individual: Omit<Individual, "id" | "createdAt">) {
    setIndividuals(prev => [
      {
        ...individual,
        id: Math.random().toString(36).slice(2),
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  }

  function addGroup(group: Omit<Group, "id" | "createdAt">) {
    setGroups(prev => [
      {
        ...group,
        id: Math.random().toString(36).slice(2),
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  }

  return (
    <DebtContext.Provider value={{ debts, addDebt, individuals, addIndividual, groups, addGroup }}>
      {children}
    </DebtContext.Provider>
  );
}

export function useDebts() {
  const ctx = useContext(DebtContext);
  if (!ctx) throw new Error("useDebts must be used within DebtProvider");
  return ctx;
}
