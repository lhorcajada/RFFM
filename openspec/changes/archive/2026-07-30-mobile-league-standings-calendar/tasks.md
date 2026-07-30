## 1. Backend: `Team` domain + migration

- [x] 1.1 Add `RffmCompetitionId` (`int?`) and `RffmGroupId` (`int?`) to `Domain/Aggregates/UserClubs/Team.cs`, with `UpdateRffmCompetitionId`/`UpdateRffmGroupId` intent-revealing methods mirroring `UpdateLeagueId`/`UpdateLeagueGroup`. Both set from `TeamModelBase` in the `Team(TeamModelBase model)` constructor too, so a team can optionally be associated at creation.
  - `Domain/Aggregates/UserClubs/Team.cs`, `Domain/Models/TeamModelBase.cs` (new optional properties), `Features/Coaches/Teams/Commands/CreateTeam.cs` (`CreateTeamCommand` gains the two properties, `CreateTeamHandler` passes them into `TeamModel`).
- [x] 1.2 `TeamEntityConfiguration.cs`: configure both new properties as optional (`IsRequired(false)`), no FK — mirrors `LeagueGroup`'s existing plain-`int?`-no-FK shape.
- [x] 1.3 Generate EF migration `AddRffmCompetitionAndGroupToTeam` via `dotnet ef migrations add AddRffmCompetitionAndGroupToTeam --project src/RFFM.Api/RFFM.Api.csproj --startup-project src/RFFM.Host/RFFM.Host.csproj --context RFFM.Api.Infrastructure.Persistence.AppDbContext --output-dir Infrastructure/Migrations -- --connection-string-key FutbolBaseConnection` (same invocation shape as `manage-migrations.ps1 -Action create -Context AppDbContext`). Verified the generated migration only adds the two nullable `integer` columns to `app.Teams`, no FK, no unrelated diff.
  - `src/RFFM.Api/Infrastructure/Migrations/20260729114727_AddRffmCompetitionAndGroupToTeam.cs` (+ `.Designer.cs`), `AppDbContextModelSnapshot.cs` updated by the `dotnet ef` tool.

## 2. Backend: `UpdateTeamCompetition` command (Coach)

