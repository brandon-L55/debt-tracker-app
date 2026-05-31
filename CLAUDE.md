# CLAUDE.md Project Instructions

## Project Context

This is a React Native / Expo debt tracker app using Expo Router and Supabase.

The app tracks debts between friends, individuals, and groups. Users can add debts, split group expenses, pay full or partial debts, track net balances, and eventually simplify/cancel circular debts.

Main app sections:

- Dashboard
- Contacts/Friends
- Groups
- Add Debt
- Settings/Profile

Use the existing project structure and patterns before creating new ones.

## Response Style

When making changes:

- Explain what files you changed.
- Explain what behavior changed.
- Mention anything I need to test.
- Do not give long unrelated explanations.
- Do not rewrite large parts of the app unless I ask.

## Code Safety Rules

Before changing code:

- Look for the existing function, component, context, or service that already handles the feature.
- Reuse existing patterns instead of creating duplicate logic.
- Do not remove working features while adding new ones.
- Do not rename files, routes, database fields, or functions unless necessary.
- Do not change unrelated UI or backend behavior.
- Do not replace working Supabase logic with local-only mock logic.
- Do not hardcode fake data unless I specifically ask for placeholder/mock data.
- If mock data is used, clearly mark it and keep it easy to replace.

## Backend / Supabase Rules

This app uses Supabase for real app data.

When editing backend-connected features:

- Preserve Supabase Auth behavior.
- Preserve Row Level Security assumptions.
- Preserve realtime refresh behavior if already used.
- Do not bypass existing services unless necessary.
- Do not create fake users for manual contacts.
- Keep the difference between app users and manual contacts clear.

Definitions:

- App user: a real user/profile in Supabase who can log in and respond to debt requests.
- Manual contact: a person the user added manually who may not have an account.

Debt approval rules:

- If the person has an app account, create a pending/request debt that requires approval.
- If the person is only a manual contact, create the debt as active/accepted immediately.
- Manual contacts should not need to approve debts because they cannot respond in the app.

## Debt and Payment Rules

Payments must update all related totals:

- Dashboard totals
- Contact/person totals
- Group totals if relevant
- Net debt
- Individual debt card remaining amount
- Debt history

Partial payments:

- Must reduce the remaining amount.
- Must update the debt status correctly.
- Must not mark a debt fully paid unless the remaining balance is zero.
- Percentage payments should match the net debt payment behavior when possible.

Mark paid:

- Should mark the correct debt as paid.
- Should update dashboard and person totals.
- Should support undo if that feature exists.

Do not update only the frontend numbers. The backend/source of truth must update too.

## UI Consistency Rules

Keep UI consistent across the app:

- Use the current theme system.
- Support light mode and dark mode.
- Use existing colors, gradients, spacing, border radius, shadows, and card styles.
- Use the same button style for the same type of action.
- Do not make one screen look completely different from the rest of the app.
- New screens should match the existing navigation/header style.

Primary actions should feel consistent:

- Add
- Save
- Pay
- Accept
- Cancel
- Delete
- Mark Paid

## Keyboard Behavior Standard

All screens, tabs, modals, and popups that contain text inputs or number inputs must use the app’s shared keyboard-safe form pattern.

Required behavior:

- The keyboard closes when the user scrolls or drags the screen down.
- The keyboard closes when the user taps outside a text box.
- A Done button or equivalent close-keyboard action must be available above the keyboard/suggestions area.
- This must work for both text keyboards and number keyboards.
- When a user taps into an input, the screen must automatically scroll so the active input is not blocked by the keyboard.
- Multiline inputs, such as notes and reason fields, must scroll far enough to reveal most or all of the field.
- The behavior must work consistently across iOS, Android, and web without breaking layout.

Development rule:
Do not create a new form screen with a plain ScrollView if it contains inputs. Use the shared keyboard-safe wrapper/component used elsewhere in the app.

## Navigation Rules

Use Expo Router patterns already in the project.

Do not break:

- Bottom tabs
- Contacts/Friends navigation
- Groups navigation
- Individual person pages
- Add Debt flow
- Add Friend flow
- Settings/Profile navigation

When adding a new screen:

- Make sure it is reachable from the correct button.
- Make sure the back button works.
- Make sure it works on mobile and web.
- Avoid duplicate routes for the same purpose.

## Contacts / Friends Rules

The app should support both:

- Manual contacts
- Real app users/friends

Contacts/Friends page:

- “Add Friend” should refer to adding a person/contact.
- Friend discovery/request pages should be separate from the normal Add Friend flow.
- People who added me, recommended friends, and people who have not added me back should stay organized in tabs.

Do not break existing contacts:

- Search
- Sorting
- Swipe actions
- Pin/silence/delete if present
- Contact cards
- Debt totals

## Group Rules

Groups are for trips, events, roommates, and friend groups.

When changing group debt behavior:

- Do not block the whole group debt if one person is a manual contact.
- App users can receive requests.
- Manual contacts should be added to the debt immediately without approval.
- Split totals must still add up correctly.
- Group member selection must keep working.

## Testing Checklist

After making changes, test the affected flow and mention what should be tested manually.

Always consider:

- iOS/mobile behavior
- Android behavior
- Web behavior
- Light mode
- Dark mode
- Empty states
- Loading states
- Error states
- Manual contacts
- Real app users
- Pending debts
- Accepted debts
- Partial debts
- Paid debts

## Git / Change Management

Keep changes focused.

Do not:

- Reformat unrelated files.
- Delete code without explaining why.
- Make huge rewrites for small UI changes.
- Change database structure unless I clearly ask for it.
- Push to git unless I ask.

When possible, make the smallest safe change that solves the problem.

## Placeholder Feature Rule

If the backend is not ready for a feature:

- Build the UI in a way that can connect to the backend later.
- Use clearly labeled placeholder data only when necessary.
- Do not make placeholder behavior look like completed production behavior.
- Leave comments explaining where real backend data should connect.

## Accessibility / Usability Rules

Buttons should be easy to tap on mobile.
Small icon buttons should still have enough hit area.
Text should be readable in light and dark mode.
Important actions should have clear labels or icons.
Destructive actions should require confirmation when appropriate.
Empty states should explain what the user can do next.
