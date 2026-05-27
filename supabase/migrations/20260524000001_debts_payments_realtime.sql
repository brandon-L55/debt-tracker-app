-- =============================================================
-- Enable Supabase Realtime for debt sync.
--
-- DebtContext subscribes to debts and payments changes so accepted,
-- declined, paid, and partially paid debts update across linked accounts
-- without requiring a manual refresh.
-- =============================================================

alter publication supabase_realtime add table public.debts;
alter publication supabase_realtime add table public.payments;
