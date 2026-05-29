# Diff Details

Date : 2026-05-27 20:42:23

Directory c:\\Users\\brand\\OneDrive\\Documents\\GitHub\\debt-tracker-app

Total : 45 files,  2899 codes, 292 comments, 275 blanks, all 3466 lines

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details

## Files
| filename | language | code | comment | blank | total |
| :--- | :--- | ---: | ---: | ---: | ---: |
| [app.json](/app.json) | JSON with Comments | 2 | 0 | 0 | 2 |
| [app/(tabs)/\_layout.tsx](/app/(tabs)/_layout.tsx) | TypeScript JSX | 28 | -2 | 3 | 29 |
| [app/(tabs)/groups.tsx](/app/(tabs)/groups.tsx) | TypeScript JSX | 20 | -1 | 0 | 19 |
| [app/(tabs)/index.tsx](/app/(tabs)/index.tsx) | TypeScript JSX | 230 | 2 | 4 | 236 |
| [app/(tabs)/individuals.tsx](/app/(tabs)/individuals.tsx) | TypeScript JSX | 25 | -1 | -1 | 23 |
| [app/(tabs)/settings.tsx](/app/(tabs)/settings.tsx) | TypeScript JSX | 64 | 6 | 8 | 78 |
| [app/\_layout.tsx](/app/_layout.tsx) | TypeScript JSX | 12 | 1 | 2 | 15 |
| [app/add-debt.tsx](/app/add-debt.tsx) | TypeScript JSX | 352 | 0 | 4 | 356 |
| [app/add-group-debt.tsx](/app/add-group-debt.tsx) | TypeScript JSX | 41 | 4 | 1 | 46 |
| [app/add-individual.tsx](/app/add-individual.tsx) | TypeScript JSX | 38 | 0 | 2 | 40 |
| [app/auth/login.tsx](/app/auth/login.tsx) | TypeScript JSX | 1 | 0 | 0 | 1 |
| [app/auth/signup.tsx](/app/auth/signup.tsx) | TypeScript JSX | 1 | 0 | 0 | 1 |
| [app/create-group.tsx](/app/create-group.tsx) | TypeScript JSX | -1 | 0 | 0 | -1 |
| [app/edit-group.tsx](/app/edit-group.tsx) | TypeScript JSX | 12 | 0 | 0 | 12 |
| [app/edit-individual.tsx](/app/edit-individual.tsx) | TypeScript JSX | 12 | 0 | 0 | 12 |
| [app/individual/\[id\].tsx](/app/individual/%5Bid%5D.tsx) | TypeScript JSX | 413 | 16 | 30 | 459 |
| [app/settings/profile.tsx](/app/settings/profile.tsx) | TypeScript JSX | 2 | 0 | 0 | 2 |
| [components/GradientButton.tsx](/components/GradientButton.tsx) | TypeScript JSX | 45 | 0 | 6 | 51 |
| [constants/effects.ts](/constants/effects.ts) | TypeScript | 23 | 0 | 5 | 28 |
| [constants/theme.ts](/constants/theme.ts) | TypeScript | -4 | -7 | 2 | -9 |
| [context/AuthContext.tsx](/context/AuthContext.tsx) | TypeScript JSX | 31 | 2 | 4 | 37 |
| [context/ContactsContext.tsx](/context/ContactsContext.tsx) | TypeScript JSX | 29 | 9 | 4 | 42 |
| [context/DebtContext.tsx](/context/DebtContext.tsx) | TypeScript JSX | 307 | 24 | 33 | 364 |
| [context/GroupsContext.tsx](/context/GroupsContext.tsx) | TypeScript JSX | 5 | 1 | 0 | 6 |
| [context/ThemeContext.tsx](/context/ThemeContext.tsx) | TypeScript JSX | 48 | 0 | 2 | 50 |
| [lib/phoneUtils.ts](/lib/phoneUtils.ts) | TypeScript | 6 | 11 | 2 | 19 |
| [lib/services/contactsService.ts](/lib/services/contactsService.ts) | TypeScript | 130 | 22 | 20 | 172 |
| [lib/services/debtService.ts](/lib/services/debtService.ts) | TypeScript | 367 | 81 | 63 | 511 |
| [lib/services/groupService.ts](/lib/services/groupService.ts) | TypeScript | 26 | 2 | 6 | 34 |
| [lib/services/notificationService.ts](/lib/services/notificationService.ts) | TypeScript | 46 | 0 | 8 | 54 |
| [package-lock.json](/package-lock.json) | JSON | 290 | 0 | 0 | 290 |
| [package.json](/package.json) | JSON | 5 | 0 | 0 | 5 |
| [supabase/migrations/20260522000000\_profiles\_email.sql](/supabase/migrations/20260522000000_profiles_email.sql) | MS SQL | 38 | 19 | 9 | 66 |
| [supabase/migrations/20260522000001\_mirror\_contact\_rpc.sql](/supabase/migrations/20260522000001_mirror_contact_rpc.sql) | MS SQL | 48 | 20 | 7 | 75 |
| [supabase/migrations/20260523000000\_debt\_accept\_decline\_rls.sql](/supabase/migrations/20260523000000_debt_accept_decline_rls.sql) | MS SQL | 10 | 15 | 2 | 27 |
| [supabase/migrations/20260523000001\_contacts\_realtime.sql](/supabase/migrations/20260523000001_contacts_realtime.sql) | MS SQL | 1 | 12 | 2 | 15 |
| [supabase/migrations/20260524000000\_partial\_payments.sql](/supabase/migrations/20260524000000_partial_payments.sql) | MS SQL | 47 | 20 | 12 | 79 |
| [supabase/migrations/20260524000001\_debts\_payments\_realtime.sql](/supabase/migrations/20260524000001_debts_payments_realtime.sql) | MS SQL | 2 | 7 | 2 | 11 |
| [supabase/migrations/20260524000002\_payments\_client\_request\_id.sql](/supabase/migrations/20260524000002_payments_client_request_id.sql) | MS SQL | 9 | 7 | 3 | 19 |
| [supabase/migrations/20260524000003\_payments\_idempotency\_enforced.sql](/supabase/migrations/20260524000003_payments_idempotency_enforced.sql) | MS SQL | 32 | 6 | 6 | 44 |
| [supabase/migrations/20260524000004\_pending\_debt\_edit\_cancel\_rls.sql](/supabase/migrations/20260524000004_pending_debt_edit_cancel_rls.sql) | MS SQL | 21 | 7 | 4 | 32 |
| [supabase/migrations/20260524000005\_payments\_borrower\_only\_rls.sql](/supabase/migrations/20260524000005_payments_borrower_only_rls.sql) | MS SQL | 13 | 6 | 3 | 22 |
| [supabase/migrations/20260524000006\_debts\_client\_request\_id.sql](/supabase/migrations/20260524000006_debts_client_request_id.sql) | MS SQL | 19 | 1 | 5 | 25 |
| [supabase/migrations/20260524000007\_profiles\_expo\_push\_token.sql](/supabase/migrations/20260524000007_profiles_expo_push_token.sql) | MS SQL | 2 | 1 | 2 | 5 |
| [supabase/migrations/20260524000008\_contact\_invites.sql](/supabase/migrations/20260524000008_contact_invites.sql) | MS SQL | 51 | 1 | 10 | 62 |

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details