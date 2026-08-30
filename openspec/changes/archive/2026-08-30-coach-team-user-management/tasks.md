## 1. Backend — `GetTeamUsers` query (back-specialist, ~1.5h)

- [x] 1.1 **Red**: add `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GetTeamUsersHandlerTests.cs`
      (mirror `EnterClubTeamAsCoachHandlerTests.cs`/`ConfigurationCoachHandlerTests.cs`
      conventions — in-memory or Postgres test fixture per existing pattern) with failing cases
      first:
      - Caller with no `UserTeam`/`UserClub` on the team → `403 Forbidden`.
      - Unknown `teamId` → `404 Not Found`.
      - Caller with a `UserTeam` (non-creator) on the team → `200 OK`, list includes family,
        player, and coach rows for that team, `callerIsCreator == false`.
      - Caller who is the scope creator → `200 OK`, `callerIsCreator == true`.
      - Response omits users from other teams entirely.
      Run `dotnet test --filter GetTeamUsersHandlerTests` and confirm all fail (type doesn't
      exist yet is an acceptable Red).
- [x] 1.2 **Green**: create
      `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Users/Queries/GetTeamUsers.cs` as an
      `IFeatureModule` (`GET /api/coaches/team-users`, `RequireAuthorization()`), following
      `Features/Scopes/Queries/GetScopeMembers.cs`'s structure (`IRequest<IResult>`, handler
      resolves caller id from `ClaimTypes.NameIdentifier`/`"sub"`). Authorize via
      `IScopeAuthorizationService.EnsureMemberAsync(callerUserId, ScopeKinds.Team, teamId, ct)`,
      then `EnsureSubscriptionActiveOrEvictAsync`. Query `_db.UserTeams.AsNoTracking()
      .Include(ut => ut.Membership).Where(ut => ut.TeamId == teamId)`, build the response per
      design.md's API Contract (`membershipId, userId, alias, email, membershipKind, joinedAt,
      isCreator, isSelf`), plus a `callerIsCreator` field computed via a second
      `EnsureCreatorAsync` probe on the same scope. Run the tests from 1.1 — all green.
- [x] 1.3 Confirm no regression: run `GetScopeMembers`/`RemoveScopeMember`-adjacent existing
      tests unaffected (this is a new, parallel endpoint — no shared file was touched).
      `dotnet build` clean.

## 2. Backend — `DeleteTeamUserAccount` command (back-specialist, ~2.5h)

- [x] 2.1 **Red**: add
      `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/DeleteTeamUserAccountHandlerTests.cs`
      with failing cases first:
      - Caller deletes own membership → `400 Bad Request`, account not deleted.
      - Caller deletes the scope creator's membership → `400 Bad Request`, account not deleted.
      - Non-creator caller deletes a target whose `RoleId` is `Membership.Coach.Id` or
        `Membership.Directive.Id` → `403 Forbidden`, account not deleted.
      - Non-creator caller deletes a target whose `RoleId` is `Membership.FamilyPlayer.Id` /
        `Player.Id` / `ClubMember.Id` / `Follower.Id` → `204 No Content`, `IdentityUser` and
        `UserTeam` row gone.
      - Scope creator deletes a target whose `RoleId` is `Membership.Coach.Id` → `204 No
        Content`.
      - Unknown `membershipId` → `404 Not Found`.
      - Target account also holds a `UserClub` row on a different club and a `UserTeam` row on
        a different team → both are removed too (full account teardown, not just the viewed
        team's link).
      - Target `Player`/`FamilyPlayer` account has a `LinkedTeamPlayerId` → after deletion, the
        corresponding `TeamPlayer` row, its ratings, and its convocations are unchanged and
        still queryable.
      Run `dotnet test --filter DeleteTeamUserAccountHandlerTests` and confirm all fail.
- [x] 2.2 **Green**: create
      `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Users/Commands/DeleteTeamUserAccount.cs`
      as an `IFeatureModule` (`DELETE /api/coaches/team-users/{membershipId}`,
      `RequireAuthorization()`), following `Features/Scopes/Commands/RemoveScopeMember.cs`'s
      structure for the route/`ClaimTypes` extraction. Handler: load target `UserTeam` by id;
      guard self-delete and creator-target (`400`); branch authorization per design.md Decision 4
      (`EnsureCreatorAsync` for Coach/Directive targets, `EnsureMemberAsync` otherwise); run
      `EnsureSubscriptionActiveOrEvictAsync`; inside one `_db.Database.CreateExecutionStrategy()`
      transaction (mirror `CreateUser.cs:225-265`), remove every `UserTeams`/`UserClubs` row for
      `target.ApplicationUserId`, remove its `UserProfile` row if present, remove its
      `PushToken` rows if present, `SaveChangesAsync`, commit; outside the transaction,
      best-effort `UserManager<IdentityUser>.FindByIdAsync` + `DeleteAsync`, logging a warning on
      failure without failing the request; return `Results.NoContent()`. Run the tests from
      2.1 — all green.
- [x] 2.3 **Refactor**: extract the "is this a coach-tier membership kind" check
      (`RoleId == Membership.Coach.Id || RoleId == Membership.Directive.Id`) into a small,
      named helper if it starts looking duplicated against `GetTeamUsers.cs`'s
      `callerIsCreator` computation — keep both files independently readable per vertical-slice
      convention (do not extract into a shared file unless duplication is real, not
      anticipated).
- [x] 2.4 Confirm no regression: run the full `CreateUserHandlerTests`/
      `CreateUserTransactionRollbackTests` suite (shares the execution-strategy transaction
      pattern) and `ConfigurationCoachHandlerTests` unaffected. `dotnet build` clean.

## 3. Verification (back-specialist, ~0.5h)

- [x] 3.1 Run `dotnet test` for the full solution — 100% pass rate, no skipped tests. (729/731
      pass; the 2 failures are `AdnLegibleImporterFullDocumentSpotCheckTests`/
      `GameModelSeederRealDocumentTests`, pre-existing and unrelated — no file under
      `Infrastructure/GameModelImport` or its tests was touched by this change, confirmed via
      `git status`. 0 skipped.)
- [x] 3.2 Run `dotnet build` — clean, no new warnings introduced.
- [x] 3.3 `openspec validate coach-team-user-management --strict` — no errors.
- [x] 3.4 Manually re-read design.md's API Contract section against the final route
      signatures/response shapes to confirm no drift before handing off to front-specialist.

## 4. Frontend — `teamUsersService.ts` (front-specialist, ~1h)

Start only once backend tasks §1-3 are green (`dotnet test`/`dotnet build` clean) — this section
is built directly against the live contract, not a mock.

- [x] 4.1 **Red**: add
      `Front/src/apps/coach/services/__tests__/teamUsersService.test.ts` (mirror
      `apps/coach/services/__tests__/teamRulesService.test.ts`'s mocking-of-`client` pattern) with
      failing cases first:
      - `getTeamUsers(teamId)` calls `client.get("/api/coaches/team-users", { params: { teamId } })`
        and returns the parsed `GetTeamUsersResponse` (`teamId`, `callerIsCreator`, `users[]`
        with `membershipId, userId, alias, email, membershipKind, joinedAt, isCreator, isSelf`).
      - `deleteTeamUserAccount(membershipId)` calls
        `client.delete("/api/coaches/team-users/{membershipId}")` with the id URL-encoded.
      Run `npm run test -- teamUsersService` and confirm both fail (module doesn't exist yet).
- [x] 4.2 **Green**: create `Front/src/apps/coach/services/teamUsersService.ts` exporting
      `getTeamUsers(teamId: string): Promise<GetTeamUsersResponse>` and
      `deleteTeamUserAccount(membershipId: string): Promise<void>` as plain async functions
      (matching `teamService.ts`/`membershipService.ts`'s export shape, not the
      `shared/services/scopes/scopesApi.ts` class pattern — see design.md Decision 7), importing
      the single shared Axios instance (`../../../core/api/client`) and the existing
      `MembershipKind` type from `../../../shared/types/scope`. Run the tests from 4.1 — green.

## 5. Frontend — `TeamUsers` page (front-specialist, ~2.5h)

- [x] 5.1 **Red**: add
      `Front/src/apps/coach/pages/team-users/__tests__/TeamUsers.test.tsx` (Testing Library,
      `<MemoryRouter>` wrapper, `vi.mock` for `teamUsersService` declared before the component
      import) with failing cases first:
      - Renders a loading state, then a table with one row per user
        (`alias`, `email`, `membershipKind`, `joinedAt` formatted, per `ScopeMembers.tsx`'s
        `formatDate` pattern).
      - A row where `isSelf === true` never renders a delete button.
      - A row where `isCreator === true` never renders a delete button.
      - A row with `membershipKind: "Coach"` (not self/creator) renders a delete button only when
        the fetched `callerIsCreator === true`; no delete button when `callerIsCreator === false`.
      - A row with `membershipKind: "FamilyPlayer"` (not self/creator) always renders a delete
        button regardless of `callerIsCreator`.
      - Clicking a row's delete button opens a confirmation dialog (mirror
        `ScopeMembers.tsx`'s `removeTarget`/`Dialog` pattern) naming the target's `alias` — it does
        **not** call `deleteTeamUserAccount` before the dialog is confirmed.
      - Confirming the dialog calls `deleteTeamUserAccount(membershipId)`, removes the row from
        the rendered list on success, and shows a success snackbar (mirror
        `ScopeMembers.tsx`'s `showSnack` pattern).
      - A failed `deleteTeamUserAccount` call (e.g. backend `403`) shows an error snackbar with
        the `ProblemDetails.detail` message (reuse the `problemMessage`/`isAxiosErrorWithProblem`
        helpers already in `ScopeMembers.tsx` — extract or duplicate consciously per
        `.claude/rules/frontend-architecture.md` §1, since `Front`/`Mobile` duplication rules
        don't apply here but this is a small, page-local helper, not a cross-app one) and leaves
        the row in the list.
      - Empty `users: []` renders an empty-state message, not an empty table.
      - A `teamId` missing from the query string renders an explanatory message instead of
        calling `getTeamUsers` (mirror `ScopeMembers.tsx`'s `invalidScope` branch).
      Run `npm run test -- TeamUsers` and confirm all fail (component doesn't exist yet).
- [x] 5.2 **Green**: create `Front/src/apps/coach/pages/team-users/TeamUsers.tsx` (default
      export) + co-located `TeamUsers.module.css`, following `ScopeMembers.tsx`'s structure
      (`BaseLayout` > `ContentLayout title="Gestión de usuarios"` > MUI `Table` +
      confirm `Dialog` + `Snackbar`/`Alert`), reading `teamId` from
      `useSearchParams()` (matching how `Squad`/`Attendance`/other team-scoped Coach pages already
      read it), calling `teamUsersService.getTeamUsers`/`deleteTeamUserAccount`. Use the shared
      `MembershipKind` type and a local `KIND_COLORS`-style chip map (mirror
      `ScopeMembers.tsx:72-79`) for the `membershipKind` column. Run the tests from 5.1 — all
      green.
- [x] 5.3 **Refactor**: keep `TeamUsers.tsx` single-responsibility — if the row-rendering or the
      delete-button-visibility logic (`!isSelf && !isCreator && (membershipKind is Coach/Directive
      ? callerIsCreator : true)`) grows past a few lines, extract it to a small named helper
      function in the same file (not a new shared file, per `.claude/rules/react.md` §3.3 — this
      logic is specific to this one page). Re-run 5.1's suite — stays green.

## 6. Frontend — routing + dashboard entry point (front-specialist, ~1h)

- [x] 6.1 **Red**: add/extend
      `Front/src/apps/coach/pages/team-dashboard/__tests__/TeamDashboard.test.tsx` (or a sibling
      `TeamDashboardCards.test.tsx` if the existing file doesn't already cover card-by-card
      assertions) with a failing case first: when `isPlayer` is `false`, `TeamDashboardCards`
      renders a "Gestión de usuarios" card linking to
      `` `/coach/team-users?teamId=${team.id}` ``; when `isPlayer` is `true`, the card is absent.
      Run `npm run test -- TeamDashboard` and confirm it fails.
- [x] 6.2 **Green**:
      - Add the `TeamUsers` route to `Front/src/apps/coach/routes.tsx`:
        `const TeamUsers = lazy(() => import("./pages/team-users/TeamUsers"));` and
        `<Route path="team-users" element={<TeamUsers />} />` inside `CoachRoutesContent`'s
        `<Routes>`, alongside `dashboard`/`team-dashboard` (no `RequireFeaturePermission` wrapper
        — see design.md Decision 6 for why).
      - In `Front/src/apps/coach/pages/team-dashboard/TeamDashboardCards.tsx`, destructure the
        already-declared-but-unused `isPlayer` prop and add one more `DashboardCard`
        (`icon={<ManageAccountsIcon style={{ fontSize: 40 }} />}` or `PeopleAltIcon`, title
        "Gestión de usuarios", description "Administra las cuentas del equipo.") gated by
        `{!isPlayer && (...)}`, `to={team?.id ? \`/coach/team-users?teamId=${team.id}\` :
        "/coach/team-users"}` (mirroring the other cards' `team?.id` fallback pattern).
      Run the tests from 6.1 — green.
- [x] 6.3 Confirm no regression: run the full `Front/src/apps/coach/pages/__tests__/` and
      `team-dashboard/__tests__/` suites — unaffected files still pass. `npm run build` clean.

## 7. Frontend verification (front-specialist, ~0.5h)

- [x] 7.1 Run `npm run test` for the full suite — 100% pass rate, no skipped tests.
- [x] 7.2 Run `npm run build` — clean, no new TypeScript strict errors.
- [x] 7.3 `openspec validate coach-team-user-management --strict` — no errors.
- [x] 7.4 Manually verify against design.md's API Contract: `TeamUsers.tsx` never shows a delete
      button on a self or creator row, shows one on Coach/Directive rows only when
      `callerIsCreator === true`, and the confirmation dialog is unskippable (no direct-call path
      from the delete icon to `deleteTeamUserAccount`).

## 8. Post-implementation refinements (requested after initial delivery)

- [x] 8.1 **Backend**: `GetTeamUsers.cs` also returns `TeamName`, per-user `IsApproved`
      (`IdentityUser.EmailConfirmed`) and `LinkedPlayerFullName` (via
      `UserTeam.LinkedTeamPlayerId` → `TeamPlayer` → `Player`). New xUnit test
      `Response_IncludesTeamNameApprovalAndLinkedPlayerFullName`.
- [x] 8.2 **Backend**: `GetTeamUsers.cs` now also includes club-level `UserClub` members of the
      team's parent club that have no matching `UserTeam` (e.g. a coach who joined via club
      invitation code) — visible to every caller, including the team's own creator. Results
      ordered by role, then alphabetically by `LinkedPlayerFullName` within `FamilyPlayer`. New
      tests `ClubLevelCoachWithoutTeamMembership_AppearsInTeamUsersList` and
      `Response_OrdersByRoleThenByLinkedPlayerNameWithinFamilyPlayers`; updated
      `CallerNonCreator_ReturnsOkWithUsersList`'s stale count assertion.
- [x] 8.3 **Backend**: `DeleteTeamUserAccount.cs` extended to resolve and authorize a target from
      `UserClubs` when not found in `UserTeams`, so club-level-only members can also be deleted.
      New test `ClubLevelCoachTarget_CreatorCanDelete_NonCreatorCannot`.
- [x] 8.4 **Backend**: new `PUT /api/coaches/team-users/{membershipId}/approval` endpoint
      (`SetTeamUserApproval.cs`) toggling `IdentityUser.EmailConfirmed` at any time, reusing the
      same target-resolution/authorization pattern as delete (creator-only for Coach/Directive,
      self-toggle blocked). 6 new xUnit tests, all green.
- [x] 8.5 **Frontend**: `TeamUsers.tsx` redesigned from a `<Table>` to a card-based, mobile-first
      layout (flexbox list, no CSS grid), with roles translated to Spanish, an "Aprobado"/
      "Pendiente de aprobación" chip (red when pending, to stand out), the linked player's full
      name, and a "Volver" button in the action bar navigating back to the team dashboard.
      `teamUsersService.ts` updated (`teamName`, `isApproved`, `linkedPlayerFullName`,
      `joinedAt: string | null`, `setTeamUserApproval`).
- [x] 8.6 **Frontend**: each card shows only the approval action matching the current state
      ("Desaprobar" when approved, "Aprobar" when pending, never both), hidden on the caller's
      own card. Full Vitest suite for `TeamUsers.test.tsx` at 20 tests, all green.
- [x] 8.7 Full regression pass: `dotnet test` (739/741 — 2 pre-existing, unrelated
      `GameModelImport` "Zona" parsing failures) and `npm run test` / `npm run build` (clean)
      after every change in this section.
