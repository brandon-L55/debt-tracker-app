import { supabase } from "@/lib/supabase";
import type { Individual } from "@/context/DebtContext";
import { normalizePhone, isPhoneNumber } from "@/lib/phoneUtils";

// Shape of a row returned from the contacts table.
type ContactRow = {
  id: string;
  owner_id: string;
  name: string;
  nickname: string | null;
  username: string | null;
  notes: string | null;
  avatar_url: string | null;
  sort_order: number;
  pinned: boolean;
  silenced: boolean;
  created_at: string;
  linked_user_id: string | null;
  // Columns from the base schema (not used by app yet, kept for completeness)
  phone: string | null;
  email: string | null;
  venmo_handle: string | null;
  cashapp_handle: string | null;
  paypal_handle: string | null;
};

function rowToIndividual(row: ContactRow): Individual {
  return {
    id: row.id,
    name: row.name,
    nickname: row.nickname ?? "",
    phoneOrUsername: row.username ?? "",
    notes: row.notes ?? "",
    imageUri: row.avatar_url ?? undefined,
    createdAt: row.created_at,
    pinned: row.pinned ?? false,
    silenced: row.silenced ?? false,
  };
}

/**
 * Fetch all contacts for the current authenticated user,
 * ordered by sort_order ascending.
 */
export async function getContacts(): Promise<Individual[]> {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data as ContactRow[]).map(rowToIndividual);
}

/**
 * Insert a new contact row.
 * owner_id is resolved from the authenticated session — the caller never sets it.
 * Returns the created Individual (with server-generated id and created_at).
 */
export async function createContact(
  individual: Omit<Individual, "id" | "createdAt">,
  sortOrder: number
): Promise<Individual> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      owner_id: user.id,
      name: individual.name,
      nickname: individual.nickname || null,
      username: individual.phoneOrUsername || null,
      notes: individual.notes || null,
      avatar_url: individual.imageUri || null,
      sort_order: sortOrder,
      pinned: individual.pinned ?? false,
      silenced: individual.silenced ?? false,
    })
    .select()
    .single();
  if (error) {
    console.error("CREATE CONTACT ERROR:", JSON.stringify(error, null, 2));
    throw new Error(error.message ?? "Supabase insert failed");
  }
  return rowToIndividual(data as ContactRow);
}

/**
 * Patch an existing contact row. Only provided fields are updated.
 */
export async function updateContact(
  id: string,
  updates: Partial<Omit<Individual, "id" | "createdAt">>
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.nickname !== undefined) patch.nickname = updates.nickname || null;
  if (updates.phoneOrUsername !== undefined) patch.username = updates.phoneOrUsername || null;
  if (updates.notes !== undefined) patch.notes = updates.notes || null;
  if (updates.imageUri !== undefined) patch.avatar_url = updates.imageUri || null;
  if (updates.pinned !== undefined) patch.pinned = updates.pinned;
  if (updates.silenced !== undefined) patch.silenced = updates.silenced;
  const { error } = await supabase.from("contacts").update(patch).eq("id", id);
  if (error) throw error;
}

/**
 * Delete a contact row by id.
 */
export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Find or create a contact by phone (primary) or exact username (fallback).
 * - Phone values are normalized before matching (strips spaces/dashes/parens).
 * - Username values are matched exactly as entered.
 * Never duplicates: if a contact with the same phone/username exists, reuse it.
 */
export async function findOrCreateContact(
  name: string,
  phoneOrUsername: string,
  sortOrder = 9999,
): Promise<Individual> {
  const val = phoneOrUsername.trim();
  const stored = isPhoneNumber(val) ? normalizePhone(val) : val;

  if (stored) {
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("username", stored)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return rowToIndividual(data as ContactRow);
  }

  return createContact(
    { name, nickname: "", phoneOrUsername: stored, notes: "", pinned: false, silenced: false },
    sortOrder,
  );
}

/**
 * Find or create a contact by email.
 * - Normalises the email to trim().toLowerCase() before every comparison.
 * - If the owner already has a contact with that email, returns it.
 * - Looks up public.profiles by email to resolve a real linked_user_id.
 * - Creates the contact (with linked_user_id when found) and returns it.
 *
 * Returns { id, linkedUserId } — enough for debtService to set
 * borrower_user_id / payer_user_id on the debt row.
 */
export async function findOrCreateContactByEmail(
  email: string,
  displayName?: string,
): Promise<{ id: string; linkedUserId: string | null }> {
  const normalizedEmail = email.trim().toLowerCase();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Not authenticated");

  // 1. Return existing contact for this owner + email (idempotent).
  const { data: existing } = await supabase
    .from("contacts")
    .select("id, linked_user_id")
    .eq("owner_id", user.id)
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existing) {
    const row = existing as { id: string; linked_user_id: string | null };
    if (row.linked_user_id) {
      return { id: row.id, linkedUserId: row.linked_user_id };
    }
    // Existing contact has no linked_user_id — look up profile and backfill.
    const { data: profileEx, error: profileExErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();
    const profileId = (profileEx as { id: string } | null)?.id ?? null;
    console.log("[DEBUG] findOrCreateContactByEmail (existing) — normalizedEmail:", normalizedEmail,
      "profileData:", profileEx, "profileError:", profileExErr?.message ?? null,
      "linkedUserId:", profileId);
    if (!profileId) {
      const { data: allP } = await supabase.from("profiles").select("id, email").limit(20);
      console.log("[DEBUG] All profile emails in table:", JSON.stringify(allP));
      throw new Error("No account found for this email");
    }
    await supabase
      .from("contacts")
      .update({ linked_user_id: profileId })
      .eq("id", row.id);
    return { id: row.id, linkedUserId: profileId };
  }

  // 2. Look up profiles by email to get real user_id.
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  const linkedUserId = (profile as { id: string } | null)?.id ?? null;
  console.log("[DEBUG] findOrCreateContactByEmail (new) — normalizedEmail:", normalizedEmail,
    "profileData:", profile, "profileError:", profileErr?.message ?? null,
    "linkedUserId:", linkedUserId);
  if (!linkedUserId) {
    const { data: allP } = await supabase.from("profiles").select("id, email").limit(20);
    console.log("[DEBUG] All profile emails in table:", JSON.stringify(allP));
    throw new Error("No account found for this email");
  }

  // 3. Create the contact; use displayName if provided, else the email itself.
  const name = displayName?.trim() || normalizedEmail;

  const { data: created, error: insertError } = await supabase
    .from("contacts")
    .insert({
      owner_id: user.id,
      name,
      email: normalizedEmail,
      linked_user_id: linkedUserId,
      sort_order: 9999,
      pinned: false,
      silenced: false,
    })
    .select("id, linked_user_id")
    .single();

  if (insertError) throw new Error(insertError.message);

  const newRow = created as { id: string; linked_user_id: string | null };
  return { id: newRow.id, linkedUserId: newRow.linked_user_id ?? null };
}

/**
 * Update sort_order for a list of contacts given their new ordered IDs.
 * Runs updates in parallel — one per contact.
 */
export async function reorderContacts(orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return;
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("contacts").update({ sort_order: index }).eq("id", id)
    )
  );
  const firstError = results.find(r => r.error)?.error;
  if (firstError) throw firstError;
}
