## Why

Mobile (`Mobile/`) currently only offers a Login screen (`Mobile/src/navigation/RootNavigator.tsx`
renders `LoginScreen` as the sole unauthenticated route). There is no way to create an account from
the app itself — a new user must register on the web Coach app first. The web already has a full
self-registration flow (`Front/src/shared/pages/auth/register/Register.tsx`) backed by the existing,
anonymous `POST /api/register` endpoint. Replicating that flow in Mobile removes the web dependency
for new users and reuses a backend contract that already supports every role.

## What Changes

- New `RegisterScreen` in `Mobile/src/screens/` replicating the web registration form: email, alias,
  password, role selector (`Fan`, `ClubDirector`, `Coach`, `ClubMember`, `Player`, `FamilyMember`),
  and the same role-conditional fields as web (7-day trial acceptance for `ClubDirector`/codeless
  `Coach`; club invitation code with live preview for `Coach`-with-code/`ClubMember`; team invitation
  code with live preview + roster player picker for `Player`/`FamilyMember`).
- New `register()` function (new `Mobile/src/api/register.ts`) calling `POST /api/register` with the
  same payload shape as `RegisterPayingAccountPayload` in `Front/`, plus reuse of the existing
  `POST /api/invitations/club/preview` and `POST /api/invitations/team/preview` endpoints for live
  code validation (same endpoints web already uses — no backend changes needed).
- `RootNavigator.tsx`: add `Register` as a sibling `Stack.Screen` in the unauthenticated stack; add a
  "¿No tienes cuenta? Regístrate" link on `LoginScreen` navigating to it.
- No auto-login after registration (matches web behavior): on success, show a confirmation (or a
  pending-club-approval notice when `status === "PendingClubApproval"`) and navigate back to `Login`.
- API errors mapped to Spanish messages via `e.response?.data?.detail` fallback, shown as a single
  banner above the form (no inline per-field errors), matching web's approach and Mobile's existing
  `error` state convention.
- New Jest + Testing Library for RN tests for `RegisterScreen`, the new `register()`/preview API
  functions, and the updated `RootNavigator`/`LoginScreen` navigation wiring.

## Capabilities

### New Capabilities
- `mobile-user-registration`: Mobile users can self-register for any of the six account roles
  directly from the app, with the same role-conditional fields, live invitation-code validation, and
  pending-approval/error handling as the existing web registration flow.

### Modified Capabilities
(none — no existing spec requirements change; `POST /api/register` and the invitation preview
endpoints are consumed as-is, no backend contract changes)

## Impact

- Mobile only: new `Mobile/src/screens/RegisterScreen.tsx`, new `Mobile/src/api/register.ts` (and/or
  `invitations.ts` for the preview calls), modified `Mobile/src/navigation/RootNavigator.tsx` and
  `Mobile/src/screens/LoginScreen.tsx`, new co-located Jest tests under `__tests__/`.
- No changes to `Back/ExtractionApi/` — `POST /api/register`, `POST /api/invitations/club/preview`,
  `POST /api/invitations/team/preview` are reused unmodified.
- No changes to `Front/` — web registration is unaffected; Mobile duplicates the client-side flow
  consciously per `.claude/rules/frontend-architecture.md` §1 (no shared package between Front and
  Mobile).
