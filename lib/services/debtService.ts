import { supabase } from "@/lib/supabase";
import type { Debt } from "@/context/DebtContext";
import { isPhoneNumber } from "@/lib/phoneUtils";
import { findOrCreateContact, findOrCreateContactByEmail } from "./contactsService";
import type { RawGroupDebt } from "@/lib/utils/simplifyGroupDebts";

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
  manually_paid: boolean | null;
  pre_paid_status: string | null;
  pre_paid_remaining_cents: number | null;
  paid_at: string | null;
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
  // paid_cents is a single shared counter on the debt row, incremented by the
  // after_payment_insert trigger regardless of who is viewing the debt.
  //
  // totalPaidAmount and totalReceivedAmount are DIRECTION-RELATIVE views of
  // that same counter:
  //   • borrower (direction="me")   → totalPaidAmount   = paidCents/100, totalReceivedAmount = 0
  //   • lender   (direction="them") → totalReceivedAmount = paidCents/100, totalPaidAmount   = 0
  //
  // The dashboard sums these correctly: each user's "Total Paid" is the sum of
  // totalPaidAmount across their debts; "Total Received" is the sum of
  // totalReceivedAmount.  Neither field double-counts.
  //
  // For payment-progress UI on debt cards, prefer:
  //   paidSoFar = debt.amount - debt.remainingAmount   (direction-neutral)
  // This is what debt/[id].tsx already uses.
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
    manuallyPaid: row.manually_paid ?? false,
    prePaidStatus: (row.pre_paid_status as Debt["status"]) ?? undefined,
    prePaidRemainingAmount:
      row.pre_paid_remaining_cents != null ? row.pre_paid_remaining_cents / 100 : undefined,
    paidAt: row.paid_at ?? null,
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
 * - Plain name → look up existing contacts by name first (prefer linked over
 *   unlinked); only creates a new contact if none are found.
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

  // For plain-name input, look up existing contacts by name.
  // Linked contacts (linked_user_id != null) take priority over unlinked ones.
  // If a match is found, use it directly — never create a duplicate.
  if (!phoneOrUsername) {
    type ContactLookup = { id: string; username: string | null; linked_user_id: string | null };
    const { data: byName } = await supabase
      .from("contacts")
      .select("id, username, linked_user_id")
      .ilike("name", trimmed);

    const matches = ((byName ?? []) as ContactLookup[]);
    // Prefer linked contact; fall back to first match
    const found = matches.find(c => c.linked_user_id) ?? matches[0] ?? null;

    if (found) {
      const storedEmail = found.username?.trim().toLowerCase() ?? "";
      if (isEmail(storedEmail)) {
        // Route through email path so invite/claim status stays current.
        const contact = await findOrCreateContactByEmail(storedEmail, trimmed);
        return { contactId: contact.id, linkedUserId: contact.linkedUserId ?? null };
      }
      // Use the existing contact as-is — no new row created.
      return { contactId: found.id, linkedUserId: found.linked_user_id ?? null };
    }
  }

  const contact = await findOrCreateContact(trimmed, phoneOrUsername);
  return { contactId: contact.id, linkedUserId: null };
}

// ─── Shared resolution helper ─────────────────────────────────

/**
 * Resolve a single CreateDebtInput to the concrete ids and cents needed for
 * a debts INSERT.  Used by both createDebt and createGroupDebts so the lookup
 * logic stays in one place.
 */
async function resolveDebtInputDetails(input: CreateDebtInput): Promise<{
  contactId: string;
  linkedUserId: string | null;
  amountCents: number;
  status: string;
  clientRequestId: string;
}> {
  let contactId: string;
  let linkedUserId: string | null = null;

  if (input.contactId) {
    contactId = input.contactId;
    const { data: contactRow } = await supabase
      .from("contacts")
      .select("linked_user_id")
      .eq("id", contactId)
      .maybeSingle();
    linkedUserId =
      (contactRow as { linked_user_id: string | null } | null)?.linked_user_id ?? null;
  } else {
    const resolved = await resolvePersonForDebt(input.person);
    contactId = resolved.contactId;
    linkedUserId = resolved.linkedUserId;
  }

  return {
    contactId,
    linkedUserId,
    amountCents: Math.round(input.amount * 100),
    status: input.status ?? "pending",
    clientRequestId: input.clientRequestId ?? createDebtClientRequestId(),
  };
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
  clientRequestId?: string;
};

