import { supabase } from "@/lib/supabase";

export type Nudge = {
  id: string;
  senderUserId: string;
  recipientUserId: string;
  contactId: string | null;
  amountCents: number;
  message: string;
  read: boolean;
  createdAt: string;
};

/**
 * Send an in-app nudge from the current user to recipientUserId.
 * Inserts a debt_nudges row that the recipient can read.
 */
export async function sendNudge({
  recipientUserId,
  contactId,
  amountCents,
  displayName,
  groupId,
  groupName,
}: {
  recipientUserId: string;
  contactId: string;
  amountCents: number;
  /** Display name of the recipient — used only for the log message. */
  displayName: string;
  /** Optional: group this nudge is associated with. */
  groupId?: string;
  groupName?: string;
}): Promise<void> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Not authenticated");
  if (user.id === recipientUserId) throw new Error("Cannot nudge yourself.");

  const { data: senderProfile } = await supabase
    .from("profiles")
    .select("display_name, username, phone")
    .eq("id", user.id)
    .single();

  const sp = senderProfile as { display_name: string | null; username: string | null; phone: string | null } | null;
  const senderName = sp?.display_name || sp?.username || sp?.phone || "Someone";
  const amountFormatted = (amountCents / 100).toFixed(2);
  const message = groupName
    ? `${senderName} reminded you to pay $${amountFormatted} for ${groupName}.`
    : `${senderName} reminded you to pay $${amountFormatted}.`;

  const { data: nudgeRow, error } = await supabase
    .from("debt_nudges")
    .insert({
      sender_user_id: user.id,
      recipient_user_id: recipientUserId,
      contact_id: contactId,
      amount_cents: amountCents,
      message,
      ...(groupId ? { group_id: groupId } : {}),
      ...(groupName ? { group_name: groupName } : {}),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // Dispatch server-side push notification (fire-and-forget; never blocks the nudge)
  if (nudgeRow?.id) {
    supabase.functions
      .invoke("send-nudge-notification", { body: { nudge_id: nudgeRow.id } })
      .catch((err) => {
        if (__DEV__) console.warn("[Nudge] push dispatch error:", err);
      });
  }

  if (__DEV__) {
    const ctx = groupName ? ` [${groupName}]` : "";
    console.log(`[Nudge] → ${recipientUserId} (${displayName}), $${amountFormatted}${ctx}: success`);
  }
}

/**
 * Fetch all unread nudges sent to the current user, newest first.
 */
export async function getUnreadNudges(): Promise<Nudge[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("debt_nudges")
    .select("*")
    .eq("recipient_user_id", user.id)
    .eq("read", false)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as {
    id: string;
    sender_user_id: string;
    recipient_user_id: string;
    contact_id: string | null;
    amount_cents: number;
    message: string;
    read: boolean;
    created_at: string;
  }[]).map(r => ({
    id: r.id,
    senderUserId: r.sender_user_id,
    recipientUserId: r.recipient_user_id,
    contactId: r.contact_id,
    amountCents: r.amount_cents,
    message: r.message,
    read: r.read,
    createdAt: r.created_at,
  }));
}

/**
 * Mark a nudge as read.
 */
export async function markNudgeRead(nudgeId: string): Promise<void> {
  const { error } = await supabase
    .from("debt_nudges")
    .update({ read: true })
    .eq("id", nudgeId);
  if (error) throw new Error(error.message);
}
