import { supabase } from "@/lib/supabase";

export type DebtCancellingPref = {
  introSeen: boolean;
  enabled: boolean;
};

/**
 * Fetch the current user's Debt Cancelling preference for a group.
 * Returns null if no row exists yet (treated as introSeen=false, enabled=false).
 */
export async function getDebtCancellingPref(
  groupId: string
): Promise<DebtCancellingPref | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("group_debt_cancelling_preferences")
    .select("intro_seen, enabled")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return { introSeen: data.intro_seen, enabled: data.enabled };
}

/**
 * Create or update the current user's Debt Cancelling preference for a group.
 * Only the provided fields are changed; omitted fields keep their existing values.
 */
export async function upsertDebtCancellingPref(
  groupId: string,
  updates: Partial<{ introSeen: boolean; enabled: boolean }>
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const row: Record<string, unknown> = {
    group_id: groupId,
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };
  if (updates.introSeen !== undefined) row.intro_seen = updates.introSeen;
  if (updates.enabled !== undefined) row.enabled = updates.enabled;

  const { error } = await supabase
    .from("group_debt_cancelling_preferences")
    .upsert(row, { onConflict: "group_id,user_id" });

  if (error) throw new Error(error.message);
}
