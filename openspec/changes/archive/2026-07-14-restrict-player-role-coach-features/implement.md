# Implement: restrict-player-role-coach-features

You are the `openspec-implementer` subagent. Execute this script precisely against
`Back/ExtractionApi/` only. Do not touch `Front/`. Follow TDD: write/adjust a failing test before
each behavior change where practical, then make it pass. Do not skip tests (`[Fact(Skip=...)]` is
forbidden). After every section, run `dotnet build`; after all sections, run `dotnet test`.

Read `openspec/changes/restrict-player-role-coach-features/{proposal,design,tasks,specs/coach-feature-permissions/spec}.md`
first for full context. This file is the authoritative, self-contained execution script — follow it,
but the docs above explain *why*.

Repo conventions you MUST follow (from `.github/instructions/copilot-instructions.md` /
`.claude/agents/back-specialist.md`): one feature = one `.cs` file (do not split handler from
endpoint), `IRequireFeaturePermission` implementations are simple get-only properties added to the
existing command/query record — never change handler logic to add the check (the pipeline behavior
does that). `AppDbContext` is the context with `FeaturePermissions`/`PagePermissions` DbSets.

## Section 1 — Route catalog

Create `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/CoachFeatureRoutes.cs`:

```csharp
namespace RFFM.Api.Domain.Entities
{
    /// <summary>
    /// Stable logical identifiers for Coach-app feature areas, used as FeaturePermission.FeatureRoute.
    /// These are NOT literal frontend URLs — they are agreed-upon logical route identifiers shared
    /// between backend enforcement and (eventually) frontend card visibility.
    /// </summary>
    public static class CoachFeatureRoutes
    {
        // Allowed for Player (Read-only)
        public const string Squad = "/coach/squad";
        public const string Events = "/coach/attendance";
        public const string AttendanceSummary = "/coach/attendance/summary";
        public const string Convocations = "/coach/convocations";
        public const string Injured = "/coach/injured";
        public const string Sanctions = "/coach/sanctions";
        public const string Lottery = "/coach/lottery";
        public const string News = "/coach/news";

        // Blocked for Player
        public const string Rivals = "/coach/rivals";
        public const string Trainings = "/coach/trainings";
        public const string GameModel = "/coach/game-model";
        public const string SeasonAccess = "/coach/season-access";
        public const string Settings = "/coach/settings";
        public const string ClubManagement = "/coach/clubs";
        public const string ClubPlayers = "/coach/clubs/players";
        public const string ClubTeams = "/coach/clubs/teams";
        public const string ClubRegistrations = "/coach/clubs/registrations";
    }
}
```

## Section 2 — Seed data

**IMPORTANT — re-check reality before editing.** `Features/Coaches/Clubs/Commands/{Create,Update,Delete}Club.cs`
ALREADY implement `IRequireFeaturePermission` with the literal route `"/coach/clubs"` and
`RequiredPermission => "Write"` (added in a prior change, commit `f3e776b`). The current seed array in
`SeedFeaturePermissionsAsync` already has matching rows: `("ClubManagement", "/coach/clubs", "Coach", 2, false)`
and `("ClubManagement", "/coach/clubs", "ClubDirector", 3, true)`. There is also an existing test file
`tests/RFFM.Api.Tests/UnitTests/FeaturePermissionBehaviorTests.cs` with a `ClubCommandsPermissionTests`
class asserting `FeatureRoute == "/coach/clubs"` and `RequiredPermission == "Write"` on those 3 commands,
plus behavior tests that seed their own rows independently (not dependent on the seeder). **Do not change
those two existing `/coach/clubs` rows' values** — leave them exactly as-is to avoid any risk to that
existing, tested behavior. `CoachFeatureRoutes.ClubManagement` (Section 1) intentionally equals the same
literal `"/coach/clubs"` so it composes with the existing rows without conflict.

Edit `Back/ExtractionApi/src/RFFM.Host/DependencyInjection/WebApplicationExtensions.cs`, method
`SeedFeaturePermissionsAsync` (~line 316-382). Modify the `entries` array **additively**: keep the two
existing `/coach/clubs` rows (Coach Write, ClubDirector ReadWrite) untouched, and you may leave the
other pre-existing placeholder rows (`Dashboard`, `Roster`, old `/coach/season-prep` etc.) in place
since nothing reads them and removing them is not required — but you MAY delete rows that are exact
duplicates of routes you're about to re-seed with different meaning (there are none: `/coach/roster`,
`/coach/season-prep`, `/coach/assistances`, `/coach/game-models`, `/coach/dashboard` are all distinct
strings from the new `CoachFeatureRoutes` constants, e.g. `GameModel = "/coach/game-model"` singular vs
the old `/coach/game-models` plural — confirm this via `CoachFeatureRoutes` before assuming collision).

