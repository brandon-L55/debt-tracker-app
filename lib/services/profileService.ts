import { supabase } from "@/lib/supabase";

export type ProfileRow = {
  id: string;
  display_name: string | null;
  phone: string | null;
  username: string | null;
  avatar_url: string | null;
  venmo_handle: string | null;
  cashapp_handle: string | null;
  paypal_handle: string | null;
};

const SELECT_FIELDS =
  "id, display_name, phone, username, avatar_url, venmo_handle, cashapp_handle, paypal_handle";

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(SELECT_FIELDS)
    .eq("id", userId)
    .single();

  if (error) {
    console.warn("[WARN] getProfile:", error.message);
    return null;
  }
  return data as ProfileRow;
}

export async function upsertProfile(
  userId: string,
  patch: Partial<Omit<ProfileRow, "id">>
): Promise<string | null> {
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, ...patch }, { onConflict: "id" });

  if (error) {
    // Translate unique-constraint violations (PostgreSQL code 23505) into
    // readable messages instead of exposing raw constraint names.
    if (error.code === "23505") {
      const msg = error.message.toLowerCase();
      if (msg.includes("username")) {
        return "That username is already taken. Please choose another.";
      }
      if (msg.includes("phone")) {
        return "That phone number is linked to another account.";
      }
      return "That value is already used by another account.";
    }
    return error.message;
  }
  return null;
}

/**
 * Returns true if the given username is not currently taken by anyone.
 *
 * Uses check_signup_availability (SECURITY DEFINER) so RLS on the profiles
 * table does not block the lookup — the client can only read its own row.
 *
 * Pass the username already lower-cased; the RPC also lower-cases internally.
 */
export async function isUsernameAvailable(usernameLower: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_signup_availability", {
    p_phone: null,
    p_username: usernameLower,
    p_email: null,
  });
  // On network/RPC error be permissive — the DB unique constraint is the hard stop.
  if (error) return true;
  return data !== "USERNAME_TAKEN";
}
