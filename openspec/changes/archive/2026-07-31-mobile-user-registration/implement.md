# Implement: mobile-user-registration (Mobile only)

Self-contained technical script for the Mobile slice of this change. No backend or `Front/`
files are touched — `POST /api/register`, `POST /api/invitations/club/preview`, and
`POST /api/invitations/team/preview` are consumed exactly as they exist today.

## Conventions to follow

- TDD strict Red → Green → Refactor per task in `tasks.md`: write the failing Jest +
  Testing Library for RN test first, run it, confirm it fails, then write minimal production
  code, then run the suite again before moving to the next task.
- One resource per file under `Mobile/src/api/` (`register.ts`, `invitations.ts`), same shape
  as `Mobile/src/api/team.ts`/`clubEmblem.ts` — plain exported async functions using the single
  `api` instance from `./client`, no class wrapper.
- One screen per file, `RegisterScreen.tsx` in `Mobile/src/screens/`, mirroring
  `LoginScreen.tsx`'s conventions: `useState`/`useReducer` for state, `testID`s for every
  interactive element, error banner using `e.response?.data?.detail` fallback pattern (extended
  here with a `code`-based lookup tier per design.md Decision 4).
- Never read `SecureStore` directly or call `useAuth().login()` from `RegisterScreen` —
  registration does not authenticate; no auth side effect at all.
- Colors from `coachColors` (`Mobile/src/theme/colors.ts`); no new hardcoded hex.
- Spanish user-facing text throughout.
- Tests co-located under `__tests__/` next to the file they test, mocking `../client`'s `api`
  export and `@react-navigation/native`'s `useNavigation` the same way
  `LoginScreen.test.tsx`/`CalendarTabs.test.tsx` already do.
- Do not touch `Front/` or `Back/ExtractionApi/`.

## Confirmed error codes (from Back/ExtractionApi, re-verified during design)

From `Back/ExtractionApi/src/RFFM.Api/Domain/ErrorCodes.cs`,
`Features/Coaches/Users/Commands/CreateUser.cs`,
`Features/Coaches/Invitation/ClubInvitationValidation.cs`,
`Features/Coaches/Invitation/TeamInvitationValidation.cs`:

`AccountTypeRequired`, `AliasIsAlreadyTaken`, `EmailIsAlreadyTaken`, `UserCreationFailed`,
`TrialAcceptanceRequired`, `LinkedPlayerNotInTeam`, `LinkedPlayerAlreadyClaimed`,
`ClubInvitationCodeNotAllowedForRole`, `ClubInvitationCodeInvalid`,
`TeamInvitationCodeNotAllowedForRole`, `TeamInvitationCodeInvalid`.

Endpoint confirmed: `app.MapPost("api/register", ...)` in `CreateUser.cs` — payload/response
shape matches `Front/src/shared/types/scope.ts`'s `RegisterPayingAccountPayload` /
`RegisterPayingAccountResponse` (to be duplicated, not imported, per
`.claude/rules/frontend-architecture.md` §1). Preview endpoints confirmed in
`Front/src/shared/services/invitations/invitationsApi.ts`:
`POST /api/invitations/club/preview`, `POST /api/invitations/team/preview`.

## Step 1 — API layer (tasks.md §2)

`Mobile/src/api/register.ts`:
```ts
import { api } from './client';

export type RegistrationStatus = 'Active' | 'PendingClubApproval';

export interface RegisterAccountPayload {
  alias: string;
  email: string;
  password: string;
  accountType: string;
  trialAccepted?: boolean;
  clubInvitationCode?: string;
  teamInvitationCode?: string;
  teamPlayerId?: string;
}

export interface RegisterAccountResponse {
  userId: string;
  roles: string[];
  status: RegistrationStatus;
  subscription: { plan: string; status: string; endDate: string } | null;
  clubJoinRequestId: string | null;
}

export const registerAccount = async (
  payload: RegisterAccountPayload,
): Promise<RegisterAccountResponse> => {
  const response = await api.post('/api/register', payload);
  return response.data;
};
```

