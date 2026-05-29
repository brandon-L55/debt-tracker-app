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

  if (error) return error.message;
  return null;
}
