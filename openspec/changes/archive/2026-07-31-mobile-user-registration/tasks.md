## 1. Research confirmation (no code)

- [x] 1.1 Re-read `Back/ExtractionApi/.../Features/Coaches/Invitation/ClubInvitationValidation.cs`
      and `TeamInvitationValidation.cs` to confirm the exact `ErrorCode` string values
      (`ClubInvitationCodeNotAllowedForRole`, `ClubInvitationCodeInvalid`,
      `TeamInvitationCodeNotAllowedForRole`, `TeamInvitationCodeInvalid`) still match design.md
      Decision 4 before writing `registerErrorMessages.ts`.
- [x] 1.2 Confirm current Expo version against `Mobile/package.json`/installed `node_modules/expo`
      and skim https://docs.expo.dev/versions/v57.0.0/ (or the actually-installed version's docs) for
      any relevant `Modal`/`TextInput`/navigation changes before touching navigation config — no new
      Expo-specific APIs are expected for this feature (plain RN `Modal`, `TextInput`, `Pressable`,
      existing `@react-navigation` stack), but confirm before assuming.

## 2. API layer — `register()` (TDD)

- [x] 2.1 Write `Mobile/src/api/__tests__/register.test.ts` (Red): mocks `../client`'s `api.post`,
      asserts `registerAccount(payload)` calls `POST /api/register` with the exact payload shape and
      returns `response.data` typed as `RegisterAccountResponse`.
- [x] 2.2 Implement `Mobile/src/api/register.ts` (Green): `RegisterAccountPayload`,
      `RegisterAccountResponse`, `RegistrationStatus` types (mirroring
      `Front/src/shared/types/scope.ts`'s `RegisterPayingAccountPayload`/
      `RegisterPayingAccountResponse` without importing from `Front/`), and `registerAccount()`.
- [x] 2.3 Write `Mobile/src/api/__tests__/invitations.test.ts` (Red): mocks `api.post`, asserts
      `previewClubCode({ code, membershipKind })` calls `POST /api/invitations/club/preview` and
      `previewTeamCode({ code, membershipKind })` calls `POST /api/invitations/team/preview`, both
      returning `response.data`.
- [x] 2.4 Implement `Mobile/src/api/invitations.ts` (Green): `PreviewClubCodeResponse`,
      `PreviewTeamCodeResponse`, `TeamRosterPlayer` types (mirroring `scope.ts` equivalents) and the
      two preview functions.
- [x] 2.5 Run `npm test -- api/__tests__/register api/__tests__/invitations` — confirm green.

## 3. Error message mapping (TDD)

- [x] 3.1 Write `Mobile/src/utils/__tests__/registerErrorMessages.test.ts` (Red): covers each known
      `code` from design.md Decision 4 mapping to its Spanish message, an unrecognized `code` with a
      `detail` falling back to `detail`, and neither `code` nor `detail` falling back to the generic
      Spanish message.
- [x] 3.2 Implement `Mobile/src/utils/registerErrorMessages.ts` (Green): exports
      `getRegisterErrorMessage(error: any): string` implementing the three-tier fallback
      (code map → `detail` → generic fallback), consumed by `RegisterScreen`.

## 4. RegisterScreen — core fields and Fan happy path (TDD)

- [x] 4.1 Write `Mobile/src/screens/__tests__/RegisterScreen.test.tsx` (Red), first pass covering
      only the `Fan` role: renders email/alias/password/role inputs (`testID`s following
      `LoginScreen.test.tsx`'s convention, e.g. `email-input`, `alias-input`, `password-input`,
      `role-Fan`, `register-button`); submit disabled until all four are filled; submitting a valid
      `Fan` registration calls `registerAccount` with `{ email, alias, password, accountType: "Fan"
      }` and no role-specific fields.
- [x] 4.2 Implement minimal `Mobile/src/screens/RegisterScreen.tsx` (Green): `useReducer` state
      machine per design.md Decision 2 (core fields + role selection only, role-specific branches
      stubbed), enough to pass 4.1.
- [x] 4.3 Add and pass tests (Red → Green) for: submit button loading state while in flight; error
      banner rendering `getRegisterErrorMessage(error)` on a rejected `registerAccount` call; error
      banner clearing when a field is edited after a failed submit.

## 5. RegisterScreen — success/pending outcomes and navigation (TDD)

