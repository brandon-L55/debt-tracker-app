import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { normalizePhone } from "@/lib/phoneUtils";
import { registerForNotificationsAsync } from "@/lib/services/notificationService";
import { claimInvitedContacts } from "@/lib/services/contactsService";

// ── Public types ─────────────────────────────────────────────

export type SignUpOptions = {
  /** Required. Stored normalized in profiles.phone. */
  phone: string;
  password: string;
  /** Optional. The name other users see. Not unique. */
  displayName?: string;
  /** Optional. Stored lowercased in profiles.username. Must be unique if set. */
  username?: string;
  /** Optional. Used as the Supabase auth email. Must be unique if set. */
  email?: string;
};

export type SignUpResult = {
  error: string | null;
  /** True when the user must click a confirmation link sent to their email. */
  needsEmailConfirmation: boolean;
};

type AuthCtx = {
  session: Session | null;
  isLoading: boolean;
  /** Accepts email address, phone number, or username. */
  signIn: (identifier: string, password: string) => Promise<string | null>;
  signUp: (opts: SignUpOptions) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  /** Sends a password reset email. Only works if the account has a real email. */
  resetPassword: (email: string) => Promise<string | null>;
  /** Re-sends the signup confirmation email for an unconfirmed account. */
  resendConfirmationEmail: (email: string) => Promise<string | null>;
};

// ── Internal helpers ─────────────────────────────────────────

const SYNTHETIC_SUFFIX = "@gotchulatr.internal";

function phoneToSyntheticEmail(normalizedPhone: string): string {
  const digits = normalizedPhone.replace(/\D/g, "");
  return `ph_${digits}${SYNTHETIC_SUFFIX}`;
}

function isSyntheticEmail(email: string): boolean {
  return email.endsWith(SYNTHETIC_SUFFIX);
}

/** Upsert the current user's own profile row.
 *  Skips synthetic internal emails so they never appear in profiles.email. */
async function selfHealProfile(userId: string, authEmail: string, label: string) {
  const expoPushToken = await registerForNotificationsAsync();

  const patch: Record<string, unknown> = { id: userId };
  if (!isSyntheticEmail(authEmail)) {
    patch.email = authEmail.trim().toLowerCase();
  }
  if (expoPushToken) patch.expo_push_token = expoPushToken;

  const { error } = await supabase.from("profiles").upsert(patch, { onConflict: "id" });
  if (error) {
    console.warn(`[WARN] profile self-heal upsert failure (${label}):`, error.message);
  }

  try {
    await claimInvitedContacts();
  } catch (err) {
    console.warn(`[WARN] invite claim failure (${label}):`, err);
  }
}

// ── Context ──────────────────────────────────────────────────

const AuthContext = createContext<AuthCtx>({
  session: null,
  isLoading: true,
  signIn: async () => null,
  signUp: async () => ({ error: null, needsEmailConfirmation: false }),
  signOut: async () => {},
  resetPassword: async () => null,
  resendConfirmationEmail: async () => null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
      if (session?.user?.email) {
        selfHealProfile(session.user.id, session.user.email, "getSession").catch(console.warn);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === "SIGNED_IN" && session?.user?.email) {
        selfHealProfile(session.user.id, session.user.email, "SIGNED_IN").catch(console.warn);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(identifier: string, password: string): Promise<string | null> {
    const trimmed = identifier.trim();
    let authEmail: string;

    if (trimmed.includes("@")) {
      // Direct email path — no lookup needed.
      authEmail = trimmed.toLowerCase();
    } else {
      // Phone or username — resolve to the auth email via RPC.
      const normalized = normalizePhone(trimmed) || trimmed;
      const { data, error } = await supabase.rpc("resolve_login_identifier", {
        identifier: normalized,
      });
      if (error || !data) {
        return "We couldn't find an account with that login.";
      }
      authEmail = data as string;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("email not confirmed")) {
        return "EMAIL_NOT_CONFIRMED:" + authEmail;
      }
      if (
        msg.includes("invalid") ||
        msg.includes("credentials") ||
        msg.includes("password")
      ) {
        return "Invalid login information.";
      }
      return error.message;
    }
    return null;
  }

  async function signUp(opts: SignUpOptions): Promise<SignUpResult> {
    const { password } = opts;
    const normalizedPhone = normalizePhone(opts.phone) || opts.phone.trim();
    const normalizedEmail = opts.email?.trim().toLowerCase() || null;
    const normalizedUsername = opts.username?.trim().toLowerCase() || null;
    const authEmail = normalizedEmail ?? phoneToSyntheticEmail(normalizedPhone);

    // Check availability before creating any auth user.
    const { data: takenReason, error: checkError } = await supabase.rpc(
      "check_signup_availability",
      { p_phone: normalizedPhone, p_username: normalizedUsername, p_email: normalizedEmail }
    );
    if (checkError) return { error: checkError.message, needsEmailConfirmation: false };
    if (takenReason === "PHONE_TAKEN") {
      return { error: "An account with this phone number already exists.", needsEmailConfirmation: false };
    }
    if (takenReason === "USERNAME_TAKEN") {
      return { error: "That username is already taken. Please choose another.", needsEmailConfirmation: false };
    }
    if (takenReason === "EMAIL_TAKEN") {
      return { error: "An account with this email already exists.", needsEmailConfirmation: false };
    }

    // Create the Supabase auth user.
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: authEmail,
      password,
    });
    if (authError) return { error: authError.message, needsEmailConfirmation: false };

    // Save profile fields immediately.
    if (authData.user) {
      const normalizedDisplayName = opts.displayName?.trim() || null;
      const patch: Record<string, unknown> = { id: authData.user.id, phone: normalizedPhone };
      if (normalizedDisplayName) patch.display_name = normalizedDisplayName;
      if (normalizedUsername) patch.username = normalizedUsername;
      if (normalizedEmail) patch.email = normalizedEmail;

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(patch, { onConflict: "id" });
      if (profileError) console.warn("[WARN] signUp profile save:", profileError.message);
    }

    return { error: null, needsEmailConfirmation: !!normalizedEmail };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function resetPassword(email: string): Promise<string | null> {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: "debttrackerapp://auth/reset-password" }
    );
    if (error) return error.message;
    return null;
  }

  async function resendConfirmationEmail(email: string): Promise<string | null> {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
    });
    if (error) return error.message;
    return null;
  }

  return (
    <AuthContext.Provider value={{ session, isLoading, signIn, signUp, signOut, resetPassword, resendConfirmationEmail }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
