# Implementation script — fix-update-team-league-not-persisted

Scope: backend only, `Back/ExtractionApi/`. Follow vertical-slice conventions: one feature file
holds endpoint + command + handler + validator (already the case for `UpdateTeam.cs`) — do not
split it. No route/DTO/validator changes are needed; `UpdateTeamCommand`/`TeamModel` already
carry `LeagueId`/`LeagueGroup` (via `TeamModelBase`).

## Step 1 — Write the failing test (Red)

Create `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/UpdateTeamHandlerTests.cs`.

Mirror the pattern in `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/UpdateExerciseHandlerTests.cs`:
- `[Collection(PostgresCollection.Name)]`, constructor takes `PostgresContainerFixture fixture`.
- A `SeedClubAndTeamAsync` helper that:
  - Creates a `Club` via `Club.Create(name, someCategoryOrTypeArg)` (check `Club.Create` signature
    before use — mirror `UpdateExerciseHandlerTests.SeedClubAsync`).
  - Creates a `Season` via `Season.Create(name, start, end, isActive: true, club: club)`.
  - Creates a `Team` via `new Team(new TeamModelBase { Name = ..., CategoryId = <a valid Category
    id used elsewhere in tests, e.g. `Category.NationalCategory.Id`>, ClubId = club.Id, SeasonId =
    season.Id, LeagueId = null, LeagueGroup = null })`, then `db.Teams.Add(team)` +
    `SaveChangesAsync`.
  - Returns the team id (and club id if needed).
- Test method `Handle_UpdatesLeagueIdAndLeagueGroup_PersistsNewValues`:
  1. Seed the team (LeagueId/LeagueGroup null) using one `AppDbContext` from
     `_fixture.CreateDbContext()`.
  2. Build an `UpdateTeamCommand` with a `TeamModel` that has the same `Id`, `Name`,
     `CategoryId`, `ClubId`, `UrlPhoto` as the seeded team (all-fields-required contract — see
     `UpdateValidator`), but `LeagueId = 1` (an existing seeded `League.Id` — see
     `LeagueEntityConfiguration.cs` `HasData`, League 1 has `CategoryId = 1`, so use the same
     `CategoryId = 1` on the team/command to stay consistent) and `LeagueGroup = 2`.
  3. Run `new UpdateTeamHandler(updateDb).Handle(command, CancellationToken.None)` using a
     **fresh** `AppDbContext` from `_fixture.CreateDbContext()` (not the seeding one — matches
     the "fresh context per phase" pattern in `UpdateExerciseHandlerTests`).
  4. Reload the team from a third, fresh `AppDbContext` and assert
     `team.LeagueId == 1 && team.LeagueGroup == 2`.
- Also add `Handle_ClearsLeagueIdAndLeagueGroup_WhenSetToNull`: seed a team with `LeagueId = 1`,
  `LeagueGroup = 2` already set, update with a command carrying `LeagueId = null`,
  `LeagueGroup = null`, assert both become `null` after reload — covers the "Clearing" scenario
  in the spec.

Run: `dotnet test --filter UpdateTeamHandlerTests` from `Back/ExtractionApi`. Both new tests MUST
FAIL at this point (current handler never calls `UpdateLeagueId`/`UpdateLeagueGroup`). Do not
proceed to Step 2 without observing this failure — that is the Red proof required by
`.claude/rules/testing.md`.

## Step 2 — Apply the minimal fix (Green)

In `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/Commands/UpdateTeam.cs`, inside
`UpdateTeamHandler.Handle`, immediately after the existing four `team.Update*` calls, add:

```csharp
team.UpdateLeagueId(request.TeamModel.LeagueId);
team.UpdateLeagueGroup(request.TeamModel.LeagueGroup);
```

Do not touch the validator, request/command shape, route, or any other file — `Team.UpdateLeagueId`
/`UpdateLeagueGroup` already exist and are unchanged (`Domain/Aggregates/UserClubs/Team.cs` lines
61-69).

Re-run `dotnet test --filter UpdateTeamHandlerTests` — both tests must now pass.

## Step 3 — Regression check

Run the broader suite to catch any fallout:

```bash
cd Back/ExtractionApi
dotnet build
dotnet test
```

If Testcontainers/Docker is unavailable in this environment and Postgres-backed tests cannot run,
say so explicitly in the report rather than silently skipping — do not mark the task done without
having observed the Red→Green transition for the new tests at least once.

## Step 4 — Report

Summarize: test names added, the exact fix applied (file + lines), and the `dotnet test` result
(pass/fail counts). Do NOT run `git commit` — per `.claude/rules/git.md` §7.3 that requires
explicit user confirmation, which happens outside this script.