`Mobile/src/api/invitations.ts`:
```ts
import { api } from './client';

export interface TeamRosterPlayer {
  teamPlayerId: string;
  playerId: string;
  name: string;
  lastName: string | null;
  urlPhoto: string | null;
  dorsal: number | null;
  alreadyLinked: boolean;
}

export interface PreviewClubCodeResponse {
  clubId: string;
  clubName: string;
  membershipKind: string;
}

export interface PreviewTeamCodeResponse {
  teamId: string;
  teamName: string;
  clubId: string;
  membershipKind: string;
  players: TeamRosterPlayer[];
}

export interface ValidateCodePayload {
  code: string;
  membershipKind: string;
}

export const previewClubCode = async (
  payload: ValidateCodePayload,
): Promise<PreviewClubCodeResponse> => {
  const response = await api.post('/api/invitations/club/preview', payload);
  return response.data;
};

export const previewTeamCode = async (
  payload: ValidateCodePayload,
): Promise<PreviewTeamCodeResponse> => {
  const response = await api.post('/api/invitations/team/preview', payload);
  return response.data;
};
```

Tests first (`Mobile/src/api/__tests__/register.test.ts`,
`Mobile/src/api/__tests__/invitations.test.ts`), mocking `../client` exactly like
`clubEmblem.test.ts` (`jest.mock('../client', () => ({ api: { post: jest.fn() } }))`).
Assert exact URL + payload passthrough + `response.data` passthrough, and one
rejection-propagates case per function.

## Step 2 — Error message mapping (tasks.md §3)

`Mobile/src/utils/registerErrorMessages.ts`:
```ts
const CODE_MESSAGES: Record<string, string> = {
  AccountTypeRequired: 'Debes seleccionar un tipo de cuenta.',
  AliasIsAlreadyTaken: 'Ese nombre de usuario ya está en uso.',
  EmailIsAlreadyTaken: 'Ese correo electrónico ya está registrado.',
  UserCreationFailed: 'No se pudo crear la cuenta. Inténtalo de nuevo.',
  TrialAcceptanceRequired: 'Debes aceptar la prueba gratuita de 7 días.',
  LinkedPlayerNotInTeam: 'El jugador seleccionado no pertenece a este equipo.',
  LinkedPlayerAlreadyClaimed: 'Ese jugador ya está vinculado a otra cuenta.',
  ClubInvitationCodeNotAllowedForRole: 'Este rol no admite código de invitación de club.',
  ClubInvitationCodeInvalid: 'El código de invitación de club no es válido.',
  TeamInvitationCodeNotAllowedForRole: 'Este rol no admite código de invitación de equipo.',
  TeamInvitationCodeInvalid: 'El código de invitación de equipo no es válido.',
};

const GENERIC_FALLBACK = 'No se pudo completar el registro. Inténtalo de nuevo.';

export function getRegisterErrorMessage(error: any): string {
  const code = error?.response?.data?.code;
  if (code && CODE_MESSAGES[code]) {
    return CODE_MESSAGES[code];
  }
  const detail = error?.response?.data?.detail;
  if (detail) {
    return detail;
  }
  return GENERIC_FALLBACK;
}
```

Test first (`Mobile/src/utils/__tests__/registerErrorMessages.test.ts`): one case per known
code, one unrecognized-code-with-detail case, one no-code-no-detail case.

## Step 3 — RegisterScreen (tasks.md §4-8)

New `Mobile/src/screens/RegisterScreen.tsx`. Build incrementally, test-first, in the exact
order tasks.md lists (§4 core fields + Fan happy path → §5 success/pending outcomes +
navigation → §6 trial acceptance → §7 club code → §8 team code + roster picker). Do not
write the whole file before any test exists — each sub-step in tasks.md gets its own
Red → Green cycle.

State shape (mirrors `Front/src/shared/pages/auth/register/Register.tsx`'s reducer,
adapted — `role: UserRole | ''`, no MUI, `View`/`TextInput`/`Pressable`/`Modal` primitives):

- Fields: `email`, `alias`, `password`, `role`.
- Role-specific: `trialAccepted`, `trialModalVisible`, `coachHasClubCode: boolean | null`,
  `invitationCode`, `codeValidation: { status: 'idle' | 'checking' | 'valid' | 'invalid'; ... }`,
  `selectedTeamPlayerId`.
- Submission: `submitting`, `error`, `successMessage`, `pendingApproval`.

