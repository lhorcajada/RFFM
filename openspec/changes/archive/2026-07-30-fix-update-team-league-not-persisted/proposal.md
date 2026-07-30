## Why

`Features/Coaches/Teams/Commands/UpdateTeam.cs`'s `UpdateTeamHandler.Handle` calls `team.UpdateName`, `team.UpdateUrlPhoto`, `team.UpdateCategoryId`, and `team.UpdateClubId`, but never calls `team.UpdateLeagueId`/`team.UpdateLeagueGroup`. The Front Coach app already sends `LeagueId`/`LeagueGroup` on every `PUT /api/catalog/team/{id}` call (`Front/src/apps/coach/services/teamService.ts:updateTeam`, used by `Front/src/apps/coach/pages/clubTeams/edit/EditTeam.tsx`), so a Coach who opens "Editar equipo", picks a Liga, and saves sees `200 OK` with no error — but the value is silently discarded server-side. Root cause: an incomplete field list in the handler, not a missing endpoint or a Front bug.

## What Changes

- **Root cause**: `UpdateTeamHandler.Handle` (`Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/Commands/UpdateTeam.cs`) is missing two calls: `team.UpdateLeagueId(request.TeamModel.LeagueId)` and `team.UpdateLeagueGroup(request.TeamModel.LeagueGroup)`. Both domain methods already exist on `Team` (`Domain/Aggregates/UserClubs/Team.cs`, lines 61–69) and `TeamModel` (`Domain/Models`) already carries `LeagueId`/`LeagueGroup` — `CreateTeamCommand` already passes them through at creation time, only the update path is missing them.
- **Fix**: add the two missing calls to `UpdateTeamHandler.Handle`, in the same all-or-nothing style as the other four fields already updated there (no partial/sparse update semantics change — matches `UpdateTeamCommand`'s existing all-fields-required contract).
- **Regression test**: a handler-level test that PUTs a team with a non-null `LeagueId`/`LeagueGroup` different from the team's current values, then asserts the persisted `Team` entity reflects the new values — this test MUST fail against current `main` (proving the bug) before the fix, and pass after.
- No route, request/response shape, validator rule, or permission change — `UpdateTeamCommand`/`TeamModel` already carry the fields; this is purely a handler persistence fix.

## Capabilities

### New Capabilities
- `coach-team-update-league-persistence`: `PUT /api/catalog/team/{id}` persists `LeagueId`/`LeagueGroup` changes, matching the behavior the Front Coach app already assumes and the pattern already used for `Name`/`CategoryId`/`ClubId`/`UrlPhoto`.

### Modified Capabilities
(none — no existing `openspec/specs/` capability covers `UpdateTeam` today; this fix is documented as a new capability spec rather than a delta)

## Impact

- **Backend**: one file changed, `Features/Coaches/Teams/Commands/UpdateTeam.cs` (`UpdateTeamHandler.Handle` — two added method calls). No domain, migration, route, or DTO changes — `Team.UpdateLeagueId`/`UpdateLeagueGroup` and `TeamModel.LeagueId`/`LeagueGroup` already exist and are unchanged.
- **Frontend**: none. `Front/src/apps/coach/services/teamService.ts:updateTeam` and `EditTeam.tsx` already send the correct payload today — they need no changes, they were already correct; only the backend was silently dropping the data.
- **Tests**: new/updated test(s) covering `UpdateTeamHandler` persisting `LeagueId`/`LeagueGroup`, following this repo's TDD requirement (test written first, confirmed failing against the current handler, then the fix makes it pass).
- **Out of scope**: this fix is unrelated to `openspec/changes/mobile-league-standings-calendar`'s new `RffmCompetitionId`/`RffmGroupId` fields and `UpdateTeamCompetition` command — those are a different pair of fields on `Team`, proposed in a separate change. This fix only concerns the pre-existing `LeagueId`/`LeagueGroup` (local `Leagues` catalog) fields already present on `UpdateTeamCommand`/`TeamModel` today.
