import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { useDebts } from "./DebtContext";
import { useContacts } from "./ContactsContext";
import type { Group } from "./DebtContext";
import * as groupService from "@/lib/services/groupService";
import { supabase } from "@/lib/supabase";

type GroupsContextType = {
  groups: Group[];
  /** Async: awaiting ensures the group is persisted before navigation. */
  addGroup: (group: Omit<Group, "id" | "createdAt">) => Promise<void>;
  /** Optimistic: local state updates immediately; Supabase syncs in background. */
  updateGroup: (id: string, updates: Partial<Omit<Group, "id" | "createdAt">>) => void;
  /** Converts all debts in the group to individual debts, then deletes the group. */
  deleteGroup: (id: string) => Promise<void>;
  /** Removes a member from a group and converts their group debts to individual debts. */
  removeMemberFromGroup: (groupId: string, memberId: string) => Promise<void>;
  groupOrder: string[];
  /** Optimistic: local order updates immediately; Supabase syncs in background. */
  setGroupOrder: (order: string[]) => void;
  isLoading: boolean;
  groupsError: string | null;
};

const GroupsContext = createContext<GroupsContextType | null>(null);

export function GroupsProvider({ children }: { children: ReactNode }) {
  const { session, isLoading: authLoading } = useAuth();
  const { renameDebtPerson, ungroupDebts } = useDebts();
  // addCachedIndividuals surfaces auto-created contacts in the Individuals tab immediately.
  // Requires ContactsProvider to wrap GroupsProvider in the component tree.
  const { addCachedIndividuals } = useContacts();

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

  // Realtime: reload groups whenever a group the user owns or a group_members
  // row for this user changes (insert/update/delete).
  useEffect(() => {
    if (!session) return;

    const uid = session.user.id;
    const channel = supabase
      .channel(`groups-sync:${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "groups", filter: `owner_id=eq.${uid}` },
        () => { loadGroups(); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members", filter: `user_id=eq.${uid}` },
        () => { loadGroups(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

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
    const { group: created, newContacts } = await groupService.createGroup(group, sortOrder);
    addCachedIndividuals(newContacts);
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
    // Background Supabase sync; surface any auto-created contacts immediately.
    groupService.updateGroup(id, updates).then(newContacts => {
      addCachedIndividuals(newContacts);
    }).catch(e =>
      console.error("Failed to update group:", e)
    );
  }

  async function deleteGroup(id: string): Promise<void> {
    // Optimistic: remove group from local state immediately.
    const originalGroups = groups;
    const originalOrder = groupOrder;
    setGroups(prev => prev.filter(g => g.id !== id));
    setGroupOrderState(prev => prev.filter(oid => oid !== id));
    try {
      const ungroupedIds = await groupService.deleteGroup(id);
      ungroupDebts(ungroupedIds);
    } catch (e) {
      setGroups(originalGroups);
      setGroupOrderState(originalOrder);
      throw e;
    }
  }

  async function removeMemberFromGroup(groupId: string, memberId: string): Promise<void> {
    const originalGroups = groups;
    // Optimistic: remove the member from local groups state immediately.
    setGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, members: g.members.filter(m => m.id !== memberId) } : g
    ));
    try {
      const ungroupedIds = await groupService.removeMemberFromGroup(groupId, memberId);
      // Clear groupId on affected debts so they drop off the group view immediately.
      ungroupDebts(ungroupedIds);
    } catch (e) {
      // Rollback on failure.
      setGroups(originalGroups);
      throw e;
    }
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
      removeMemberFromGroup,
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
