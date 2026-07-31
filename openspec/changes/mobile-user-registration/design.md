## Context

Mobile (`Mobile/src/`) has a single unauthenticated route (`Login`, in
`Mobile/src/navigation/RootNavigator.tsx`). `AuthContext.login()` calls the mobile-specific
`POST /api/mobile/login`, stores the token in `expo-secure-store`, and derives roles from the JWT
(`src/auth/roles.ts`). There is no `register` concept anywhere in Mobile today.

The web Coach app (`Front/`) already implements the full self-registration flow against the
**generic**, anonymous `POST /api/register` endpoint (`Back/ExtractionApi/.../Features/Coaches/Users/
Commands/CreateUser.cs`) — this is a different endpoint from mobile login, has no auth requirement,
and already supports all six `AppRoles`-backed account types. It also depends on two more generic,
anonymous endpoints for live invitation-code validation: `POST /api/invitations/club/preview` and
`POST /api/invitations/team/preview` (`Front/src/shared/services/invitations/invitationsApi.ts`).
None of these three endpoints are mobile-specific — they are already reusable as-is from Mobile's
single Axios instance (`Mobile/src/api/client.ts`), no backend change needed.

Web's form logic (`Front/src/shared/pages/auth/register/Register.tsx` + its `RoleSelector`,
`InvitationCodeField`, `TeamPlayerPicker`, `PendingClubApprovalNotice`, `TrialConfirmDialog`
sub-components) is the reference behavior to replicate, not the reference code — RN has no MUI/CSS
Modules, so the Mobile screen re-implements the same state machine with `View`/`TextInput`/`Pressable`
primitives per `.claude/rules/react-native.md`.

## Goals / Non-Goals

**Goals:**
- Let a user create an account for any of the six roles (`Fan`, `ClubDirector`, `Coach`,
  `ClubMember`, `Player`, `FamilyMember`) directly from Mobile, matching web's role-conditional field
  behavior exactly (trial acceptance, club invitation code, team invitation code + roster picker).
- Reuse `POST /api/register`, `POST /api/invitations/club/preview`, and
  `POST /api/invitations/team/preview` unmodified.
- Match web's post-submit behavior: no auto-login; `PendingClubApproval` shows a notice; otherwise
  shows a success message and returns to `Login`.
- Map API errors to Spanish messages using the `e.response?.data?.detail` fallback pattern already
  used by `LoginScreen`/other Mobile screens (`.claude/rules/react-native.md` §2).
- Full Jest + Testing Library for RN coverage written first (TDD), including the conditional-field
  state machine and both success/error paths.

**Non-Goals:**
- No backend changes (no new endpoints, no payload/response shape changes).
- No auto-login after registration — intentionally out of scope, matches web.
- No password-complexity validation on the client (web has none either; server-side Identity rules
  are the only enforcement point).
- No visual/UX parity requirement with MUI's exact look — only functional/behavioral parity.
- Not porting `Front/src/shared/utils/errorMessages.ts`'s i18next-based error-code→message mapping
  wholesale: Mobile has no i18next setup (`Mobile/src/i18n/` exists for other purposes — verify scope
  before reusing). Mobile keeps its existing simpler pattern
  (`e.response?.data?.detail || '<fallback en español>'`) per `.claude/rules/react-native.md`, with a
  small local map only for the small set of known `code` values from `CreateUser.cs` (see Decisions).

## Decisions

### 1. New API module: `Mobile/src/api/register.ts`
One file per resource, per `.claude/rules/react-native.md` §4. Exports:
- `registerAccount(payload: RegisterAccountPayload): Promise<RegisterAccountResponse>` → `POST
  /api/register`.
- Types mirror `Front/src/shared/types/scope.ts`'s `RegisterPayingAccountPayload` /
  `RegisterPayingAccountResponse` (duplicated deliberately — Mobile never imports from `Front/`, per
  `.claude/rules/frontend-architecture.md` §1).

