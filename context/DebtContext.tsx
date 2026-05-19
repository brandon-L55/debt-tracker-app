import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

export type Debt = {
  id: string;
  person: string;
  amount: number;
  direction: "them" | "me";
  reason: string;
  createdAt: string;
};

type DebtContextType = {
  debts: Debt[];
  addDebt: (debt: Omit<Debt, "id" | "createdAt">) => void;
};

const DebtContext = createContext<DebtContextType | null>(null);

export function DebtProvider({ children }: { children: ReactNode }) {
  const [debts, setDebts] = useState<Debt[]>([]);

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

  return (
    <DebtContext.Provider value={{ debts, addDebt }}>
      {children}
    </DebtContext.Provider>
  );
}

export function useDebts() {
  const ctx = useContext(DebtContext);
  if (!ctx) throw new Error("useDebts must be used within DebtProvider");
  return ctx;
}
