import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ sent: false, reason: "unauthorized" }, 401);
  }

  // Verify the caller is an authenticated app user
  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await anonClient.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ sent: false, reason: "unauthorized" }, 401);
  }

  let nudgeId: string;
  try {
    const body = await req.json();
    if (!body?.nudge_id) throw new Error("missing nudge_id");
    nudgeId = body.nudge_id;
  } catch {
    return jsonResponse({ sent: false, reason: "bad_request" }, 400);
  }

  // Service-role client for reading profiles (bypasses RLS safely server-side)
  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Fetch the nudge, enforcing that the authenticated user is the sender
  const { data: nudge, error: nudgeError } = await svc
    .from("debt_nudges")
    .select("id, sender_user_id, recipient_user_id, message, amount_cents, group_id, group_name")
    .eq("id", nudgeId)
    .eq("sender_user_id", user.id)
    .single();

  if (nudgeError || !nudge) {
    console.error("[nudge-push] nudge not found or caller is not sender:", nudgeId, nudgeError?.message);
    return jsonResponse({ sent: false, reason: "not_found" });
  }

  // Fetch recipient's Expo push token
  const { data: recipientProfile, error: profileError } = await svc
    .from("profiles")
    .select("expo_push_token")
    .eq("id", nudge.recipient_user_id)
    .single();

  if (profileError) {
    console.error("[nudge-push] profile fetch failed:", profileError.message);
    return jsonResponse({ sent: false, reason: "profile_error" });
  }

  const pushToken: string | null = (recipientProfile as { expo_push_token: string | null } | null)?.expo_push_token ?? null;
  if (!pushToken) {
    console.log("[nudge-push] recipient has no push token, skipping:", nudge.recipient_user_id);
    return jsonResponse({ sent: false, reason: "no_token" });
  }

  const expoMessage = {
    to: pushToken,
    title: "Payment Reminder",
    body: nudge.message as string,
    sound: "default",
    data: {
      type: "nudge",
      nudgeId: nudge.id,
      senderId: user.id,
      ...(nudge.group_id ? { groupId: nudge.group_id } : {}),
    },
  };

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(expoMessage),
    });

    const result = await res.json();
    // Expo wraps single messages in { data: { status, ... } } or { data: [{ status, ... }] }
    const ticket = Array.isArray(result?.data) ? result.data[0] : result?.data;

    if (ticket?.status === "error") {
      console.error("[nudge-push] Expo rejected token:", ticket.message, ticket.details);
      // Do not throw — log and continue so caller is not blocked
      return jsonResponse({ sent: false, reason: "expo_error", detail: ticket.message });
    }

    console.log("[nudge-push] push sent to recipient:", nudge.recipient_user_id);
    return jsonResponse({ sent: true });
  } catch (err) {
    console.error("[nudge-push] Expo fetch failed:", err);
    return jsonResponse({ sent: false, reason: "network_error" });
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