Preview calls live in a second new file, `Mobile/src/api/invitations.ts`, exporting
`previewClubCode(code, membershipKind)` and `previewTeamCode(code, membershipKind)` → `POST
/api/invitations/club/preview` / `POST /api/invitations/team/preview`. Kept separate from
`register.ts` because these two endpoints are conceptually invitation-code operations, reusable
independently of registration (mirrors web's separate `invitationsApi` module).

**Alternative considered**: put everything in one `auth.ts` alongside a future `register()` on
`AuthContext`. Rejected — registration does not authenticate, so it does not belong on
`AuthContext`; keeping it as plain `api/` functions matches the existing `team.ts`/`clubEmblem.ts`
pattern for stateless resource calls.

### 2. `RegisterScreen` as a single component with local `useReducer`
Mirrors web's `useReducer` state machine in `Register.tsx` almost 1:1 (same action names conceptually:
`SET_FIELD`, `SET_ROLE`, `SET_COACH_HAS_CLUB_CODE`, `SET_INVITATION_CODE`, `SET_CODE_VALIDATION`,
`SET_SELECTED_TEAM_PLAYER`, `SUBMIT_START`/`SUBMIT_ERROR`/`SUBMIT_SUCCESS_ACTIVE`/
`SUBMIT_SUCCESS_PENDING`) — reusing a proven state shape reduces design risk and keeps behavior
parity easy to verify against web's own `Register.test.tsx`.

Sub-pieces that web splits into separate components (`RoleSelector`, `InvitationCodeField`,
`TeamPlayerPicker`, `PendingClubApprovalNotice`) become **inline sections within
`RegisterScreen.tsx`** rather than a new `screens/components/` sub-tree, because:
- They are simple enough in RN (a role list of `Pressable` rows; a `TextInput` + inline status text;
  a `FlatList` of roster rows) that a full component split adds indirection without reuse — no other
  Mobile screen needs a role selector or invitation code field today.
- If a future screen needs one of these pieces, extract then (YAGNI), placing it under
  `screens/components/` per `.claude/rules/react-native.md` §2 at that point.

