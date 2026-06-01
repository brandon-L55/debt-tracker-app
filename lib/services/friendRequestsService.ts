import { supabase } from "@/lib/supabase";
import type { Individual } from "@/context/DebtContext";
import { createLinkedContact } from "./contactsService";

// ── Types ────────────────────────────────────────────────────

export type FriendRequestStatus = "pending" | "accepted" | "rejected";

export type FriendRequest = {
  id: string;
  senderUserId: string;
  recipientUserId: string;
  status: FriendRequestStatus;
  createdAt: string;
  /** Present on incoming requests — the sender's public profile fields. */
  senderProfile?: {
    displayName: string | null;
    username: string | null;
    phone: string | null;
    avatarUrl: string | null;
  };
  /** Present on outgoing requests — the recipient's public profile fields. */
  recipientProfile?: {
    displayName: string | null;
    username: string | null;
    phone: string | null;
    avatarUrl: string | null;
  };
};

type FriendRequestRow = {
  id: string;
  sender_user_id: string;
  recipient_user_id: string;
  status: FriendRequestStatus;
  created_at: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  phone: string | null;
  avatar_url: string | null;
};

function rowToRequest(row: FriendRequestRow): FriendRequest {
  return {
    id: row.id,
    senderUserId: row.sender_user_id,
    recipientUserId: row.recipient_user_id,
    status: row.status,
    createdAt: row.created_at,
  };
}

// ── Write operations ─────────────────────────────────────────

/**
 * Create a pending friend request from the current user to recipientUserId.
 * Idempotent: if any request already exists between the two users (in either
 * direction and any status), does nothing.
 */
export async function createFriendRequest(recipientUserId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id === recipientUserId) return;

  const { data: existing } = await supabase
    .from("friend_requests")
    .select("id")
    .or(
      `and(sender_user_id.eq.${user.id},recipient_user_id.eq.${recipientUserId}),` +
      `and(sender_user_id.eq.${recipientUserId},recipient_user_id.eq.${user.id})`
    )
    .maybeSingle();

  if (existing) return;

  const { error } = await supabase.from("friend_requests").insert({
    sender_user_id: user.id,
    recipient_user_id: recipientUserId,
    status: "pending",
  });
  // 23505 = unique_violation: ignore race-condition duplicates
  if (error && (error as { code?: string }).code !== "23505") {
    console.warn("[WARN] createFriendRequest:", error.message);
  }
}

/**
 * Accept an incoming friend request by id.
 * Creates a contact entry for the sender in the current user's contact list.
 * Returns the newly created Individual, or null if profile fetch fails.
 */
export async function acceptFriendRequest(requestId: string): Promise<Individual | null> {
  // Fetch request to know the sender
  const { data: reqRow, error: reqErr } = await supabase
    .from("friend_requests")
    .select("sender_user_id")
    .eq("id", requestId)
    .single();
  if (reqErr || !reqRow) throw new Error("Friend request not found");

  const senderUserId = (reqRow as { sender_user_id: string }).sender_user_id;

  // Update status to accepted
  const { error: updateErr } = await supabase
    .from("friend_requests")
    .update({ status: "accepted" })
    .eq("id", requestId);
  if (updateErr) throw new Error(updateErr.message);

  // Fetch sender's profile to create a contact entry
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, username, phone, avatar_url")
    .eq("id", senderUserId)
    .single();

  if (!profile) return null;
  const p = profile as ProfileRow;
  const name = p.display_name || p.username || p.phone || "Unknown";

  try {
    const { contact } = await createLinkedContact(
      {
        name,
        linkedUserId: senderUserId,
        username: p.username ?? undefined,
        phone: p.phone ?? undefined,
        avatarUrl: p.avatar_url ?? undefined,
      },
      9999,
    );
    return contact;
  } catch (e) {
    console.warn("[WARN] acceptFriendRequest: contact creation failed:", e);
    return null;
  }
}

/**
 * Reject an incoming friend request (sets status to 'rejected').
 */
export async function rejectFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from("friend_requests")
    .update({ status: "rejected" })
    .eq("id", requestId);
  if (error) throw new Error(error.message);
}

/**
 * Cancel an outgoing friend request (deletes the row, allowing re-sending later).
 */
export async function cancelFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from("friend_requests")
    .delete()
    .eq("id", requestId);
  if (error) throw new Error(error.message);
}

// ── Read operations ──────────────────────────────────────────

/**
 * Get all incoming pending friend requests for the current user,
 * enriched with the sender's profile.
 */
export async function getIncomingFriendRequests(): Promise<FriendRequest[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("friend_requests")
    .select("*")
    .eq("recipient_user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  const requests = ((data ?? []) as FriendRequestRow[]).map(rowToRequest);
  if (requests.length === 0) return requests;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, username, phone, avatar_url")
    .in("id", requests.map(r => r.senderUserId));

  const profileMap = new Map(((profiles ?? []) as ProfileRow[]).map(p => [p.id, p]));
  return requests.map(r => {
    const p = profileMap.get(r.senderUserId);
    return {
      ...r,
      senderProfile: p
        ? { displayName: p.display_name, username: p.username, phone: p.phone, avatarUrl: p.avatar_url }
        : undefined,
    };
  });
}

/**
 * Get all outgoing pending friend requests for the current user,
 * enriched with the recipient's profile.
 */
export async function getOutgoingFriendRequests(): Promise<FriendRequest[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("friend_requests")
    .select("*")
    .eq("sender_user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  const requests = ((data ?? []) as FriendRequestRow[]).map(rowToRequest);
  if (requests.length === 0) return requests;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, username, phone, avatar_url")
    .in("id", requests.map(r => r.recipientUserId));

  const profileMap = new Map(((profiles ?? []) as ProfileRow[]).map(p => [p.id, p]));
  return requests.map(r => {
    const p = profileMap.get(r.recipientUserId);
    return {
      ...r,
      recipientProfile: p
        ? { displayName: p.display_name, username: p.username, phone: p.phone, avatarUrl: p.avatar_url }
        : undefined,
    };
  });
}

/**
 * Returns true if the current user already has a pending debt they created
 * where linkedUserId is the counterpart. Used to block duplicate debt requests
 * to unadded users — does not depend on whether a friend request row exists.
 */
export async function hasPendingDebtTo(linkedUserId: string): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return false;
  const uid = session.user.id;

  const { data } = await supabase
    .from("debts")
    .select("id")
    .eq("status", "pending")
    .eq("creator_id", uid)
    .or(`borrower_user_id.eq.${linkedUserId},payer_user_id.eq.${linkedUserId}`)
    .maybeSingle();

  return !!data;
}
