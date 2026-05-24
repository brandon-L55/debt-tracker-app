-- Store the latest Expo push token for the signed-in user's profile.

alter table public.profiles
  add column if not exists expo_push_token text;
