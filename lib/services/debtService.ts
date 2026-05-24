import { supabase } from "@/lib/supabase";
import type { Debt } from "@/context/DebtContext";
import { isPhoneNumber } from "@/lib/phoneUtils";
import { findOrCreateContact, findOrCreateContactByEmail } from "./contactsService";

// ─── Row shape returned by Supabase (with joined contacts) ─────

type DebtRow = {
  id: string;
  creator_id: string;
  payer_user_id: string | null;
  payer_contact_id: string | null;
  borrower_user_id: string | null;
  borrower_contact_id: string | null;
  group_id: string | null;
  amount_cents: number;
  paid_cents: number;
  description: string | null;
  status: string;
  due_date: string | null;
  created_at: string;
  payer_contact: { id: string; name: string } | null;
  borrower_contact: { id: string; name: string } | null;
};

// Internal type used while building the return value — _otherUserId is
// stripped before the Debt array is handed back to callers.
type DebtWithMeta = Debt & { _otherUserId?: string };

// Both FK columns reference the same contacts table, so PostgREST needs
// the constraint name as a disambiguation hint.
const SELECT_FIELDS =
  "*, payer_contact:contacts!debts_payer_contact_id_fkey(id,name), borrower_contact:contacts!debts_borrower_contact_id_fkey(id,name)";

// ─── Helpers ──────────────────────────────────────────────────

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

// ─── Converter ────────────────────────────────────────────────

function rowToDebt(row: DebtRow, currentUserId: string): DebtWithMeta {
  // Determine direction from the current user's role in this debt.
  // Check linked user_id fields first so cross-account direction is always
  // computed relative to the authenticated viewer, not the original creator.
  const direction: "me" | "them" =
    row.borrower_user_id === currentUserId
      ? "me"          // viewer is the borrower  → they owe
      : row.payer_user_id === currentUserId
      ? "them"        // viewer is the payer/lender → they are owed
      : "them";       // non-linked creator-owned debt: viewer is the lender

  // The "person" is whoever is on the opposite side from the current user.
  const contactRecord =
    direction === "me" ? row.payer_contact : row.borrower_contact;

  // The user_id of the counterpart — used for cross-account linking and
  // as a fallback to fill the person name from profiles when no contact exists.
  const otherUserId =
    direction === "me" ? row.payer_user_id : row.borrower_user_id;

  const paidCents = row.paid_cents ?? 0;
  return {
    id: row.id,
    creatorId: row.creator_id,
    person: contactRecord?.name ?? "",
    contactId: contactRecord?.id,
    linkedUserId: otherUserId ?? undefined,
    amount: row.amount_cents / 100,
    remainingAmount: (row.amount_cents - paidCents) / 100,
    totalPaidAmount: direction === "me" ? paidCents / 100 : 0,
    totalReceivedAmount: direction === "them" ? paidCents / 100 : 0,
    direction,
    reason: row.description ?? "",
    status: row.status as Debt["status"],
    createdAt: row.created_at,
    groupId: row.group_id ?? undefined,
    deadline: row.due_date ?? null,
    // Tag debts whose person name is missing so getDebts can batch-fill them.
    _otherUserId:
      !contactRecord && !!otherUserId && otherUserId !== currentUserId
        ? otherUserId
        : undefined,
  };
}

/**
 * For any converted debt that has no person name but knows the counterpart's
 * user_id, fetch their display email from the profiles table and fill it in.
 * This covers the case where Account B views a debt created by Account A
 * and A never set a contact on their own side.
 */
async function fillMissingPersonNames(debts: DebtWithMeta[]): Promise<void> {
  const missingIds = [
    ...new Set(
      debts
        .filter((d) => !d.person && d._otherUserId)
        .map((d) => d._otherUserId!),
    ),
  ];
  if (missingIds.length === 0) return;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,email")
    .in("id", missingIds);

  if (!profiles) return;
  const map = new Map(
    (profiles as { id: string; email: string }[]).map((p) => [p.id, p.email]),
  );
  debts.forEach((d) => {
    if (!d.person && d._otherUserId) {
      d.person = map.get(d._otherUserId) ?? d._otherUserId;
    }
  });
}

function stripMeta(debts: DebtWithMeta[]): Debt[] {
  return debts.map(({ _otherUserId: _omit, ...d }) => d);
}

