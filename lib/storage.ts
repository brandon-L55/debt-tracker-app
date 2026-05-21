// Web: use localStorage when available, otherwise fall back to in-memory
// (supabase-js default) for SSR / environments without window.
export const authStorage =
  typeof window !== "undefined" && window.localStorage
    ? window.localStorage
    : undefined;