Add these new rows to the `entries` array (use the `CoachFeatureRoutes` constants, not string literals,
for everything added in this section):

```csharp
// --- New rows added by restrict-player-role-coach-features ---

// Administrator bypasses the check entirely (see FeaturePermissionBehavior) — no row needed.
// Coach, ClubDirector: ReadWrite on every newly-catalogued route (Squad/Events/etc. below).
// (ClubManagement "/coach/clubs" rows already exist above — do not duplicate.)
("Squad", CoachFeatureRoutes.Squad, "Coach", 3, false),
("Events", CoachFeatureRoutes.Events, "Coach", 3, false),
("AttendanceSummary", CoachFeatureRoutes.AttendanceSummary, "Coach", 3, false),
("Convocations", CoachFeatureRoutes.Convocations, "Coach", 3, false),
("Injured", CoachFeatureRoutes.Injured, "Coach", 3, false),
("Sanctions", CoachFeatureRoutes.Sanctions, "Coach", 3, false),
("Lottery", CoachFeatureRoutes.Lottery, "Coach", 3, false),
("News", CoachFeatureRoutes.News, "Coach", 3, false),
("Rivals", CoachFeatureRoutes.Rivals, "Coach", 3, false),
("Trainings", CoachFeatureRoutes.Trainings, "Coach", 3, false),
("GameModel", CoachFeatureRoutes.GameModel, "Coach", 3, false),
("SeasonAccess", CoachFeatureRoutes.SeasonAccess, "Coach", 3, false),
("Settings", CoachFeatureRoutes.Settings, "Coach", 3, false),
("ClubPlayers", CoachFeatureRoutes.ClubPlayers, "Coach", 3, false),
("ClubTeams", CoachFeatureRoutes.ClubTeams, "Coach", 3, false),
("ClubRegistrations", CoachFeatureRoutes.ClubRegistrations, "Coach", 3, false),

("Squad", CoachFeatureRoutes.Squad, "ClubDirector", 3, false),
("Events", CoachFeatureRoutes.Events, "ClubDirector", 3, false),
("AttendanceSummary", CoachFeatureRoutes.AttendanceSummary, "ClubDirector", 3, false),
("Convocations", CoachFeatureRoutes.Convocations, "ClubDirector", 3, false),
("Injured", CoachFeatureRoutes.Injured, "ClubDirector", 3, false),
("Sanctions", CoachFeatureRoutes.Sanctions, "ClubDirector", 3, false),
("Lottery", CoachFeatureRoutes.Lottery, "ClubDirector", 3, false),
("News", CoachFeatureRoutes.News, "ClubDirector", 3, false),
("Rivals", CoachFeatureRoutes.Rivals, "ClubDirector", 3, false),
("Trainings", CoachFeatureRoutes.Trainings, "ClubDirector", 3, false),
("GameModel", CoachFeatureRoutes.GameModel, "ClubDirector", 3, false),
("SeasonAccess", CoachFeatureRoutes.SeasonAccess, "ClubDirector", 3, false),
("Settings", CoachFeatureRoutes.Settings, "ClubDirector", 3, false),
("ClubPlayers", CoachFeatureRoutes.ClubPlayers, "ClubDirector", 3, false),
("ClubTeams", CoachFeatureRoutes.ClubTeams, "ClubDirector", 3, false),
("ClubRegistrations", CoachFeatureRoutes.ClubRegistrations, "ClubDirector", 3, false),

// ClubMember: only GameModel (matches existing frontend canSeeGameModel gate in
// Front/src/apps/coach/pages/team-dashboard/TeamDashboardCards.tsx)
("GameModel", CoachFeatureRoutes.GameModel, "ClubMember", 3, false),

// Player: Read-only on the 8 approved dashboard features
("Squad", CoachFeatureRoutes.Squad, "Player", 1, false),
("Events", CoachFeatureRoutes.Events, "Player", 1, false),
("AttendanceSummary", CoachFeatureRoutes.AttendanceSummary, "Player", 1, false),
("Convocations", CoachFeatureRoutes.Convocations, "Player", 1, false),
("Injured", CoachFeatureRoutes.Injured, "Player", 1, false),
("Sanctions", CoachFeatureRoutes.Sanctions, "Player", 1, false),
("Lottery", CoachFeatureRoutes.Lottery, "Player", 1, false),
("News", CoachFeatureRoutes.News, "Player", 1, false),
```

