## 1. Regression test (Red)
- [ ] 1.1 Add `UpdateTeamHandlerTests` under `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/`, following the `PostgresContainerFixture` + `[Collection(PostgresCollection.Name)]` pattern used by `UpdateExerciseHandlerTests.cs`.
- [ ] 1.2 Seed a `Club`, `Season`, and `Team` (via `Team(TeamModelBase)`) with `LeagueId`/`LeagueGroup` left `null`.
- [ ] 1.3 Write `Handle_UpdatesLeagueIdAndLeagueGroup` — build an `UpdateTeamCommand` with a `TeamModel` carrying a different `LeagueId` (an existing seeded `League.Id`, e.g. `1`) and a non-null `LeagueGroup`, call `UpdateTeamHandler.Handle`, then reload the `Team` from a fresh `DbContext` and assert `LeagueId`/`LeagueGroup` equal the requested values.
- [ ] 1.4 Confirm the test fails against current `main` (`dotnet test --filter UpdateTeamHandlerTests`) — this proves the bug.

## 2. Fix (Green)
- [ ] 2.1 In `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/Commands/UpdateTeam.cs`, add `team.UpdateLeagueId(request.TeamModel.LeagueId);` and `team.UpdateLeagueGroup(request.TeamModel.LeagueGroup);` to `UpdateTeamHandler.Handle`, alongside the existing `UpdateName`/`UpdateUrlPhoto`/`UpdateCategoryId`/`UpdateClubId` calls.
- [ ] 2.2 Re-run `UpdateTeamHandlerTests` — must pass.

## 3. Regression check
- [ ] 3.1 Run the full `RFFM.Api.Tests` suite (or at minimum all `UnitTests` touching `Team`/`Coaches/Teams`) to confirm no regressions.
- [ ] 3.2 `dotnet build` passes.

## 4. Spec/process
- [ ] 4.1 `openspec validate fix-update-team-league-not-persisted --strict` still passes after adding tasks/implement.
- [ ] 4.2 Do not commit — wait for explicit user confirmation per `.claude/rules/git.md` §7.3.
