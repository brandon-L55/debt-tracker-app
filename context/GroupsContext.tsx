import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { useDebts } from "./DebtContext";
import type { Group } from "./DebtContext";
import * as groupService from "@/lib/services/groupService";

type GroupsContextType = {
  groups: Group[];
  /** Async: awaiting ensures the group is persisted before navigation. */
  addGroup: (group: Omit<Group, "id" | "createdAt">) => Promise<void>;
  /** Optimistic: local state updates immediately; Supabase syncs in background. */
  updateGroup: (id: string, updates: Partial<Omit<Group, "id" | "createdAt">>) => void;
  /** Optimistic: local state updates immediately; Supabase syncs in background. */
  deleteGroup: (id: string) => void;
  groupOrder: string[];
  /** Optimistic: local order updates immediately; Supabase syncs in background. */
  setGroupOrder: (order: string[]) => void;
  isLoading: boolean;
  groupsError: string | null;
};

const GroupsContext = createContext<GroupsContextType | null>(null);

export function GroupsProvider({ children }: { children: ReactNode }) {
  const { session, isLoading: authLoading } = useAuth();
  // renameDebtPerson keeps local debts in sync when a group member's name changes.
  const { renameDebtPerson } = useDebts();

  const [groups, setGroups] = useState<Group[]>([]);
  const [groupOrder, setGroupOrderState] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState<string | null>(null);

  // Wait for auth to finish resolving before deciding whether to fetch.
  useEffect(() => {
    if (authLoading) return;

    if (!session) {
      setGroups([]);
      setGroupOrderState([]);
      setIsLoading(false);
      return;
    }

    loadGroups();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id, authLoading]);

  async function loadGroups() {
    setIsLoading(true);
    setGroupsError(null);
    try {
      const loaded = await groupService.getGroups();
      setGroups(loaded);
      setGroupOrderState(loaded.map(g => g.id));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load groups";
      setGroupsError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function addGroup(group: Omit<Group, "id" | "createdAt">) {
    if (!session) throw new Error("Not authenticated");
    const sortOrder = groups.length;
    const created = await groupService.createGroup(group, sortOrder);
    setGroups(prev => [...prev, created]);
    setGroupOrderState(prev => [...prev, created.id]);
  }

  function updateGroup(id: string, updates: Partial<Omit<Group, "id" | "createdAt">>) {
    // Sync local debts when a group member's name changes.
    if (updates.members !== undefined) {
      const existing = groups.find(g => g.id === id);
      if (existing) {
        for (const oldMember of existing.members) {
          const newMember = updates.members!.find(m => m.id === oldMember.id);
          if (newMember && newMember.name !== oldMember.name) {
            renameDebtPerson(oldMember.name, newMember.name);
          }
        }
      }
    }
    // Optimistic local update.
    setGroups(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
    // Background Supabase sync.
    groupService.updateGroup(id, updates).catch(e =>
      console.error("Failed to update group:", e)
    );
  }

  function deleteGroup(id: string) {
    setGroups(prev => prev.filter(g => g.id !== id));
    setGroupOrderState(prev => prev.filter(oid => oid !== id));
    groupService.deleteGroup(id).catch(e =>
      console.error("Failed to delete group:", e)
    );
  }

  function setGroupOrder(order: string[]) {
    setGroupOrderState(order);
    groupService.reorderGroups(order).catch(e =>
      console.error("Failed to reorder groups:", e)
    );
  }

  return (
    <GroupsContext.Provider value={{
      groups,
      addGroup,
      updateGroup,
      deleteGroup,
      groupOrder,
      setGroupOrder,
      isLoading,
      groupsError,
    }}>
      {children}
    </GroupsContext.Provider>
  );
}

export function useGroups() {
  const ctx = useContext(GroupsContext);
  if (!ctx) throw new Error("useGroups must be used within GroupsProvider");
  return ctx;
}
