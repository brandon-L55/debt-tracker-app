import { supabase } from "@/lib/supabase";

export type BlockedUser = {
  blockedUserId: string;
  displayName: string | null;
  username: string | null;
  phone: string | null;
  avatarUrl: string | null;
  blockedAt: string;
};

/**
 * Block a user. Inserts a row into blocked_users where the current
 * authenticated user is the blocker. Idempotent due to the unique
 * constraint on (blocker_user_id, blocked_user_id).
 */
export async function blockUser(blockedUserId: string): Promise<void> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Not authenticated");
  if (user.id === blockedUserId) throw new Error("Cannot block yourself.");

  const { error } = await supabase
    .from("blocked_users")
    .insert({ blocker_user_id: user.id, blocked_user_id: blockedUserId });
  if (error) throw new Error(error.message);
}

/**
 * Unblock a previously blocked user.
 */
export async function unblockUser(blockedUserId: string): Promise<void> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("blocked_users")
    .delete()
    .eq("blocker_user_id", user.id)
    .eq("blocked_user_id", blockedUserId);
  if (error) throw new Error(error.message);
}

/**
 * Check whether the current user has blocked the given user.
 * Returns false on any error (fail open — the UI gate is best-effort;
 * server-side triggers enforce the constraint).
 */
export async function isUserBlocked(blockedUserId: string): Promise<boolean> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return false;

  const { data, error } = await supabase
    .from("blocked_users")
    .select("id")
    .eq("blocker_user_id", user.id)
    .eq("blocked_user_id", blockedUserId)
    .maybeSingle();
  if (error) return false;
  return data !== null;
}

/**
 * Return all users the current user has blocked, with their profile data.
 * Batch-fetches profiles in a single query after loading the blocked_users rows.
 * Falls back gracefully: display_name → username → phone → null for each field.
 */
export async function getBlockedUsers(): Promise<BlockedUser[]> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return [];

  const { data: rows, error } = await supabase
    .from("blocked_users")
    .select("blocked_user_id, created_at")
    .eq("blocker_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !rows || rows.length === 0) return [];

  const blockedRows = rows as { blocked_user_id: string; created_at: string }[];
  const ids = blockedRows.map(r => r.blocked_user_id);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, username, phone, avatar_url")
    .in("id", ids);

  type ProfileRow = {
    id: string;
    display_name: string | null;
    username: string | null;
    phone: string | null;
    avatar_url: string | null;
  };

  const profileMap = new Map<string, ProfileRow>(
    ((profiles ?? []) as ProfileRow[]).map(p => [p.id, p])
  );

  return blockedRows.map(row => {
    const p = profileMap.get(row.blocked_user_id);
    return {
      blockedUserId: row.blocked_user_id,
      displayName: p?.display_name ?? null,
      username: p?.username ?? null,
      phone: p?.phone ?? null,
      avatarUrl: p?.avatar_url ?? null,
      blockedAt: row.created_at,
    };
  });
}

/**
 * Return all user IDs that the current user has blocked.
 */
export async function getBlockedUserIds(): Promise<string[]> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return [];

  const { data, error } = await supabase
    .from("blocked_users")
    .select("blocked_user_id")
    .eq("blocker_user_id", user.id);
  if (error) return [];
  return (data as { blocked_user_id: string }[]).map(r => r.blocked_user_id);
}