// ─── Person resolution ────────────────────────────────────────

/**
 * Resolve a typed person string to { contactId, linkedUserId }.
 * - Email  → find/create contact by email; link to real profile if one exists.
 * - Phone / @username → find/create contact by phone/username (no profile link).
 * - Plain name → create new contact (no dedup by name per spec).
 */
async function resolvePersonForDebt(personInput: string): Promise<{
  contactId: string;
  linkedUserId: string | null;
}> {
  const trimmed = personInput.trim();
  if (isEmail(trimmed)) {
    const contact = await findOrCreateContactByEmail(trimmed.toLowerCase());
    return {
      contactId: contact.id,
      linkedUserId: contact.linkedUserId ?? null,
    };
  }

  const isPhoneOrUsername =
    isPhoneNumber(trimmed) || trimmed.startsWith("@");
  const phoneOrUsername = isPhoneOrUsername ? trimmed : "";

  // For plain-name input, check if the existing contact stores a valid email
  // in their username field and route through the email path for profile linking.
  // This covers the case where the user added "brij" by name but previously saved
  // their email (e.g. chhabrabrij@gmail.com) in the username/phone field.
  if (!phoneOrUsername) {
    type ContactLookup = { id: string; username: string | null; linked_user_id: string | null };
    const { data: byName } = await supabase
      .from("contacts")
      .select("id, username, linked_user_id")
      .ilike("name", trimmed)
      .maybeSingle();
    const found = byName as ContactLookup | null;
    const storedEmail = found?.username?.trim().toLowerCase() ?? "";
    if (isEmail(storedEmail)) {
      const contact = await findOrCreateContactByEmail(storedEmail, trimmed);
      return { contactId: contact.id, linkedUserId: contact.linkedUserId ?? null };
    }
  }

  const contact = await findOrCreateContact(trimmed, phoneOrUsername);
  return { contactId: contact.id, linkedUserId: null };
}

// ─── Service functions ────────────────────────────────────────

/**
 * Fetch all debts visible to the current user, ordered by newest first.
 * Explicitly filters by creator_id, payer_user_id, and borrower_user_id so
 * Account B sees debts created by Account A where B is the linked borrower.
 */
export async function getDebts(): Promise<{ debts: Debt[]; userId: string }> {
  // Use getSession() (reads local cache) instead of getUser() (network round-trip)
  // so this never throws "Not authenticated" during the initial session restore.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Not authenticated");

  const uid = session.user.id;
  const { data, error } = await supabase
    .from("debts")
    .select(SELECT_FIELDS)
    .or(
      `creator_id.eq.${uid},payer_user_id.eq.${uid},borrower_user_id.eq.${uid}`,
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rawDebts = (data as DebtRow[]).map((row) => rowToDebt(row, uid));
  await fillMissingPersonNames(rawDebts);

  return { debts: stripMeta(rawDebts), userId: uid };
}

/**
 * Fetch all debts for a specific group.
 */
export async function getDebtsForGroup(groupId: string): Promise<Debt[]> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("debts")
    .select(SELECT_FIELDS)
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  const rawDebts = (data as DebtRow[]).map((row) => rowToDebt(row, user.id));
  await fillMissingPersonNames(rawDebts);
  return stripMeta(rawDebts);
}

/**
 * Fetch all debts linked to a specific contact (as payer or borrower).
 */
export async function getDebtsForContact(contactId: string): Promise<Debt[]> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("debts")
    .select(SELECT_FIELDS)
    .or(
      `payer_contact_id.eq.${contactId},borrower_contact_id.eq.${contactId}`,
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  const rawDebts = (data as DebtRow[]).map((row) => rowToDebt(row, user.id));
  await fillMissingPersonNames(rawDebts);
  return stripMeta(rawDebts);
}

export type CreateDebtInput = {
  person: string;
  /** Pre-resolved contact id. When omitted the person string is resolved automatically. */
  contactId?: string;
  amount: number;
  direction: "them" | "me";
  reason: string;
  groupId?: string;
  deadline?: string | null;
  status?: Debt["status"];
};

/**
 * Resolves a person input string to a contact id (kept for backward compat).
 */
export async function resolvePersonToContactId(
  personInput: string,
): Promise<string> {
  const { contactId } = await resolvePersonForDebt(personInput);
  return contactId;
}