Also add, alongside the existing `/coach/clubs` rows, new rows for `ClubManagement` on `Player` — do
**not** add one: Player has no row for `/coach/clubs`, which is correct (blocked by default).

Keep the rest of the method (the `foreach` + `Any()` existence-check + transaction) unchanged — it
already handles idempotent insertion. Do NOT delete rows for other roles not mentioned here
(`FamilyMember`, `Fan`) — simply omit them from the array; they will correctly get no row → blocked
by `FeaturePermissionBehavior` for any newly-guarded route, which is the intended fail-closed
behavior per design.md.

Leave `SeedPagePermissionsAsync` and its `Roster` page entries untouched (out of scope).

Build after this section (`dotnet build`) before continuing.

## Section 3 — Annotate allowed-feature queries (Read)

For each file below, add `IRequireFeaturePermission` to the query record and implement the two
members as expression-bodied properties. Pattern (using `GetPlayersByTeam.cs` as the concrete
example — apply the same shape elsewhere, using the noted `FeatureRoute`):

```csharp
using RFFM.Api.Domain.Entities; // add if not already imported

public record PlayersByTeamQuery : IQueryApp<PlayersByTeamResponse[]>, IRequireFeaturePermission
{
    public string TeamId { get; set; } = null!;

    public string FeatureRoute => CoachFeatureRoutes.Squad;
    public string RequiredPermission => "Read";
}
```

Apply to:
- `Features/Coaches/Players/Queries/GetPlayersByTeam.cs` (`PlayersByTeamQuery`) → `CoachFeatureRoutes.Squad`
- `Features/Coaches/Players/Queries/GetTeamPlayer.cs` (find its query record) → `CoachFeatureRoutes.Squad`
- `Features/Coaches/Players/Queries/GetDemarcations.cs` → `CoachFeatureRoutes.Squad`
- `Features/Coaches/SportEvents/Queries/GetSportEvents.cs` → `CoachFeatureRoutes.Events`
- `Features/Coaches/SportEvents/Queries/GetSportEventItem.cs` → `CoachFeatureRoutes.Events`
- `Features/Coaches/Assistances/Queries/GetTrainingAttendanceSummary.cs` → `CoachFeatureRoutes.AttendanceSummary`
- `Features/Coaches/Convocations/GetEventConvocations.cs` (its query record only, not any command in the same file if mixed) → `CoachFeatureRoutes.Convocations`
- `Features/Coaches/Convocations/GetEventPlayers.cs` → `CoachFeatureRoutes.Convocations`
- `Features/Coaches/Convocations/GetMatchParticipation.cs` → `CoachFeatureRoutes.Convocations`

Do NOT touch `UpdateConvocationStatus.cs`, `AddConvocations.cs`, `SaveMatchParticipation.cs`,
`DeleteConvocation.cs`, `DeleteMatchParticipation.cs`, `UpdateConvocationAssistance.cs` — these are
write actions some of which Player already legitimately performs via `[Authorize(Roles=...)]`
(e.g. `UpdateConvocationStatus` explicitly lists `Player` today). Changing them is out of scope and
would risk a regression.

### Injured / Lesionados (design.md Open Question — resolve here, don't skip)

Inspect `Features/Coaches/Players/Commands/SetPlayerInjury.cs` and
`Domain/ValueObjects/Player/PlayerInjury.cs` / `Domain/Entities/TeamPlayers/TeamPlayerInjury.cs`.
If there is no query endpoint that returns a player's injuries, leave `SetPlayerInjury` UNGATED by
`IRequireFeaturePermission` for this change (do not add Write-gating that would break the "Player can
access Lesionados" requirement, since Player's seeded permission is Read-only). Add a one-line code
comment above the command record explaining: `// Intentionally not gated by IRequireFeaturePermission:
Player is Read-only on CoachFeatureRoutes.Injured but must retain today's write access; revisit if a
read endpoint is added.` Confirm this via a test in Section 6 that a Player call to
`SetPlayerInjury`'s existing authorization (whatever it is today) is unchanged by this PR (i.e. this
change makes no behavioral difference to that endpoint — write a test only if one doesn't already
cover it, otherwise note "already covered" in your final report).

Build after this section.

## Section 4 — Annotate blocked-feature commands/queries

Same mechanical pattern as Section 3: add `IRequireFeaturePermission`, `FeatureRoute` constant,
`RequiredPermission` = `"Read"` for query records, `"ReadWrite"` for command records that mutate data.

