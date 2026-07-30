# Implement: mobile-league-standings-calendar (backend only)

Self-contained technical script for the backend slice of this change. Front SPA (Coach) and
Mobile client work are explicitly out of scope — see proposal.md "Impact".

## Conventions to follow

- Vertical slice: one feature = one `.cs` file (`IFeatureModule` + request + command/query +
  handler + validator, all in the same file), matching `Features/Mobile/Players/Queries/GetPlayerSeasonCards.cs`
  and `Features/Mobile/Attendance/Queries/GetEventAttendanceRoster.cs`.
- `ICommand`/`IRequest` for writes, `IQueryApp<T>` for reads.
- FluentValidation validator required for the write command.
- `ProblemDetails` for all errors — `KeyNotFoundException` for "not found" (already mapped
  globally, same as `UpdateTeamHandler`/`DeleteTeamHandler`).
- Auth: `IRequireFeaturePermission` (+ `IRequireTeamMembership` for the three Mobile queries),
  same shape as `GetPlayerSeasonCards`/`GetEventAttendanceRoster`.
- `AppDbContext` only (schema `app`) — no Identity/Federation context involved.
- Tests: xUnit, real Postgres via `PostgresContainerFixture`/`PostgresCollection` (Testcontainers
  + Podman) for anything touching `AppDbContext`; `Moq` for `ICompetitionService`/`ICalendarService`
  in the three query handler tests (no real HTTP/scrape in tests).

## Step 1 — Domain + migration (see tasks.md §1)

1. `Domain/Aggregates/UserClubs/Team.cs`: add `RffmCompetitionId`/`RffmGroupId` (`int?`,
   private setter), set from `TeamModelBase` in the constructor, add
   `UpdateRffmCompetitionId`/`UpdateRffmGroupId` methods (mirror `UpdateLeagueId`/`UpdateLeagueGroup`
   exactly — no extra validation, these are plain external ids).
2. `Domain/Models/TeamModelBase.cs`: add the two matching optional properties.
3. `Features/Coaches/Teams/Commands/CreateTeam.cs`: `CreateTeamCommand` gains the two optional
   properties; `CreateTeamHandler` passes them into the `TeamModel` it builds.
4. `Infrastructure/Persistence/Configuration/Aggregates/UserClubs/TeamEntityConfiguration.cs`:
   configure both as `IsRequired(false)`, no `HasOne`/FK (external RFFM ids, no local table).