/**
 * Create a single debt row in Supabase.
 *
 * Direction mapping:
 *   "them" (they owe me) → current user is lender (payer_user_id);
 *                          other party is borrower_contact_id (+ borrower_user_id if profile found).
 *   "me"   (I owe them)  → current user is borrower (borrower_user_id);
 *                          other party is payer_contact_id (+ payer_user_id if profile found).
 *
 * Setting borrower_user_id / payer_user_id for the counterpart is what
 * allows Account B to see the debt via the getDebts() OR filter.
 */
export async function createDebt(input: CreateDebtInput): Promise<Debt> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Not authenticated");

  let contactId: string;
  let linkedUserId: string | null = null;

  if (input.contactId) {
    contactId = input.contactId;
    // Still resolve linked_user_id from the pre-existing contact so that
    // cross-account visibility (borrower_user_id / payer_user_id) is set.
    const { data: contactRow } = await supabase
      .from("contacts")
      .select("linked_user_id")
      .eq("id", contactId)
      .maybeSingle();
    linkedUserId = (contactRow as { linked_user_id: string | null } | null)
      ?.linked_user_id ?? null;
  } else {
    const resolved = await resolvePersonForDebt(input.person);
    contactId = resolved.contactId;
    linkedUserId = resolved.linkedUserId;
  }

  const payload: Record<string, unknown> = {
    creator_id: user.id,
    amount_cents: Math.round(input.amount * 100),
    description: input.reason || null,
    status: input.status ?? "pending",
    due_date: input.deadline ?? null,
    group_id: input.groupId ?? null,
  };

  if (input.direction === "them") {
    // Current user is the lender; other party is the borrower.
    payload.payer_user_id = user.id;
    payload.borrower_contact_id = contactId;
    if (linkedUserId) payload.borrower_user_id = linkedUserId;
  } else {
    // Current user is the borrower; other party is the lender.
    payload.borrower_user_id = user.id;
    payload.payer_contact_id = contactId;
    if (linkedUserId) payload.payer_user_id = linkedUserId;
  }

  const { data, error } = await supabase
    .from("debts")
    .insert(payload)
    .select(SELECT_FIELDS)
    .single();

  if (error) {
    console.error("CREATE DEBT ERROR:", JSON.stringify(error, null, 2));
    throw new Error(error.message ?? "Failed to create debt");
  }

  // Create a mirror contact in the recipient's address book so their
  // Individuals tab shows the sender.  Fire-and-forget: non-critical.
  if (linkedUserId && user.email) {
    supabase
      .rpc("create_mirror_contact", {
        p_recipient_user_id: linkedUserId,
        p_creator_email: user.email.trim().toLowerCase(),
      })
      .then(({ error: rpcErr }) => {
        if (rpcErr) console.warn("[WARN] mirror contact RPC:", rpcErr.message);
      });
  }

  const debt = rowToDebt(data as DebtRow, user.id);
  await fillMissingPersonNames([debt]);
  const { _otherUserId: _omit, ...result } = debt;
  return result;
}

/**
 * Create multiple debts in parallel (e.g. split-fee across selected people).
 */
export async function createManyDebts(
  inputs: CreateDebtInput[],
): Promise<Debt[]> {
  return Promise.all(inputs.map(createDebt));
}

/**
 * Update the status of a debt (e.g. pending → paid).
 */
export async function updateDebtStatus(
  id: string,
  status: Debt["status"],
): Promise<void> {
  const { error } = await supabase
    .from("debts")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Delete a debt by id (creator-only, enforced by RLS).
 */
export async function deleteDebt(id: string): Promise<void> {
  const { error } = await supabase.from("debts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Record a payment against an accepted or partial debt.
 * The DB trigger (trg_after_payment_insert) automatically updates
 * debts.paid_cents and debts.status (partial / paid).
 */
export async function createPayment(
  debtId: string,
  amountCents: number,
  clientRequestId: string,
  note?: string,
): Promise<"inserted" | "duplicate"> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Not authenticated");

  const { error } = await supabase.from("payments").insert({
    debt_id: debtId,
    payer_user_id: user.id,
    amount_cents: amountCents,
    client_request_id: clientRequestId,
    note: note ?? null,
  });
  if ((error as { code?: string } | null)?.code === "23505") return "duplicate";
  if (error) throw new Error(error.message);
  return "inserted";
}
