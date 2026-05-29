import { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";
import { getProfile, upsertProfile } from "@/lib/services/profileService";

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
      setProfile(data);
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
    }

    setIsLoading(false);
  }

  async function updateProfile(patch: Partial<ProfileData>): Promise<string | null> {
    if (!session?.user?.id) return "Not signed in";

    const previous = profile;
    const next = { ...profile, ...patch };
    setProfile(next); // optimistic

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
      setProfile(previous); // revert
      return err;
    }

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