export type UpdateDebtDetailsInput = {
  amount?: number;
  reason?: string;
  deadline?: string | null;
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

function createDebtClientRequestId() {
  return `debt:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

async function getDebtByClientRequestId(
  clientRequestId: string,
  currentUserId: string,
): Promise<Debt> {
  const { data, error } = await supabase
    .from("debts")
    .select(SELECT_FIELDS)
    .eq("client_request_id", clientRequestId)
    .single();

  if (error) throw new Error(error.message);

  const debt = rowToDebt(data as DebtRow, currentUserId);
  await fillMissingPersonNames([debt]);
  const { _otherUserId: _omit, ...result } = debt;
  return result;
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

  const { contactId, linkedUserId, clientRequestId } = await resolveDebtInputDetails(input);
  const payload: Record<string, unknown> = {
    creator_id: user.id,
    client_request_id: clientRequestId,
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

  if ((error as { code?: string } | null)?.code === "23505") {
    return getDebtByClientRequestId(clientRequestId, user.id);
  }
  if (error) {
    console.error("CREATE DEBT ERROR:", JSON.stringify(error, null, 2));
    throw new Error(error.message ?? "Failed to create debt");
  }

  // Create a mirror contact in the recipient's address book so their
  // Individuals tab shows the sender.  Non-critical: debt is already saved.
  // The RPC is idempotent (checks for existing contact before inserting).
  if (linkedUserId && user.email) {
    const debtId = (data as DebtRow).id;
    const mirrorEmail = user.email.trim().toLowerCase();
    const callMirrorRpc = () =>
      supabase.rpc("create_mirror_contact", {
        p_recipient_user_id: linkedUserId,
        p_creator_email: mirrorEmail,
      });
    try {
      const { error: rpcErr } = await callMirrorRpc();
      if (rpcErr) throw rpcErr;
    } catch (firstErr: unknown) {
      // One retry after a short delay before giving up.
      await new Promise(r => setTimeout(r, 1500));
      try {
        const { error: retryErr } = await callMirrorRpc();
        if (retryErr) throw retryErr;
      } catch (finalErr: unknown) {
        console.warn(
          "[mirror contact] failed after retry — recipient may not see sender in Individuals tab.",
          {
            debtId,
            creatorId: user.id,
            recipientId: linkedUserId,
            error: (finalErr as { message?: string })?.message ?? finalErr,
          }
        );
      }
    }
  }

  // Create a pending friend request if these users are not already friends.
  // Fire-and-forget: non-critical — debt was already saved successfully.
  if (linkedUserId && user.id !== linkedUserId) {
    (async () => {
      const { data: existing } = await supabase
        .from("friend_requests")
        .select("id")
        .or(
          `and(sender_user_id.eq.${user.id},recipient_user_id.eq.${linkedUserId}),` +
          `and(sender_user_id.eq.${linkedUserId},recipient_user_id.eq.${user.id})`
        )
        .maybeSingle();
      if (!existing) {
        const { error: frErr } = await supabase.from("friend_requests").insert({
          sender_user_id: user.id,
          recipient_user_id: linkedUserId,
          status: "pending",
        });
        if (frErr && (frErr as { code?: string }).code !== "23505") {
          console.warn("[WARN] friend request insert:", frErr.message);
        }
      }
    })();
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
  return Promise.all(inputs.map((input) => createDebt({
    ...input,
    clientRequestId: input.clientRequestId ?? createDebtClientRequestId(),
  })));
}

/**
 * Create all per-member debt rows for a group expense in a single atomic
 * Supabase RPC transaction.  If any row fails, the whole operation rolls back
 * and no partial state is written to the database.
 *
 * All inputs must share the same groupId, reason, deadline, and direction
 * (they describe one group debt split across multiple people).
 */
export async function createGroupDebts(inputs: CreateDebtInput[]): Promise<Debt[]> {
  if (inputs.length === 0) return [];

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Not authenticated");

  // Resolve every member's contact + linked user id before the transaction.
  // Contact creation is idempotent; only the debt INSERTs must be atomic.
  const resolved = await Promise.all(inputs.map(resolveDebtInputDetails));

  const first = inputs[0];
  const debtParams = resolved.map(r => ({
    contact_id: r.contactId,
    linked_user_id: r.linkedUserId,
    amount_cents: r.amountCents,
    status: r.status,
    client_request_id: r.clientRequestId,
  }));

  const { data, error } = await supabase.rpc("create_group_debts", {
    p_group_id: first.groupId ?? null,
    p_description: first.reason || null,
    p_due_date: first.deadline ?? null,
    p_direction: first.direction,
    p_debts: debtParams,
  });

  if (error) throw new Error(error.message ?? "Failed to create group debts");

  const ids: string[] = (data as { ids: string[] }).ids;

  const { data: rows, error: fetchError } = await supabase
    .from("debts")
    .select(SELECT_FIELDS)
    .in("id", ids);

  if (fetchError) throw new Error(fetchError.message);

  const rawDebts = (rows as DebtRow[]).map(row => rowToDebt(row, user.id));
  await fillMissingPersonNames(rawDebts);
  return stripMeta(rawDebts);
}

/**
 * Update the status of a debt (e.g. pending → paid).
 * When accepting a debt, also accepts the matching pending friend request
 * from the debt creator → current user (if one exists).
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

  if (status === "accepted") {
    // Accept the friend request that was auto-created when the debt was sent.
    // Fire-and-forget: non-critical — the debt status was already updated.
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const uid = session.user.id;

      const { data: debtRow } = await supabase
        .from("debts")
        .select("creator_id")
        .eq("id", id)
        .single();
      if (!debtRow) return;

      const creatorId = (debtRow as { creator_id: string }).creator_id;
      if (creatorId === uid) return;

      // Accept pending request from debt creator → current user
      const { error: frErr } = await supabase
        .from("friend_requests")
        .update({ status: "accepted" })
        .eq("sender_user_id", creatorId)
        .eq("recipient_user_id", uid)
        .eq("status", "pending");
      if (frErr) console.warn("[WARN] friend request accept on debt:", frErr.message);
    })();
  }
}

export async function updateDebtDetails(
  id: string,
  updates: UpdateDebtDetailsInput,
): Promise<Debt> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Not authenticated");

  const payload: Record<string, unknown> = {};
  if (updates.amount !== undefined) payload.amount_cents = Math.round(updates.amount * 100);
  if (updates.reason !== undefined) payload.description = updates.reason || null;
  if (updates.deadline !== undefined) payload.due_date = updates.deadline || null;

  const { data, error } = await supabase
    .from("debts")
    .update(payload)
    .eq("id", id)
    .eq("creator_id", user.id)
    .eq("status", "pending")
    .select(SELECT_FIELDS)
    .single();

  if (error) throw new Error(error.message);

  const debt = rowToDebt(data as DebtRow, user.id);
  await fillMissingPersonNames([debt]);
  const { _otherUserId: _omit, ...result } = debt;
  return result;
}

export async function cancelDebt(id: string): Promise<void> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("debts")
    .update({ status: "rejected" })
    .eq("id", id)
    .eq("creator_id", user.id)
    .eq("status", "pending")
    .select("id");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Debt could not be cancelled — it may have already been accepted or cancelled.");
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

  const { data: debt, error: debtError } = await supabase
    .from("debts")
    .select("borrower_user_id,status")
    .eq("id", debtId)
    .single();
  if (debtError) throw new Error(debtError.message);
  if (!debt || debt.borrower_user_id !== user.id) {
    throw new Error("Only the debtor can make payments.");
  }
  if (debt.status !== "accepted" && debt.status !== "partial") {
    throw new Error("Payments are only allowed on accepted or partial debts.");
  }

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

/**
 * Mark a debt as paid without inserting a payment record (offline / cash payment).
 *
 * WHY NO PAYMENT ROW:
 * The payments table is append-only — there is no DELETE RLS policy and no
 * delete trigger.  undoManualPaid() restores paid_cents by writing directly to
 * the debts row.  If a payment row were inserted here, undo would need to
 * DELETE it to keep sum(payments.amount_cents) consistent with paid_cents.
 * Since that delete is not possible under the current schema, we intentionally
 * skip the payment row and set paid_cents directly.  The trade-off is that
 * manually-paid debts have no payment history entry — this is by design.
 *
 * The manuallyPaid flag on the Debt object lets the UI display "Marked paid
 * manually" so users know the difference.
 *
 * Stores the pre-paid state so the action can be undone via undoManualPaid().
 */
export async function markDebtManuallyPaid(debtId: string): Promise<void> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Not authenticated");

  const { data: row, error: fetchErr } = await supabase
    .from("debts")
    .select("amount_cents, paid_cents, status")
    .eq("id", debtId)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);

  const r = row as { amount_cents: number; paid_cents: number; status: string };
  const prePaidRemainingCents = r.amount_cents - (r.paid_cents ?? 0);

  const { error } = await supabase
    .from("debts")
    .update({
      status: "paid",
      paid_cents: r.amount_cents,
      manually_paid: true,
      pre_paid_status: r.status,
      pre_paid_remaining_cents: prePaidRemainingCents,
      paid_at: new Date().toISOString(),
    })
    .eq("id", debtId);

  if (error) throw new Error(error.message);
}

/**
 * Undo a manual "mark paid" — restores the debt to its pre-paid state.
 */
export async function undoManualPaid(debtId: string): Promise<void> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Not authenticated");

  const { data: row, error: fetchErr } = await supabase
    .from("debts")
    .select("amount_cents, pre_paid_status, pre_paid_remaining_cents")
    .eq("id", debtId)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);

  const r = row as {
    amount_cents: number;
    pre_paid_status: string | null;
    pre_paid_remaining_cents: number | null;
  };
  if (!r.pre_paid_status) throw new Error("No undo data available for this debt.");

  const restoredPaidCents = r.amount_cents - (r.pre_paid_remaining_cents ?? 0);

  const { error } = await supabase
    .from("debts")
    .update({
      status: r.pre_paid_status,
      paid_cents: restoredPaidCents,
      manually_paid: false,
      pre_paid_status: null,
      pre_paid_remaining_cents: null,
      paid_at: null,
    })
    .eq("id", debtId);

  if (error) throw new Error(error.message);
}

// ─── Types for group simplification ──────────────────────────

type GroupDebtSimplifyRow = {
  payer_user_id: string | null;
  payer_contact_id: string | null;
  borrower_user_id: string | null;
  borrower_contact_id: string | null;
  amount_cents: number;
  paid_cents: number | null;
  status: string;
};

type GroupMemberNameRow = {
  user_id: string | null;
  contact_id: string | null;
  display_name: string | null;
};

export type SimplificationResult = {
  rawDebts: RawGroupDebt[];
  /**
   * True when at least one active approved debt was skipped because either the
   * payer or borrower has not opted into Debt Cancelling for this group.
   * Used to show the "some debts excluded" banner in the UI.
   */
  hasExcludedDebts: boolean;
};

/**
 * Fetch approved debts for a group and return only those where both parties
 * have opted into Debt Cancelling, as absolute payer/borrower label pairs
 * for use by simplifyGroupDebts().
 *
 * Filtering rules:
 *  - Only "accepted" and "partial" debts are included (pending = not yet approved).
 *  - Both payer and borrower must be real app users (have a user_id).
 *  - Both must have enabled = true in group_debt_cancelling_preferences.
 *  - Debts involving manual contacts are always excluded (contacts cannot opt in).
 *
 * RLS notes:
 *  - "debts: participant select" allows group members to read all group debts
 *    via the is_group_member() SECURITY DEFINER helper.
 *  - "debt_cancelling_prefs: group member select" (migration 20260606000001)
 *    allows any group member to read preferences for their group so the opt-in
 *    set can be built from all members, not just the current user.
 *  - "group_members: group member select" lets any member read the member list.
 */
export async function getGroupDebtsForSimplification(
  groupId: string,
  currentUserId: string,
  currentUserLabel = "You",
): Promise<SimplificationResult> {
  // 1. Fetch group members to build id → display_name lookups.
  const { data: members, error: membersError } = await supabase
    .from("group_members")
    .select("user_id, contact_id, display_name")
    .eq("group_id", groupId);
  if (membersError) throw new Error(membersError.message);

  const userIdToName = new Map<string, string>();
  const contactIdToName = new Map<string, string>();
  for (const m of (members ?? []) as GroupMemberNameRow[]) {
    const name = m.display_name ?? "";
    if (m.user_id) userIdToName.set(m.user_id, name);
    if (m.contact_id) contactIdToName.set(m.contact_id, name);
  }

  // 2. Fetch the set of user IDs who have opted into Debt Cancelling for this group.
  //    The "group member select" RLS policy lets any member read all rows here.
  const { data: prefs, error: prefsError } = await supabase
    .from("group_debt_cancelling_preferences")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("enabled", true);
  if (prefsError) throw new Error(prefsError.message);

  const optedInUserIds = new Set<string>(
    (prefs ?? []).map((p: { user_id: string }) => p.user_id),
  );

  // 3. Fetch approved debts only — pending debts are not yet agreed upon.
  const { data: rows, error: debtsError } = await supabase
    .from("debts")
    .select("payer_user_id, payer_contact_id, borrower_user_id, borrower_contact_id, amount_cents, paid_cents, status")
    .eq("group_id", groupId)
    .in("status", ["accepted", "partial"]);
  if (debtsError) throw new Error(debtsError.message);

  // 4. Resolve a participant's display label from their user_id or contact_id.
  function resolveLabel(userId: string | null, contactId: string | null): string {
    if (userId && userId === currentUserId) return currentUserLabel;
    if (userId && userIdToName.has(userId)) return userIdToName.get(userId)!;
    if (contactId && contactIdToName.has(contactId)) return contactIdToName.get(contactId)!;
    return "Unknown";
  }

  // 5. Include a debt only when both payer and borrower are opted-in app users.
  //    Debts involving a manual contact (null user_id on either side) are always
  //    excluded because contacts have no account and cannot opt in.
  let hasExcludedDebts = false;
  const rawDebts: RawGroupDebt[] = [];

  for (const row of (rows ?? []) as GroupDebtSimplifyRow[]) {
    const remaining = Math.max(0, row.amount_cents - (row.paid_cents ?? 0));
    if (remaining <= 0) continue;

    const payerOptedIn =
      row.payer_user_id !== null && optedInUserIds.has(row.payer_user_id);
    const borrowerOptedIn =
      row.borrower_user_id !== null && optedInUserIds.has(row.borrower_user_id);

    if (payerOptedIn && borrowerOptedIn) {
      rawDebts.push({
        payerLabel: resolveLabel(row.payer_user_id, row.payer_contact_id),
        borrowerLabel: resolveLabel(row.borrower_user_id, row.borrower_contact_id),
        remainingCents: remaining,
      });
    } else {
      hasExcludedDebts = true;
    }
  }

  return { rawDebts, hasExcludedDebts };
}

// ─── Dashboard summary RPC ────────────────────────────────────

export type DashboardSummary = {
  youOweCents: number;
  owedToYouCents: number;
  totalPaidCents: number;
  totalReceivedCents: number;
  pendingCount: number;
  activeDebtCount: number;
};

/**
 * Fetches pre-aggregated dashboard totals from the server.
 * Replaces the four client-side reduce() calls in app/(tabs)/index.tsx.
 * Requires migration 20260607000003_dashboard_summary_rpc.sql.
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const { data, error } = await supabase.rpc("get_dashboard_summary");
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No data returned from get_dashboard_summary");

  return {
    youOweCents:       (data as any).you_owe_cents       ?? 0,
    owedToYouCents:    (data as any).owed_to_you_cents   ?? 0,
    totalPaidCents:    (data as any).total_paid_cents     ?? 0,
    totalReceivedCents:(data as any).total_received_cents ?? 0,
    pendingCount:      (data as any).pending_count        ?? 0,
    activeDebtCount:   (data as any).active_debt_count    ?? 0,
  };
}