5. Generate the migration:
   ```
   cd Back/ExtractionApi
   dotnet ef migrations add AddRffmCompetitionAndGroupToTeam \
     --project src/RFFM.Api/RFFM.Api.csproj \
     --startup-project src/RFFM.Host/RFFM.Host.csproj \
     --context RFFM.Api.Infrastructure.Persistence.AppDbContext \
     --output-dir Infrastructure/Migrations \
     -- --connection-string-key FutbolBaseConnection
   ```
   This is the same shape `manage-migrations.ps1 -Action create -Context AppDbContext` runs
   under the hood; the direct `dotnet ef` invocation is used because it doesn't require an
   interactive prompt. Verify the generated `Up()`/`Down()` only touch `app.Teams` with two
   nullable `integer` columns, no FK, no unrelated diff (the model snapshot can drift on this
   repo — inspect the diff, don't just trust "it succeeded").
6. `dotnet build` — must be clean (pre-existing nullable warnings elsewhere are fine, no new
   errors).

## Step 2 — `UpdateTeamCompetition` command (see tasks.md §2)

New file: `Features/Coaches/Teams/Commands/UpdateTeamCompetition.cs`.

- Route: `PUT api/catalog/team/{id}/competition`. Binds `id` from the route into the command
  (same pattern as `UpdateTeam.cs`: `command.Id = id` before `mediator.Send`).
- `UpdateTeamCompetitionCommand : IRequest, IInvalidateCacheRequest, IRequireFeaturePermission`:
  `string Id`, `int? RffmCompetitionId`, `int? RffmGroupId`.
  `PrefixCacheKey => TeamConstants.CachePrefix`, `FeatureRoute => CoachFeatureRoutes.ClubTeams`
  (reused, no new route constant — `ClubTeams` already has Coach/ClubDirector `ReadWrite` seed
  rows, confirm no new `WebApplicationExtensions.cs` seeding is needed for this command),
  `RequiredPermission => "ReadWrite"`.
- Handler: load `Team` **tracked** (no `AsNoTracking`) by `Id`; `KeyNotFoundException` if not
  found; `team.UpdateRffmCompetitionId(request.RffmCompetitionId)`;
  `team.UpdateRffmGroupId(request.RffmGroupId)`; `SaveChangesAsync`. Always sets both fields
  from the request (all-or-nothing, matching `UpdateTeamCommand`'s style) — `null` is a valid,
  explicit "clear" value for either.
- Validator: `RuleFor(r => r.RffmCompetitionId).GreaterThan(0).When(r => r.RffmCompetitionId.HasValue)`;
  same for `RffmGroupId`. No DB round-trip in the validator (per design.md Decision 7 — no
  server-side pair verification against `ICompetitionService` in this iteration).
- Test first (RED): `tests/RFFM.Api.Tests/UnitTests/UpdateTeamCompetitionHandlerTests.cs`,
  seeding a `Team` the same way `GetPlayerSeasonCardsHandlerTests.SeedTeamAsync` does (Club →
  Season → Team). Cases: sets both ids on a fresh team; clears both ids on an already-associated
  team (independently settable — verify a team with only `RffmCompetitionId` set can have just
  that one cleared while leaving `RffmGroupId` untouched is NOT required — the command sets both
  every call, per design; test the "set both" and "clear both" paths); nonexistent `Id` throws
  `KeyNotFoundException`.

## Step 3 — Mobile competition-data queries (see tasks.md §3)

New folder: `Features/Mobile/Competitions/Queries/`.

1. `Domain/Entities/CoachFeatureRoutes.cs`: add `CompetitionData = "/mobile/competition-data"`.
2. `src/RFFM.Host/DependencyInjection/WebApplicationExtensions.cs`: seed `FeaturePermission`
   rows `("CompetitionData", CoachFeatureRoutes.CompetitionData, "Player", 1, false)`,
   same for `"FamilyMember"` and `"Coach"` — copy the `PlayerSeasonCards` block's comment style.
3. `GetTeamClassification.cs`:
   - `GET /api/mobile/teams/{teamId}/classification`.
   - `MobileClassificationQuery : IQueryApp<MobileClassificationDto>, IRequireFeaturePermission, IRequireTeamMembership`
     (`FeatureRoute => CoachFeatureRoutes.CompetitionData`, `RequiredPermission => "Read"`).
   - DTOs: `MobileClassificationDto(List<MobileClassificationRowDto> Teams)`,
     `MobileClassificationRowDto(int Position, string TeamId, string TeamName, string ImageUrl,
     int Played, int Won, int Drawn, int Lost, int GoalsFor, int GoalsAgainst, int Points)` —
     parse the `string` fields of `TeamResponse` to `int` with a safe `TryParse`-based helper
     (`0` fallback), matching design.md Decision 5.
   - Handler: `AppDbContext.Teams.AsNoTracking().SingleOrDefaultAsync(t => t.Id == teamId, ct)`;
     if `Team` is null, throw the same `KeyNotFoundException`/`DomainException` convention used
     elsewhere in Mobile (`GetEventAttendanceRoster.cs`'s `DomainException` pattern) — **not**
     the same as "not associated"; a nonexistent `{teamId}` is a real 404, an unassociated team
     is a 200 with empty data. If `RffmCompetitionId`/`RffmGroupId` is `null`, return
     `new MobileClassificationDto([])` without calling `ICompetitionService`. Otherwise call
     `ICompetitionService.GetClassification(team.RffmGroupId.Value, ct)` and project.
4. `GetTeamCalendar.cs`: same shape, `GET /api/mobile/teams/{teamId}/calendar`,
   `MobileCalendarDto(List<MobileCalendarMatchDayDto> MatchDays)`,
   `MobileCalendarMatchDayDto(DateTime Date, int MatchDayNumber, List<MobileMatchDto> Matches)`,
   `MobileMatchDto(DateTime Date, string Time, string LocalTeamName, string LocalTeamImageUrl,
   int? LocalGoals, string VisitorTeamName, string VisitorTeamImageUrl, int? VisitorGoals,
   string Status)` (goals nullable — empty string in the source means "not played yet", parsed
   to `null`, not `0`, so Mobile can distinguish 0-0 from not-played). Calls
   `ICalendarService.GetCalendarAsync(team.RffmCompetitionId.Value, team.RffmGroupId.Value, ct)`.
5. `GetTeamNextMatch.cs`: `GET /api/mobile/teams/{teamId}/next-match`,
   `MobileNextMatchDto(MobileMatchDto? Match)` (null `Match` = no upcoming fixture or
   unassociated team). Reuses the same `Team` resolution + `ICalendarService.GetCalendarAsync`
   call (no second scrape, no dependency on `GetTeamCalendar`'s handler — small acceptable
   duplication of the projection helper, or extract a `private static` mapping method reused by
   both if trivial). "Unplayed" predicate: `match.Date.Date >= DateTime.UtcNow.Date &&
   !(HasGoals(match.LocalGoals) && HasGoals(match.VisitorGoals))`, earliest by
   `(Date, ParsedTime)` ascending across all matchdays. Document the predicate choice in an XML
   doc comment referencing design.md's Open Questions (unverified against live scrape data).
6. Tests first (RED) for each handler, `Moq`-ing `ICompetitionService`/`ICalendarService`
   (interfaces only — no HTTP), plus a real `Team` row via `PostgresContainerFixture` to
   exercise the actual `AsNoTracking` lookup and the null-id short-circuit. See tasks.md §3 for
   the exact case list per handler.

## Step 4 — Verification

```
cd Back/ExtractionApi
dotnet build
DOCKER_HOST=npipe://./pipe/podman-machine-default dotnet test
```

(Docker connectivity quirk observed in this environment: the `docker`/`podman` CLI itself needs
`DOCKER_HOST=npipe:////./pipe/podman-machine-default` — 4 slashes — to connect from a Git-Bash
shell, but the .NET `Docker.DotNet` client used internally by Testcontainers needs the opposite:
the plain 2-slash form `npipe://./pipe/podman-machine-default` that `docker context ls` prints.
4 slashes makes `Docker.DotNet` throw `InvalidOperationException: The endpoint is not a npipe
URI`. Use 2 slashes for `dotnet test`. Not needed at all from PowerShell with the context
already selected.)

Confirm 100% pass, no skipped tests, no regressions outside the new files. Do not commit —
report the diff and results back to the user for explicit go-ahead per `.claude/rules/git.md §7.3`.
