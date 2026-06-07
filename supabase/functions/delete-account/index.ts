import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ deleted: false, reason: "method_not_allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ deleted: false, reason: "unauthorized" }, 401);
  }

  // Verify the caller is an authenticated app user via their JWT.
  // Using the anon key + caller's token so auth.uid() is set correctly
  // inside the reset_account() RPC called below.
  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authError } = await anonClient.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ deleted: false, reason: "unauthorized" }, 401);
  }

  console.log("[delete-account] request received for user:", user.id);

  // Step 1: Clear all app data using the caller's JWT.
  // reset_account() is a SECURITY DEFINER RPC that uses auth.uid() internally —
  // it must be called with the user's token, not the service-role key.
  // This handles: debts, contacts, groups, friend_requests, nudges, linked_user_id.
  const { error: rpcError } = await anonClient.rpc("reset_account");
  if (rpcError) {
    console.error("[delete-account] reset_account RPC failed:", rpcError.message);
    // Nothing has been deleted yet — safe to return early.
    return jsonResponse({ deleted: false, reason: "rpc_failed" }, 500);
  }

  console.log("[delete-account] reset_account succeeded for user:", user.id);

  // Step 2: Delete the Supabase auth identity using the service-role key.
  // This requires admin privileges and cascades to the profiles row via FK.
  // Debts created by other users where this user is a participant will have
  // payer_user_id / borrower_user_id set to NULL via ON DELETE SET NULL.
  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error: deleteError } = await svc.auth.admin.deleteUser(user.id);
  if (deleteError) {
    // App data was cleared by reset_account() but the auth identity remains.
    // The user can still sign in — recoverable by support if needed.
    console.error("[delete-account] auth.admin.deleteUser failed:", deleteError.message);
    return jsonResponse({ deleted: false, reason: "delete_failed" }, 500);
  }

  console.log("[delete-account] auth user permanently deleted:", user.id);
  return jsonResponse({ deleted: true });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
