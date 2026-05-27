import { supabase } from "@/lib/supabase";
import type { Group, GroupMember, Individual } from "@/context/DebtContext";
import { normalizePhone } from "@/lib/phoneUtils";
import { findOrCreateContact } from "./contactsService";

// ─── Row shapes returned by Supabase ─────────────────────────

type GroupRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  pinned: boolean;
  silenced: boolean;
  created_at: string;
  updated_at: string;
};

type GroupMemberRow = {
  id: string;
  group_id: string;
  user_id: string | null;
  contact_id: string | null;
  display_name: string | null;
  phone_or_username: string | null;
  role: string;
  joined_at: string;
};

// ─── Converters ───────────────────────────────────────────────

function rowToGroupMember(row: GroupMemberRow): GroupMember {
  return {
    id: row.id,
    name: row.display_name ?? "",
    phoneOrUsername: row.phone_or_username ?? "",
    contactId: row.contact_id ?? undefined,
  };
}

/**
 * Find or create a contact for a group member.
 * Phone → normalized match; username → exact match; empty → null.
 * Returns the Individual so callers can collect newly created contacts.
 */
async function resolveContact(name: string, phoneOrUsername: string): Promise<Individual | null> {
  const val = phoneOrUsername.trim();
  if (!val) return null;
  try {
    return await findOrCreateContact(name, val);
  } catch (e) {
    console.error("[groupService] Could not link member to contact:", e);
    return null;
  }
}

function rowToGroup(row: GroupRow, members: GroupMember[]): Group {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    imageUri: row.image_url ?? undefined,
    members,
    createdAt: row.created_at,
    pinned: row.pinned ?? false,
    silenced: row.silenced ?? false,
  };
}

// ─── Service functions ────────────────────────────────────────

/**
 * Fetch all groups (with their members) for the current user,
 * ordered by sort_order ascending.
 */
export async function getGroups(): Promise<Group[]> {
  const { data, error } = await supabase
    .from("groups")
    .select("*, group_members(*)")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);

  return (data as (GroupRow & { group_members: GroupMemberRow[] })[]).map(row => {
    const members = (row.group_members ?? []).map(rowToGroupMember);
    return rowToGroup(row, members);
  });
}

/**
 * Fetch a single group by id (with members). Returns null if not found.
 */
export async function getGroupById(id: string): Promise<Group | null> {
  const { data, error } = await supabase
    .from("groups")
    .select("*, group_members(*)")
    .eq("id", id)
    .single();
  if (error) return null;

  const row = data as GroupRow & { group_members: GroupMemberRow[] };
  const members = (row.group_members ?? []).map(rowToGroupMember);
  return rowToGroup(row, members);
}

/**
 * Create a new group (and its members) in Supabase.
 * Returns the full Group with server-generated id and created_at.
 */
export async function createGroup(
  group: Omit<Group, "id" | "createdAt">,
  sortOrder: number
): Promise<{ group: Group; newContacts: Individual[] }> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Must be logged in to create groups.");

  const payload = {
    owner_id: user.id,
    name: group.name,
    description: group.description || null,
    image_url: group.imageUri || null,
    sort_order: sortOrder,
    pinned: group.pinned ?? false,
    silenced: group.silenced ?? false,
  };
  // TODO: remove once RLS issue is confirmed resolved
  if (__DEV__) {
    console.log("AUTH USER:", user.id);
    console.log("GROUP INSERT PAYLOAD:", payload);
  }

  const { data: groupData, error: groupError } = await supabase
    .from("groups")
    .insert(payload)
    .select()
    .single();

  if (groupError) {
    console.error("CREATE GROUP ERROR:", JSON.stringify(groupError, null, 2));
    throw new Error(groupError.message ?? "Failed to create group");
  }

  const groupRow = groupData as GroupRow;

  // 2. Insert members (if any), linking each to a contact by phone/username.
  let members: GroupMember[] = [];
  const newContacts: Individual[] = [];

  if (group.members.length > 0) {
    const resolved = await Promise.all(
      group.members.map(m => resolveContact(m.name, m.phoneOrUsername))
    );
    newContacts.push(...(resolved.filter(Boolean) as Individual[]));

    const memberInserts = group.members.map((m, i) => ({
      group_id: groupRow.id,
      display_name: m.name,
      phone_or_username: normalizePhone(m.phoneOrUsername || "") || null,
      contact_id: resolved[i]?.id ?? null,
      role: "member",
    }));
    const { data: memberData, error: memberError } = await supabase
      .from("group_members")
      .insert(memberInserts)
      .select();
    if (memberError) {
      console.error("CREATE GROUP MEMBERS ERROR:", JSON.stringify(memberError, null, 2));
    } else {
      members = (memberData as GroupMemberRow[]).map(rowToGroupMember);
    }
  }

  return { group: rowToGroup(groupRow, members), newContacts };
}

/**
 * Patch group fields. If `updates.members` is provided, all existing
 * members are replaced with the new list (delete-then-insert).
 */
export async function updateGroup(
  id: string,
  updates: Partial<Omit<Group, "id" | "createdAt">>
): Promise<Individual[]> {
  const newContacts: Individual[] = [];

  const patch: Record<string, unknown> = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.description !== undefined) patch.description = updates.description || null;
  if (updates.imageUri !== undefined) patch.image_url = updates.imageUri || null;
  if (updates.pinned !== undefined) patch.pinned = updates.pinned;
  if (updates.silenced !== undefined) patch.silenced = updates.silenced;

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from("groups").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
  }

  if (updates.members !== undefined) {
    const { error: delError } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", id);
    if (delError) throw new Error(delError.message);

    if (updates.members.length > 0) {
      const resolved = await Promise.all(
        updates.members.map(m => resolveContact(m.name, m.phoneOrUsername))
      );
      newContacts.push(...(resolved.filter(Boolean) as Individual[]));

      const memberInserts = updates.members.map((m, i) => ({
        group_id: id,
        display_name: m.name,
        phone_or_username: normalizePhone(m.phoneOrUsername || "") || null,
        contact_id: resolved[i]?.id ?? null,
        role: "member",
      }));
      const { error: insError } = await supabase
        .from("group_members")
        .insert(memberInserts);
      if (insError) throw new Error(insError.message);
    }
  }

  return newContacts;
}

/**
 * Delete a group by id. group_members are cascade-deleted by the DB.
 */
export async function deleteGroup(id: string): Promise<void> {
  const { error } = await supabase.from("groups").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Update sort_order for a list of groups given their new ordered IDs.
 */
export async function reorderGroups(orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return;
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("groups").update({ sort_order: index }).eq("id", id)
    )
  );
  const firstError = results.find(r => r.error)?.error;
  if (firstError) throw new Error(firstError.message);
}