- [x] 2.1 (RED) xUnit test for the handler: existing team gets `RffmCompetitionId`/`RffmGroupId` persisted; both can be independently cleared to `null`; nonexistent `{id}` throws `KeyNotFoundException` (mirrors `UpdateTeamHandler`'s existing convention, mapped to `404` by the global `ProblemDetails` middleware).
  - `tests/RFFM.Api.Tests/UnitTests/UpdateTeamCompetitionHandlerTests.cs` (real-Postgres-container style, same `PostgresContainerFixture`/`SeedTeamAsync` shape as `GetPlayerSeasonCardsHandlerTests`).
- [x] 2.2 (GREEN) Implement `UpdateTeamCompetition.cs` — `PUT api/catalog/team/{id}/competition`, vertical slice: `IFeatureModule` + `UpdateTeamCompetitionCommand : IRequest, IInvalidateCacheRequest, IRequireFeaturePermission` (reuses `CoachFeatureRoutes.ClubTeams`, `RequiredPermission = "ReadWrite"`, `PrefixCacheKey = TeamConstants.CachePrefix`) + `Handler` + `Validator` (`GreaterThan(0).When(...)` on both ids, format-only, no DB round-trip).
  - `src/RFFM.Api/Features/Coaches/Teams/Commands/UpdateTeamCompetition.cs`.
- [x] 2.3 (REFACTOR) Confirmed handler mirrors `UpdateTeamHandler`'s load/mutate/save shape exactly; no extraction needed (single-file vertical slice).
- [x] 2.4 Run the new test file — passes; no regression in `UpdateTeamHandlerTests`/`CreateTeam`-adjacent tests (none pre-existed for those, confirmed via `dotnet test --filter Team`).

## 3. Backend: Mobile competition-data queries

- [x] 3.1 New `CoachFeatureRoutes.CompetitionData = "/mobile/competition-data"` constant; seeded `FeaturePermission` rows (Read, value `1`) for `Player`, `FamilyMember`, `Coach` in `WebApplicationExtensions.cs`, mirroring the `PlayerSeasonCards` block.
  - `Domain/Entities/CoachFeatureRoutes.cs`, `src/RFFM.Host/DependencyInjection/WebApplicationExtensions.cs`.
- [x] 3.2 (RED) `GetTeamClassification`: xUnit tests — team with `RffmCompetitionId`/`RffmGroupId` set returns the `ICompetitionService.GetClassification` result projected to the Mobile DTO (service mocked with `Moq`); team with either id `null` returns an explicit empty result without calling the service.
  - `tests/RFFM.Api.Tests/UnitTests/GetTeamClassificationHandlerTests.cs`.
- [x] 3.3 (GREEN) `Features/Mobile/Competitions/Queries/GetTeamClassification.cs` — `GET /api/mobile/teams/{teamId}/classification`, `IQueryApp<MobileClassificationDto>` + `IRequireFeaturePermission` (`CompetitionData`, Read) + `IRequireTeamMembership`. Handler loads `Team` via `AppDbContext.AsNoTracking()`, short-circuits to an empty DTO when either RFFM id is `null`, otherwise calls `ICompetitionService.GetClassification(groupId, ct)` and projects to `MobileClassificationDto`/`MobileClassificationRowDto` (numeric-looking `string` fields parsed to `int` with `0` fallback per design.md Decision 5).
- [x] 3.4 (RED) `GetTeamCalendar`: same pattern — associated team returns `ICalendarService.GetCalendarAsync` projected to matchdays/matches; unassociated team returns empty matchdays without calling the service.
  - `tests/RFFM.Api.Tests/UnitTests/GetTeamCalendarHandlerTests.cs`.
- [x] 3.5 (GREEN) `Features/Mobile/Competitions/Queries/GetTeamCalendar.cs` — `GET /api/mobile/teams/{teamId}/calendar`, same auth shape, `MobileCalendarDto`/`MobileCalendarMatchDayDto`/`MobileMatchDto`.
- [x] 3.6 (RED) `GetTeamNextMatch`: associated team with a calendar containing an unplayed match on/after today returns the earliest such match; a team whose only remaining matches are in the past, or whose matches are all already played (goals present), or who is unassociated, returns an empty/null result — all without throwing.
  - `tests/RFFM.Api.Tests/UnitTests/GetTeamNextMatchHandlerTests.cs`.
- [x] 3.7 (GREEN) `Features/Mobile/Competitions/Queries/GetTeamNextMatch.cs` — derives from the same `ICalendarService.GetCalendarAsync` call (no second scrape), "unplayed" predicate: `Date.Date >= DateTime.UtcNow.Date` AND not both `LocalGoals`/`VisitorGoals` populated (documented in the handler's XML doc as an implementation-time judgment call per design.md Open Questions).
- [x] 3.8 (REFACTOR) Confirmed all three handlers use the identical `Team` lookup shape; not extracted to a shared `FeatureService` per design.md Decision 2 (three call sites of one simple lookup isn't enough duplication).

## 4. Verification

- [x] 4.1 `dotnet build` — 0 errors.
- [x] 4.2 `dotnet test` (full suite, real Postgres container via Testcontainers/Podman). Docker connectivity note: the `docker` CLI itself needs `DOCKER_HOST=npipe:////./pipe/podman-machine-default` (4 slashes) to work from this Git-Bash shell, but the .NET `Docker.DotNet`/Testcontainers library used by `PostgresContainerFixture` needs the opposite — the plain 2-slash `DOCKER_HOST=npipe://./pipe/podman-machine-default` that `docker context ls` prints (4 slashes made `Docker.DotNet` throw `InvalidOperationException: The endpoint is not a npipe URI`). Use 2 slashes for `dotnet test`, 4 for the `docker`/`podman` CLI in this shell — 100% pass, no regressions.
- [x] 4.3 Confirmed via `git status` — only `Back/ExtractionApi/` and `openspec/` changed; no `Front/`/`Mobile/` files touched (out of scope, coordinated separately).
- [ ] 4.4 Front SPA (Coach) chained competition/group selector calling `PUT /api/catalog/team/{id}/competition` — out of scope for this backend task, left for `front-specialist`.
- [ ] 4.5 Mobile screens consuming the three `mobile-competition-data` endpoints — out of scope for this backend task, left for `mobile-specialist`.