- [x] 5.1 Write tests (Red) in `RegisterScreen.test.tsx`: `status: "Active"` response shows a success
      message and calls `navigation.navigate('Login')`; `status: "PendingClubApproval"` response
      shows a pending-approval notice and does NOT call `navigation.navigate`; in both cases no
      token-storage/auth-context side effect occurs (mock `useAuth`/`AuthContext` and assert `login`
      or equivalent is never called, if `RegisterScreen` imports `useAuth` at all — otherwise assert
      no `SecureStore` mock was touched).
- [x] 5.2 Implement the outcome branching (Green) per design.md Decision 5 / spec.md "Post-
      registration outcome handling".
- [x] 5.3 Write and pass a test for the `LoginScreen` → `Register` navigation link: add
      `Mobile/src/screens/__tests__/LoginScreen.test.tsx` case asserting a new
      `register-link`/similar `testID` calls `navigation.navigate('Register')` when pressed (Red),
      then add the link to `LoginScreen.tsx` (Green).

## 6. RegisterScreen — ClubDirector / codeless-Coach trial acceptance (TDD)

- [x] 6.1 Write tests (Red): selecting `ClubDirector` shows a trial-confirmation prompt and disables
      submit until accepted; accepting enables submit (with alias/email/password already filled);
      cancelling resets role selection to none. Same three scenarios for `Coach` with "no club code"
      selected.
- [x] 6.2 Implement the trial-confirmation `Modal` (built-in RN `Modal`, no new dependency) and
      `ACCEPT_TRIAL`/`CANCEL_TRIAL` reducer actions (Green) per design.md Decision 3.

## 7. RegisterScreen — Coach-with-code / ClubMember invitation code (TDD)

- [x] 7.1 Write tests (Red) with `previewClubCode` mocked: typing a code for `ClubMember` (and for
      `Coach` after choosing "yes, I have a code") triggers a debounced call to `previewClubCode`;
      a resolved mock marks the code valid and enables submit; a rejected mock marks it invalid with
      an error message and keeps submit disabled.
- [x] 7.2 Implement the debounced club-code validation (Green): local `useEffect` + `setTimeout`
      (500 ms) per design.md Decision 2, calling `previewClubCode` from `api/invitations.ts`.
- [x] 7.3 Verify (existing/new test) that submitting with a valid club code sends
      `clubInvitationCode` in the payload, and that `Coach` without a code never sends it.

## 8. RegisterScreen — Player/FamilyMember team code and roster picker (TDD)

- [x] 8.1 Write tests (Red) with `previewTeamCode` mocked: typing a code for `Player`/`FamilyMember`
      triggers the debounced `previewTeamCode` call; a resolved mock with a roster reveals selectable
      player rows; for `Player` role, a roster entry with `alreadyLinked: true` renders disabled and
      is not selectable; submit stays disabled until a roster player is selected; submitting sends
      `teamInvitationCode` and `teamPlayerId` in the payload.
- [x] 8.2 Implement the debounced team-code validation and the inline roster picker (mapped
      `Pressable` rows inside the existing `ScrollView`, not a nested `FlatList`, per design.md's
      Risks/Trade-offs) (Green).

## 9. Navigation wiring

- [x] 9.1 Write/extend a navigation test (new `Mobile/src/navigation/__tests__/RootNavigator.test.tsx`
      if one does not already exist, following the mocking pattern in
      `.claude/rules/frontend-testing.md` §3.2) asserting that when `useAuth().isAuthenticated` is
      `false`, both `Login` and `Register` screens are present in the unauthenticated stack (Red).
- [x] 9.2 Add `<Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false
      }} />` next to `Login` in `Mobile/src/navigation/RootNavigator.tsx` (Green).

## 10. Full verification

- [x] 10.1 Run the complete Mobile test suite (`cd Mobile && npm test`) — 100% pass, no skipped
      tests.
- [x] 10.2 Manually re-check every scenario in
      `openspec/changes/mobile-user-registration/specs/mobile-user-registration/spec.md` against the
      implemented tests — confirm each scenario maps to at least one passing test.
- [x] 10.3 `openspec validate mobile-user-registration --strict` — zero errors.
- [x] 10.4 Confirm no files under `Front/` or `Back/ExtractionApi/` were touched (`git status` /
      `git diff --stat` scoped to `Mobile/` and `openspec/` only).
