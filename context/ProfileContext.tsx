import { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";
import { getProfile, upsertProfile, isUsernameAvailable } from "@/lib/services/profileService";

const CACHE_KEY = "@debt_tracker/profile_v2";

export type ProfileData = {
  display_name: string;
  phone: string;
  username: string;
  avatar_url: string | null;
  venmo_handle: string;
  cashapp_handle: string;
  paypal_handle: string;
};

const EMPTY: ProfileData = {
  display_name: "",
  phone: "",
  username: "",
  avatar_url: null,
  venmo_handle: "",
  cashapp_handle: "",
  paypal_handle: "",
};

type ProfileCtx = {
  profile: ProfileData;
  isLoading: boolean;
  updateProfile: (patch: Partial<ProfileData>) => Promise<string | null>;
};

const ProfileContext = createContext<ProfileCtx>({
  profile: EMPTY,
  isLoading: true,
  updateProfile: async () => null,
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [profile, setProfile] = useState<ProfileData>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) {
      setProfile(EMPTY);
      setIsLoading(false);
      return;
    }
    loadProfile(session.user.id);
  }, [session?.user?.id]);

  async function loadProfile(userId: string) {
    // Show cached data immediately while Supabase loads
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        setProfile({ ...EMPTY, ...JSON.parse(cached) });
      } catch {}
    }

    const row = await getProfile(userId);
    if (row) {
      const data: ProfileData = {
        display_name: row.display_name ?? "",
        phone: row.phone ?? "",
        username: row.username ?? "",
        avatar_url: row.avatar_url ?? null,
        venmo_handle: row.venmo_handle ?? "",
        cashapp_handle: row.cashapp_handle ?? "",
        paypal_handle: row.paypal_handle ?? "",
      };
      console.log("[ProfileContext] loaded from Supabase — display_name:", data.display_name, "avatar_url:", data.avatar_url);
      setProfile(data);
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } else {
      console.log("[ProfileContext] getProfile returned null for userId:", userId);
    }

    setIsLoading(false);
  }

  async function updateProfile(patch: Partial<ProfileData>): Promise<string | null> {
    if (!session?.user?.id) return "Not signed in";

    // ── Username validation ──────────────────────────────────────────────────
    // Determine the final username value being saved (use existing if not in patch).
    const newUsername = (patch.username !== undefined ? patch.username : profile.username) ?? "";
    const newUsernameLower = newUsername.trim().toLowerCase();
    const currentUsernameLower = profile.username.trim().toLowerCase();

    if (newUsernameLower) {
      // Same format rules as signup: 3–30 chars, letters/numbers/underscores.
      if (!/^[a-z0-9_]{3,30}$/.test(newUsernameLower)) {
        return "Username must be 3–30 characters: letters, numbers, and underscores only.";
      }

      // Only check remote availability when the username actually changed.
      // Skipping the check for the current user's own username prevents a
      // false "taken" result (check_signup_availability sees all rows).
      if (newUsernameLower !== currentUsernameLower) {
        const available = await isUsernameAvailable(newUsernameLower);
        if (!available) {
          return "That username is already taken. Please choose another.";
        }
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    const previous = profile;
    const next = { ...profile, ...patch };
    setProfile(next); // optimistic

    console.log("[ProfileContext] updateProfile avatar_url:", next.avatar_url);

    const err = await upsertProfile(session.user.id, {
      display_name: next.display_name || null,
      phone: next.phone || null,
      username: next.username || null,
      avatar_url: next.avatar_url || null,
      venmo_handle: next.venmo_handle || null,
      cashapp_handle: next.cashapp_handle || null,
      paypal_handle: next.paypal_handle || null,
    });

    if (err) {
      console.error("[ProfileContext] upsertProfile failed:", err);
      setProfile(previous); // revert
      return err;
    }

    console.log("[ProfileContext] upsertProfile succeeded, caching avatar_url:", next.avatar_url);
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next));
    return null;
  }

  return (
    <ProfileContext.Provider value={{ profile, isLoading, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
