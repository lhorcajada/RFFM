## 1. Backend — `EnterClubTeamAsCoach` endpoint (back-specialist, ~2h)

- [x] 1.1 **Red**: add `Back/ExtractionApi/tests/RFFM.Api.Tests/.../EnterClubTeamAsCoachHandlerTests.cs`
      (mirror `UpdateConvocationStatusHandlerTests.cs`/`ValidateTeamJoinCode` test conventions)
      with failing cases first:
      - Unknown code → `404 Not Found`.
      - Code resolves to a team whose `ClubId` the caller has **no** `UserClub` row for → `403 Forbidden`.
      - Code resolves to a team whose `ClubId` the caller has a `UserClub` with
        `RoleId == Membership.ClubMember.Id` (not Coach/Directive) for → `403 Forbidden`.
      - Malformed code (wrong length/charset) → `400 Bad Request` (FluentValidation).
      Run `dotnet test --filter EnterClubTeamAsCoachHandlerTests` and confirm all fail (type/file
      doesn't exist yet is an acceptable "Red").
- [x] 1.2 **Green (happy path)**: create
      `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Invitation/Commands/EnterClubTeamAsCoach.cs`
      as an `IFeatureModule` (`POST /api/invitations/team/enter-as-coach`, `RequireAuthorization()`),
      following `ValidateTeamJoinCode.cs`'s structure: `Command`/`Response` records, `Handler`,
      `Validator`. Handler logic: resolve `Team` by normalized `JoinCode`; if null → 404
      (`Results.NotFound` equivalent via `ProblemDetails`); else check
      `_db.UserClubs.AnyAsync(uc => uc.ApplicationUserId == userId && uc.ClubId == team.ClubId &&
      (uc.RoleId == Membership.Coach.Id || uc.RoleId == Membership.Directive.Id))`; if false → 403;
      else upsert `ConfigurationCoach` (`_db.Set<ConfigurationCoach>()`, find by `CoachId ==
      userId`, create or update `PreferredTeamId`/`PreferredClubId`), `SaveChangesAsync`, return
      `{ teamId, teamName }`. Add the matching `Validator : AbstractValidator<Command>` reusing
      `ValidationConstants.TeamJoinCodeLength`/pattern from `ValidateTeamCode.Validator`.
      Run the tests from 1.1 — all green.
- [x] 1.3 **Green (re-entry/idempotency)**: add a test for calling the endpoint twice with codes
      for two different teams in the same club — second call must **update** the existing
      `ConfigurationCoach` row (not insert a duplicate). Fix the handler if it doesn't already
      handle this (should, per 1.2's find-or-create).
- [x] 1.4 Confirm no regression: run the full `UpdateConvocationStatus`/`ValidateTeamJoinCode`/
      `ConfigurationCoach` test suites unaffected. `dotnet build` clean.

## 2. Frontend — service + hook wiring (front-specialist, ~2h)

- [x] 2.1 **Red**: add/extend a Vitest test for `useTeamAppEntry` (new file or extend an existing
      `__tests__` sibling) asserting: when `configurationCoachService.getCurrent()` (mocked)
      resolves with `preferredTeamId: null`, clicking "Continuar" on `ChangeRoleDialog` opens
      `CodeInputDialog` with title "Código de equipo" (not an immediate navigate); when it resolves
      with a `preferredTeamId`, "Continuar" still navigates directly to `/coach/dashboard`
      (existing behavior, regression-guarded). Run `npm run test` — new assertions fail (no test
      target function/branch exists yet).
- [x] 2.2 **Green**: add `enterClubTeamByCode(code: string): Promise<{ teamId: string; teamName:
      string }>` to `Front/src/apps/coach/services/teamService.ts` (POST
      `/api/invitations/team/enter-as-coach`), exported alongside the existing `validateTeamCode`.
      Update `useTeamAppEntry.ts`: make `handleKeepRole` async, call
      `configurationCoachService.getCurrent()`, branch per Decision 4 in design.md (navigate if
      `preferredTeamId` set, else open `CodeInputDialog` with a new internal
      `selectedUserType = "CoachClubTeam"`). Extend `handleCodeAccept`'s branching to call
      `teamService.enterClubTeamByCode(code)` for that type, then `navigate(`/coach/dashboard?teamId=${result.teamId}`)`
      on success, surfacing `error.response?.data?.detail` in `CodeInputDialog` on failure (mirror
      the existing catch block's pattern). Run the tests from 2.1 — green.
- [x] 2.3 **Red → Green**: add a Vitest case for the error path — `enterClubTeamByCode` rejects
      with a `403` (`response.data.detail = "Este código pertenece a un equipo de otro club."`) —
      assert `CodeInputDialog` shows that message and stays open (not closed/navigated).
- [x] 2.4 Regression pass: run the existing `useTeamAppEntry`/`AppSelector`/`CodeInputDialog`
      tests (Player/FamilyMember/ClubMember branches, `openPlayerRelinkDialog`) — confirm
      unaffected. `npm run build` and `npm run test` both pass.

## 3. Cross-check (either specialist, ~1h)

- [ ] 3.1 Manually trace (or add an integration-style test if the harness supports it) the full
      path: club-code Coach registration → club approval (existing, unchanged) → login → "Mi
      equipo" → `ChangeRoleDialog` "Continuar" → code prompt → valid team code → lands on
      `/coach/team-dashboard` or `/coach/dashboard` with the entered team's context, with
      `Front/src/apps/coach/hooks/useTeamAndClub.tsx`'s `?teamId=` resolution picking it up
      immediately (no extra reload needed).
- [ ] 3.2 Confirm `TeamEditAuthorization.CanEditAsync`/`GetTeams.cs`'s `CanEdit` computation is
      unaffected (no `UserTeam` was created — see design.md Decision 2) by re-running their
      existing test suites, not just the new ones.
- [ ] 3.3 Update `openspec/specs/` only if this change is later promoted to a tracked capability
      spec (out of scope for the initial implementation pass — confirm with the user before adding
      a new `openspec/specs/coach-club-team-entry/spec.md`).
