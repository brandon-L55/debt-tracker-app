import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { getDebts, createDebt } from "@/lib/services/debtService";
import type { CreateDebtInput } from "@/lib/services/debtService";

export type Debt = {
  id: string;
  person: string;
  /** Contact id of the counterpart (set by debtService). */
  contactId?: string;
  /** Auth user id of the counterpart when they have a real account. */
  linkedUserId?: string;
  amount: number;
  direction: "them" | "me";
  reason: string;
  status: "pending" | "accepted" | "rejected" | "paid" | "disputed";
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
  addDebt: (debt: Omit<Debt, "id" | "createdAt" | "status"> & { status?: Debt["status"] }) => Promise<void>;
  /** Renames a person string inside all local debts. Called by ContactsContext and GroupsContext when a name changes. */
  renameDebtPerson: (oldName: string, newName: string) => void;
  reset: () => void;
  isLoading: boolean;
};

const DebtContext = createContext<DebtContextType | null>(null);

export function DebtProvider({ children }: { children: ReactNode }) {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDebts() {
      try {
        setIsLoading(true);
        const { debts: loaded } = await getDebts();
        setDebts(loaded);
      } catch (e) {
        console.error("Failed to load debts:", e);
        setDebts([]);
      } finally {
        setIsLoading(false);
      }
    }

    // Load on mount and whenever the auth session changes so direction is
    // always computed relative to the currently signed-in user.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") &&
        session?.user
      ) {
        loadDebts();
      } else if (event === "SIGNED_OUT" || (event === "INITIAL_SESSION" && !session?.user)) {
        setDebts([]);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  function addDebt(input: Omit<Debt, "id" | "createdAt" | "status"> & { status?: Debt["status"] }): Promise<void> {
    const debtInput: CreateDebtInput = {
      person: input.person,
      contactId: input.contactId,
      amount: input.amount,
      direction: input.direction,
      reason: input.reason,
      groupId: input.groupId,
      deadline: input.deadline,
      status: input.status,
    };
    // Returns the promise so callers can await and surface errors (e.g. "No account found").
    return createDebt(debtInput)
      .then(created => { setDebts(prev => [created, ...prev]); });
  }

  function renameDebtPerson(oldName: string, newName: string) {
    setDebts(prev =>
      prev.map(d => d.person === oldName ? { ...d, person: newName } : d)
    );
  }

  function reset() {
    setDebts([]);
  }

  return (
    <DebtContext.Provider value={{
      debts, addDebt,
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