- `Features/Coaches/Rivals/Commands/CreateRival.cs`, `UpdateRival.cs`, `DeleteRival.cs`,
  `UploadRivalPhoto.cs` → `CoachFeatureRoutes.Rivals`, `"ReadWrite"`
- `Features/Coaches/Rivals/Queries/GetRivals.cs` → `CoachFeatureRoutes.Rivals`, `"Read"`
- `Features/Coaches/Trainings/Exercises/CreateExercise.cs`, `UpdateExercise.cs`, `DeleteExercise.cs`,
  `UploadExerciseMedia.cs`, `ExerciseConditionsCrud.cs` (all mutating records in that file) →
  `CoachFeatureRoutes.Trainings`, `"ReadWrite"`
- `Features/Coaches/Trainings/Exercises/GetExerciseById.cs`, `GetExercises.cs` →
  `CoachFeatureRoutes.Trainings`, `"Read"`
- `Features/Coaches/Trainings/Sessions/CreateSession.cs`, `UpdateSession.cs`, `DeleteSession.cs` →
  `CoachFeatureRoutes.Trainings`, `"ReadWrite"`
- `Features/Coaches/Trainings/Sessions/GetSession.cs`, `GetSessions.cs` →
  `CoachFeatureRoutes.Trainings`, `"Read"`
- `Features/Coaches/GameModels/Commands/CreateGameModel.cs`, `UpdateGameModel.cs`,
  `DeleteGameModel.cs`, `ToggleSkillMastered.cs` → `CoachFeatureRoutes.GameModel`, `"ReadWrite"`
- `Features/Coaches/GameModels/Queries/GetGameModel.cs`, `GetGameModelSeasons.cs`,
  `GetGameMoments.cs`, `GetGameZones.cs`, `GetSubSubPrinciple.cs`, `GetTechnicalGoals.cs` →
  `CoachFeatureRoutes.GameModel`, `"Read"`
- `Features/Coaches/SeasonAccess/CreateSeasonAccessTrialDay.cs`,
  `DeleteSeasonAccessPlayer.cs`, `DeleteSeasonAccessTrialDay.cs`,
  `RemoveSeasonAccessTrialPlayerFromDay.cs`, `UpdateSeasonAccessTrialDay.cs`,
  `UpsertSeasonAccessPlayer.cs` → `CoachFeatureRoutes.SeasonAccess`, `"ReadWrite"`
- `Features/Coaches/SeasonAccess/GetSeasonAccess.cs`, `GetSeasonAccessBySeason.cs`,
  `GetSeasonAccessTrialDayRatings.cs`, `GetSeasonAccessTrialDays.cs` →
  `CoachFeatureRoutes.SeasonAccess`, `"Read"`
- `Features/Coaches/Settings/ConfigurationCoach.cs`: the Get query → `CoachFeatureRoutes.Settings`,
  `"Read"`; the Create/Update/Delete commands → `CoachFeatureRoutes.Settings`, `"ReadWrite"`. Do not
  touch the existing `if (entity.CoachId != userId) throw new ForbiddenAccessException(...)` ownership
  checks inside the handlers — those stay as an orthogonal, additional check.
- `Features/Coaches/Clubs/Commands/CreateClub.cs`, `UpdateClub.cs`, `DeleteClub.cs`: **already done**
  in a prior change — `IRequireFeaturePermission` already implemented with `FeatureRoute => "/coach/clubs"`
  and `RequiredPermission => "Write"`. Do not touch these three files; do not change `"Write"` to
  `"ReadWrite"` (an existing reflection test `ClubCommandsPermissionTests` in
  `tests/RFFM.Api.Tests/UnitTests/FeaturePermissionBehaviorTests.cs` asserts the literal `"Write"`
  value). You may optionally replace the hardcoded `"/coach/clubs"` string literal with
  `CoachFeatureRoutes.ClubManagement` purely for consistency IF AND ONLY IF you verify
  `CoachFeatureRoutes.ClubManagement == "/coach/clubs"` exactly and re-run the existing tests to confirm
  no regression; if in doubt, leave the literals as-is — this is optional polish, not required.
- `Features/Coaches/Clubs/Queries/GetClub.cs`, `GetClubs.cs` → `CoachFeatureRoutes.ClubManagement`,
  `"Read"` (these are NOT yet gated — add `IRequireFeaturePermission` to `GetClubQueryApp` and
  `ClubsQueryApp`). Leave `GetClubEmblem.cs` unguarded.
- `Features/Coaches/Players/Queries/GetPlayers.cs` (the `PlayersQuery` keyed by `ClubId` — club-level
  roster, NOT `GetPlayersByTeam`) → `CoachFeatureRoutes.ClubPlayers`, `"Read"`
