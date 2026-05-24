import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { registerForNotificationsAsync } from "@/lib/services/notificationService";
import { claimInvitedContacts } from "@/lib/services/contactsService";

type AuthCtx = {
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx>({
  session: null,
  isLoading: true,
  signIn: async () => null,
  signUp: async () => null,
  signOut: async () => {},
});

/** Upsert the current user's own profile row (id + email).
 *  Creates the row if missing; repairs email if null or stale. */
async function selfHealProfile(userId: string, rawEmail: string, label: string) {
  const email = rawEmail.trim().toLowerCase();
  const expoPushToken = await registerForNotificationsAsync();

  const result = expoPushToken
    ? await supabase
        .from("profiles")
        .upsert({ id: userId, email, expo_push_token: expoPushToken }, { onConflict: "id" })
    : await supabase
        .from("profiles")
        .upsert({ id: userId, email }, { onConflict: "id" });

  if (result.error) {
    console.warn(`[WARN] profile self-heal upsert failure (${label}):`, result.error.message);
  }

  try {
    await claimInvitedContacts();
  } catch (error) {
    console.warn(`[WARN] invite claim failure (${label}):`, error);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load persisted session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
      if (session?.user?.email) {
        selfHealProfile(session.user.id, session.user.email, "getSession").catch((error) => {
          console.warn("[WARN] profile self-heal failure (getSession):", error);
        });
      }
    });

    // Subscribe to auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === "SIGNED_IN" && session?.user?.email) {
        selfHealProfile(session.user.id, session.user.email, "SIGNED_IN").catch((error) => {
          console.warn("[WARN] profile self-heal failure (SIGNED_IN):", error);
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }

  async function signUp(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signUp({ email, password });
    return error ? error.message : null;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
