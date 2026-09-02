# Tasks — RFFM Season Selector

TDD: write the failing test first for every unit below (xUnit/Moq backend, Vitest/Testing Library
frontend), then the minimal implementation, then refactor.

## Backend (back-specialist)

1. **`RffmOptions` + config**
   - `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Options/RffmOptions.cs` (or nearest existing
     Options folder), register in `ServiceCollectionExtensions.cs`
     (`services.Configure<RffmOptions>(configuration.GetSection("Rffm"))`).
   - Add `"Rffm": { "CurrentSeasonId": 22 }` to `appsettings.Development.json` (and
     `appsettings.json` if present).
   - Verify: `dotnet build`.

2. **Replace hardcoded `21`/`"21"` with `IOptions<RffmOptions>.Value.CurrentSeasonId`**
   - `CompetitionService.GetCompetitionsAsync` — add `int? temporada = null` param.
   - `GetActa.cs`, `GetPlayer.cs`, `GetTeamCallups.cs` fallback path.
   - Unit tests: extend existing handler tests (e.g. `GetTeamMatchMinutesHandlerTests.cs`-style) to
     assert the configured season is used when no explicit season is passed. Write these tests
     first (Red), confirm they fail against the old literal, then apply the change (Green).
   - Verify: `dotnet test --filter FullyQualifiedName~Competitions|FullyQualifiedName~Acta|FullyQualifiedName~Player`.

3. **Thread `temporada` through club search/teams**
   - `ClubDirectoryService.SearchAsync` / `GetClubTeamsAsync` — add `int? temporada` param, append
     to the built URLs (§1.2 design note — verify against the live `rffm.es` endpoints and record
     the finding as a short comment).
   - `SearchClubs.cs` / `GetClubTeams.cs` route modules — add `int? temporada` query param, forward
     it, include it in the cache key.
   - Verify: `dotnet build`, manual check with `curl` against a running API for both a specified and
     omitted `temporada`.

4. **`RffmSeasonPreference` entity + migration**
   - `Domain/Entities/Federation/RffmSeasonPreference.cs`, EF configuration (unique index on
     `UserId`), `DbSet` on `FederationDbContext`.
   - `.\manage-migrations.ps1 -Context FederationDbContext -MigrationName AddRffmSeasonPreference` from
     `Back/ExtractionApi`, apply locally, verify the table lands in the `federation` schema.

5. **`GET /rffm/seasons` + `PUT /rffm/season-preference`**
   - `Features/Federation/Seasons/Services/RffmSeasonPreferenceService.cs` (+ interface).
   - `Features/Federation/Seasons/Queries/GetRffmSeasons.cs`,
     `Features/Federation/Seasons/Commands/SaveRffmSeasonPreference.cs` — `IFeatureModule`s,
     `RequireAuthorization()`, follow `FederationSettings`' command/query shape exactly.
   - xUnit handler tests: no-preference-yet returns `PreferredSeasonId: null` +
     `CurrentSeasonId` from options; save-then-get round-trips; saving twice upserts (no duplicate
     rows).
   - Verify: `dotnet test --filter FullyQualifiedName~RffmSeason`, `dotnet build`.

## Frontend (front-specialist)

6. **Shared service + context + selector**
   - `Front/src/shared/services/rffmSeasonService.ts`, `Front/src/shared/context/RffmSeasonContext.tsx`
     (`RffmSeasonProvider`, `useRffmSeason`), `Front/src/shared/components/ui/RffmSeasonSelector/`
     (`.tsx` + `.module.css`).
   - Vitest: provider seeds from `preferredSeasonId ?? currentSeasonId`; `setSeasonId` updates
     local state immediately and calls the save endpoint; selector renders the seasons list and
     calls `setSeasonId` on change. Write tests first.
   - Verify: `npm run test -- RffmSeason`.

7. **Mount the provider**
   - Wire `RffmSeasonProvider` above both apps' route trees (same level as the existing
     `UserContext` provider) so Federation and Coach share one preference.
   - Verify: `npm run build`.

8. **Wire call sites**
   - `ClubService.searchClubs` / `getClubTeams` — add optional `temporada` param, forward as query
     string.
   - `ClubSearchSection.tsx` — read `useRffmSeason()`, pass through, render `<RffmSeasonSelector />`
     in `Settings.tsx`.
   - `Acta.tsx`, `PlayerQuickViewDialog.tsx` — replace hardcoded `"21"` with `useRffmSeason()`.
   - `ClubPlayerSearch.tsx` (Coach) — add `<RffmSeasonSelector />` alongside the existing Coach
     `Season` selector, pass its value into `federationClubService.getClubTeams`.
   - Vitest per changed component (mock `rffmSeasonService`, assert the query param sent).
   - Verify: `npm run test`, `npm run build`.

## Final verification (both)

- `dotnet build && dotnet test` (backend).
- `npm run build && npm run test` (frontend).
- Manual smoke test: open `/federation/settings`, confirm the season selector loads, club search
  returns current-season results, changing the season persists after a page reload; repeat for
  Coach's `ClubPlayerSearch`.