- `Features/Coaches/Teams/Commands/CreateTeam.cs`, `UpdateTeam.cs`, `DeleteTeam.cs`,
  `AddPlayerTeam.cs`, `UploadTeamPhoto.cs` → `CoachFeatureRoutes.ClubTeams`, `"ReadWrite"`
- `Features/Coaches/Teams/Queries/GetTeams.cs`, `GetTeam.cs` → `CoachFeatureRoutes.ClubTeams`,
  `"Read"`. Leave `GetTeamPhoto.cs`, `GetTeamPlayersForSelection.cs`, `ValidateTeamCode.cs`,
  `VerifyPlayerIdentity.cs` unguarded (onboarding/invite flows used before role context applies).
- `Features/Coaches/ClubJoinRequests/Commands/ApproveClubJoinRequest.cs`,
  `CancelClubJoinRequest.cs`, `RejectClubJoinRequest.cs` → `CoachFeatureRoutes.ClubRegistrations`,
  `"ReadWrite"`
- `Features/Coaches/ClubJoinRequests/Queries/GetClubJoinRequests.cs`,
  `GetPendingClubJoinRequestsCount.cs` → `CoachFeatureRoutes.ClubRegistrations`, `"Read"`

Build after this section.

## Section 5 — GetMyPermissions contract check

Open `Features/Coaches/Permissions/GetMyPermissions.cs`. Confirm `FeaturePermissionDto` already
exposes `FeatureName`, `FeatureRoute`, `PermissionType` and that `GetMyPermissionsHandler` filters by
the caller's role — it does, no code change needed. Add one integration-style handler test (Section 6)
proving a `Player`-role call returns exactly the 8 allowed `FeatureRoute` values with
`PermissionType == "Read"`.

## Section 6 — Tests (TDD, xUnit + Moq)

The test project already exists at `Back/ExtractionApi/tests/RFFM.Api.Tests/RFFM.Api.Tests.csproj`, and
`UnitTests/FeaturePermissionBehaviorTests.cs` already covers points 1-4 below using a real Postgres
testcontainer fixture (`PostgresContainerFixture` / `PostgresCollection`, via `_fixture.CreateDbContext()`)
— NOT Moq'd `AppDbContext`, NOT EF InMemory. Follow that exact pattern (real `AppDbContext` against the
test Postgres container, `Mock<ICurrentUserService>` for the current user) for any new tests in this
section. Do not introduce EF InMemory or a different mocking approach.

Existing coverage (verify still passing, do not duplicate):
1. Administrator bypasses regardless of seeded rows. ✓ already covered.
2. A role/route pair with insufficient permission type → 403. ✓ already covered.
3. No row for role/route → 403. ✓ already covered.
4. Sufficient ReadWrite / seeded Coach Write permission → succeeds. ✓ already covered.

Add only what's missing:
5. A role/route pair with a matching `Read` row and `RequiredPermission = "Read"` → succeeds (add if not
   already present).
6. Request not implementing `IRequireFeaturePermission` → passes through untouched (no DB call) — add if
   not already present.
7. Reflection-style tests (mirroring `ClubCommandsPermissionTests` in the same file) for a representative
   sample of the newly-annotated records in Sections 3-4, asserting `FeatureRoute` and
   `RequiredPermission` values match the catalog.

Then add focused handler tests for a representative sample (do not need one per file, but MUST cover
at least): `GetPlayersByTeam` (allowed, Read), `GetPlayers` club-level (blocked), `ConfigurationCoach`
Get (blocked), `GetMyPermissions` (Section 5's assertion). Use Moq to mock `ICurrentUserService.Role`
and either mock `AppDbContext` or use EF Core InMemory — follow whatever the nearest existing test file
in the project already does; do not introduce a new testing pattern.

No `[Fact(Skip=...)]` anywhere. Aim for ≥80% coverage on every file touched in Sections 2-5.

## Section 7 — Final verification

1. `dotnet build` from `Back/ExtractionApi` — must be clean.
2. `dotnet test` from `Back/ExtractionApi` — 100% pass, zero skipped.
3. Re-read `openspec/changes/restrict-player-role-coach-features/tasks.md` and mark each `- [ ]` as
   `- [x]` once genuinely done (do not check off items you deferred/skipped — instead leave unchecked
   and explain why in your final report).
4. In your final report to the orchestrator, state explicitly: (a) the final `GetMyPermissions`
   response shape/contract for the frontend, (b) the full list of `FeatureRoute` values now enforced
   and which roles have access to each, (c) any task deferred and why, (d) test/coverage results.