Debounced live code validation (500 ms, matching web's `InvitationCodeField`) is implemented with a
local `useEffect` + `setTimeout` inside `RegisterScreen`, calling `previewClubCode`/`previewTeamCode`
from the new `invitations.ts`.

**Alternative considered**: extract `RoleSelector`/`InvitationCodeField` as separate RN components
under `screens/components/` from day one, mirroring web's file layout. Rejected for now per YAGNI
above; noted as the natural next refactor if a second screen needs them.

### 3. Trial acceptance UI: inline confirmation view, not a modal dialog component
Web uses a `TrialConfirmDialog` MUI `Dialog`. RN has no direct MUI dialog; using `Modal` from
`react-native` (built-in, no new dependency) with the same accept/cancel semantics
(`ACCEPT_TRIAL`/`CANCEL_TRIAL` actions) reproduces the same *behavior* (block progress until
accepted or cancelled) without needing a new UI library dependency.

### 4. Error mapping: small local `code` → message map + existing fallback
`CreateUser.cs`'s handler returns a stable, small set of `code` values in `ProblemDetails.Extensions`:
`AccountTypeRequired`, `AliasIsAlreadyTaken`, `EmailIsAlreadyTaken`, `UserCreationFailed`,
`TrialAcceptanceRequired`, `LinkedPlayerNotInTeam`, `LinkedPlayerAlreadyClaimed`. The two invitation
validators add four more (confirmed by reading
`Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Invitation/ClubInvitationValidation.cs` and
`TeamInvitationValidation.cs`): `ClubInvitationCodeNotAllowedForRole`, `ClubInvitationCodeInvalid`,
`TeamInvitationCodeNotAllowedForRole`, `TeamInvitationCodeInvalid`. Add a small
`Mobile/src/utils/registerErrorMessages.ts` mapping exactly these ~10 known codes to Spanish copy,
falling back to `e.response?.data?.detail` and then a generic Spanish fallback — same three-tier
fallback shape as `LoginScreen`, just with an extra code-lookup tier.

Mobile's existing i18n setup (`Mobile/src/i18n/`, using `i18n-js` + `expo-localization`, confirmed by
reading `Mobile/src/i18n/index.ts` and `translations/es.ts`) has no error-code namespace today (unlike
web's i18next `errors:` namespace) — this feature does not add one either, keeping the local map
small and self-contained rather than growing Mobile's i18n surface for a single screen's errors.

### 5. Navigation: `Register` as a sibling `Stack.Screen`, entry link from `LoginScreen`
`RootNavigator.tsx`'s unauthenticated branch (currently only `<Stack.Screen name="Login" .../>`)
gets a second sibling:
```tsx
<Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
```
`LoginScreen.tsx` gains a `Pressable`/`Text` link ("¿No tienes cuenta? Regístrate") calling
`navigation.navigate('Register')`. On successful registration, `RegisterScreen` calls
`navigation.navigate('Login')` (after showing the success/pending message), matching web's
`navigate('/login')` after a 2 s delay for the Active case, and staying in place showing
`PendingClubApprovalNotice`-equivalent copy for the pending case (web does not auto-navigate away from
pending either — it just renders the notice in place).

**Alternative considered**: a `presentation: 'modal'` stack group like `Calendar`'s. Rejected — Login
and Register are both top-level, mutually-exclusive entry screens; a plain sibling screen is simpler
and matches how `Login` itself is registered.

## Risks / Trade-offs

- **[Risk]** Web's `errorMessages.ts` relies on i18next translation keys per error `code`; Mobile has
  no equivalent lookup today, so the Spanish copy for each `code` must be hand-authored and kept in
  sync with `Back/.../CreateUser.cs`, `ClubInvitationValidation`, `TeamInvitationValidation` manually.
  → **Mitigation**: enumerate exact codes from those three files during implementation (not just from
  this design doc) before writing the map, and always keep the `detail`-based fallback so an
  un-enumerated code never surfaces as a blank/undefined message.
- **[Risk]** Duplicating `RegisterAccountPayload`/`RegisterAccountResponse` types between `Front/` and
  `Mobile/` risks drift if the backend contract changes only one side gets updated.
  → **Mitigation**: accepted deliberately per `.claude/rules/frontend-architecture.md` §1 (no shared
  package without explicit user request); both sides hit the same real endpoint so a contract
  mismatch surfaces immediately as a runtime 400, not silently.
- **[Risk]** `TeamPlayerPicker`-equivalent list (roster) could be long for large squads and a `FlatList`
  inside a form that already scrolls (`ScrollView`) can cause nested-scroll issues in RN.
  → **Mitigation**: keep the outer container a plain `ScrollView` and render the roster as a mapped
  list of `Pressable` rows (not a nested `FlatList`) — rosters are small (typically <30 players), so
  virtualization is unnecessary; matches web's plain `<List>` (non-virtualized) choice too.
- **[Trade-off]** Inlining the role-selector/invitation-code/roster-picker UI into one
  `RegisterScreen.tsx` file makes that file larger than a typical Mobile screen. Accepted per Decision
  2's YAGNI rationale; documented here so a future contributor knows the extraction point if the file
  grows unwieldy or a second consumer appears.

## Migration Plan

Purely additive — new screen, new API files, one new navigation entry, one new link on
`LoginScreen`. No data migration, no rollout sequencing needed. Rollback is deleting the new files
and the two navigation additions.

## Open Questions

None outstanding — the two questions raised during drafting (exact invitation-validator error codes;
whether `Mobile/src/i18n/` already has error-code infrastructure) were resolved during this design
pass: codes are enumerated in Decision 4, and `Mobile/src/i18n/` (i18n-js, no `errors` namespace) does
not provide reusable infrastructure for this, confirming the local-map approach.