`testID` convention (mirrors `LoginScreen.test.tsx`): `email-input`, `alias-input`,
`password-input`, `role-Fan`, `role-ClubDirector`, `role-Coach`, `role-ClubMember`,
`role-Player`, `role-FamilyMember`, `register-button`, `error-message`,
`success-message`, `pending-approval-notice`, `trial-modal`, `trial-accept-button`,
`trial-cancel-button`, `club-code-input`, `club-code-status`, `team-code-input`,
`team-code-status`, `roster-player-<teamPlayerId>`.

Role → payload field mapping (must match `spec.md` scenarios exactly):
- `Fan`: no extra fields.
- `ClubDirector`: `trialAccepted: true` (only sendable once trial accepted).
- `Coach` + no club code: `trialAccepted: true`.
- `Coach` + has club code: `clubInvitationCode`.
- `ClubMember`: `clubInvitationCode`.
- `Player` / `FamilyMember`: `teamInvitationCode`, `teamPlayerId`.

Debounce: local `useEffect` keyed on `invitationCode`/role branch, `setTimeout(..., 500)`,
cleared on unmount/re-run — calls `previewClubCode`/`previewTeamCode` from
`api/invitations.ts` and dispatches the checking/valid/invalid states.

Trial modal: RN built-in `Modal` (`visible={trialModalVisible}`), not a new dependency.
Accepting sets `trialAccepted: true` and closes; cancelling resets role selection to `''`
and all role-specific state (per spec.md "Cancelling the trial prompt aborts the role
choice").

Roster picker: mapped `Pressable` rows inside the screen's existing `ScrollView` (not a
nested `FlatList` — rosters are small, matches design.md's Risks/Trade-offs). A roster row
with `alreadyLinked: true` is only disabled when `role === 'Player'` (per spec.md scenario);
`FamilyMember` can select an already-linked player.

On submit success: `status === 'Active'` → show `success-message` text, then
`navigation.navigate('Login')`; `status === 'PendingClubApproval'` → show
`pending-approval-notice`, no navigation call. Never call `useAuth()`/`login()`/`SecureStore`
anywhere in this screen.

On submit failure: `setError(getRegisterErrorMessage(e))`; clear `error` on the next field
edit (mirrors spec.md "Error clears on retry").

## Step 4 — LoginScreen link (tasks.md §5.3)

Add a `Pressable`/`Text` below the existing button in `LoginScreen.tsx`:
```tsx
<Pressable testID="register-link" onPress={() => navigation.navigate('Register')}>
  <Text style={styles.linkText}>¿No tienes cuenta? Regístrate</Text>
</Pressable>
```
Test first in `LoginScreen.test.tsx`: pressing `register-link` calls
`navigation.navigate('Register')`. Reuses the file's existing `mockNavigate` mock.

## Step 5 — Navigation wiring (tasks.md §9)

`Mobile/src/navigation/RootNavigator.tsx`: import `RegisterScreen`, add as a sibling inside
the `!isAuthenticated` branch:
```tsx
<Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
```

New `Mobile/src/navigation/__tests__/RootNavigator.test.tsx` (none exists yet): mock
`../../auth/AuthContext`'s `useAuth` to return `{ isAuthenticated: false }`, mock
`../../screens/LoginScreen` and `../../screens/RegisterScreen` as string components (same
`jest.mock('../../screens/X', () => 'X')` pattern as `CalendarTabs.test.tsx`), mock
`@react-navigation/native-stack`'s `createNativeStackNavigator` similarly to how
`CalendarTabs.test.tsx` mocks `bottom-tabs`, and assert both `Login` and `Register` screens
are registered when unauthenticated.

## Step 6 — Full verification

```bash
cd Mobile
npm test
```

Confirm 100% pass, zero skipped tests. Cross-check every scenario in
`openspec/changes/mobile-user-registration/specs/mobile-user-registration/spec.md` against
the written tests (tasks.md §10.2). Run
`openspec validate mobile-user-registration --strict` (zero errors) and confirm via
`git status`/`git diff --stat` that only `Mobile/` and `openspec/` files changed.

Do not commit or push — report the diff and test results back to the user for explicit
go-ahead per `.claude/rules/git.md` §6.3, and mark completed tasks in `tasks.md`.
