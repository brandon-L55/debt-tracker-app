-- =============================================================
-- Enable Supabase Realtime for the contacts table.
--
-- ContactsContext subscribes to INSERT events on contacts so that
-- auto-created contacts (from findOrCreateContactByEmail) and mirror
-- contacts (from create_mirror_contact RPC) appear in the Individuals
-- tab immediately without requiring a manual app restart.
--
-- The postgres_changes subscription only needs INSERT events; the
-- default REPLICA IDENTITY (primary key) is sufficient for INSERTs
-- because the full new-row payload is always included.
-- =============================================================

alter publication supabase_realtime add table public.contacts;
