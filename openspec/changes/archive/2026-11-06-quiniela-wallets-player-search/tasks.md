## Step 1: Return associated players from the wallets endpoint

- [x] Step 1: Return associated players from the wallets endpoint

**Routing**: category=backend · context=medium · difficulty=medium

**Files Affected**:
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Quiniela/QuinielaSupport.cs
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Quiniela/GetQuinielaWallets.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/QuinielaTestSupport.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/QuinielaWalletHandlerTests.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/QuinielaEndpointTests.cs
- M Back/ExtractionApi/Directory.Build.props — minor version bump (`feat`)

**What Will Be Done**: Implement design Decisions 1 to 4 for `specs/quiniela-wallet/spec.md`. Add `QuinielaAssociatedPlayerDto` and the new last member `AssociatedPlayers` to `QuinielaWalletSummaryDto` in `QuinielaSupport.cs`. In the handler, keep the participant query and add the two batched `AsNoTracking()` reads (family links joined to team player and player; team players of the Player rows' `LinkedTeamPlayerId`), both restricted to the requested team and to the participant user ids, as the design describes. Group in memory by user id, build the name from `Name` and `LastName` as `GetTeamUsers.cs` does, order by name then id, and pick the source by row role. Extend `QuinielaTestSupport` with seeding of team players, players, family links and player links, imitating `SeedPlayerAsync` in `AvailabilityTestSupport.cs` and the `TeamPlayerFamilyMember.Create` usage in `AvailabilityNotificationTests.cs`. Bump `<Version>` in `Directory.Build.props` by one minor.

**Testing Strategy**: Write the handler tests first (RED): family member with one and with several players, family member linked to a player of another team, family member without players, family member without wallet, Player row with and without link, Coach row that is also a family member. Add one endpoint test that reads the raw JSON of the list and asserts the `associatedPlayers` property name, reusing `StartHostAsync`. Reviewed consumers: `GetQuinielaWallets.cs` is the only construction site of the DTO, and `QuinielaWalletHandlerTests.cs` reads typed properties only, so existing tests stay compatible. Run `dotnet test` scoped to the Quiniela tests.

**Existing Tests Broken**: None

## Step 2: Front types and the pure search filter

- [x] Step 2: Front types and the pure search filter

**Routing**: category=frontend-code · context=small · difficulty=medium

**Files Affected**:
- M Front/src/apps/coach/services/quinielaService.ts
- A Front/src/apps/coach/pages/quiniela/walletSearch.ts
- A Front/src/apps/coach/pages/quiniela/__tests__/walletSearch.test.ts
- M Front/src/apps/coach/pages/quiniela/__tests__/QuinielaWallets.test.tsx — fixtures gain the new required field

**What Will Be Done**: Add the `QuinielaAssociatedPlayer` type and the required `associatedPlayers` field to `QuinielaWalletSummary` in `quinielaService.ts`, as plain `type` aliases like the neighbours. Create `walletSearch.ts` with `normalizeSearchText` and `filterWallets` following design Decision 5, copying the idea (not the code import) of the accent-insensitive helper in the federation `SquadHistory.tsx`. Update the typed fixtures in `QuinielaWallets.test.tsx` so they keep typechecking; their assertions do not change.

**Testing Strategy**: Write `walletSearch.test.ts` first (RED), with Spanish test names: case, accents and repeated or edge spaces ignored, match by user name, match by any associated player name, blank or spaces-only query returns the list unchanged, union without duplicates in original order, matched rows keep all their players, no match returns an empty list. Reviewed paths: `QuinielaWallets.test.tsx` has a typed fixture and needs the field to typecheck (vitest itself does not typecheck); `Front/src/apps/coach/services/__tests__/quinielaService.test.ts` uses untyped mock data and stays compatible; `QuinielaWallets.tsx` only references the type and is compatible. Run `npx vitest run` on the two test paths.

**Existing Tests Broken**:
- `Front/src/apps/coach/pages/quiniela/__tests__/QuinielaWallets.test.tsx` — compile

## Step 3: Search box and players area on the wallets list page

- [x] Step 3: Search box and players area on the wallets list page

**Routing**: category=frontend-ui · context=medium · difficulty=medium

**Files Affected**:
- M Front/src/apps/coach/pages/quiniela/QuinielaWallets.tsx
- M Front/src/apps/coach/pages/quiniela/QuinielaWallets.module.css
- M Front/src/apps/coach/pages/quiniela/__tests__/QuinielaWallets.test.tsx
- M Front/package.json — minor version bump (`feat`)

**What Will Be Done**: Implement design Decisions 5 and 6 for the requirements of `specs/quiniela-wallet/spec.md`. In the page keep the query in local state and derive the visible rows with `filterWallets` in a `useMemo`. Render a MUI `TextField` with a start search adornment above the list after loading, following the pattern in `Front/src/apps/coach/pages/lottery/Lottery.tsx`, with an accessible label. Render the players area inside the existing inline card only when the row has players, and the separate "no results" message when rows exist but none match, keeping the existing empty-team message. Add the new classes to the existing CSS module using theme tokens and wrapping text, with no table and no inline styles. Bump the version in `Front/package.json` by one minor.

**Testing Strategy**: Extend `QuinielaWallets.test.tsx` first (RED), with `getByRole` queries and Spanish test names: players area for one and for several players, none for Coach and for a family member without players, search by player name shows the player and the family rows, search by family member keeps all its players, accent and case insensitive, empty and spaces-only text shows all rows, "no results" differs from the empty-team message, empty team shows its message even with text, and typing triggers no extra call to the mocked `getQuinielaWallets`. The 360 px layout is a manual check. Reviewed paths: the existing page tests keep their assertions because nothing in the loaded flow changes for rows without players. Run `npx vitest run` on the page test, then the full Front suite and `npm run build` once at the end of the whole change.

**Existing Tests Broken**: None

## Required Documentation

### Spec files
- openspec/changes/quiniela-wallets-player-search/specs/quiniela-wallet/spec.md
- openspec/specs/quiniela-wallet/spec.md

### Local files
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Quiniela/GetQuinielaWallets.cs — handler and sole construction site of the DTO; the code to extend.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Quiniela/QuinielaSupport.cs — holds the DTO, `ParticipantRoles` and the team-restricted family link query to imitate.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Users/Queries/GetTeamUsers.cs — existing player display name expression to reuse.
- Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/UserTeam.cs — `LinkedTeamPlayerId` and `LinkPlayer`, accepted only for Player and FamilyPlayer roles.
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/TeamPlayers/TeamPlayerFamilyMember.cs — one row per family member and player pair; source of family rows.
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/TeamPlayers/TeamPlayer.cs — team player with reference to the player.
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Players/Player.cs — `Name`, `LastName` and `Alias` of a player.
- Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/QuinielaWalletHandlerTests.cs — current list tests and `List` helper to extend.
- Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/QuinielaTestSupport.cs — `SeedTeamAsync` creates user teams only; needs player and family seeding.
- Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/AvailabilityTestSupport.cs — pattern to create `Player` and `TeamPlayer` in tests.
- Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/AvailabilityNotificationTests.cs — usage of `TeamPlayerFamilyMember.Create` and `LinkPlayer`.
- Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/QuinielaEndpointTests.cs — test host and endpoint contract tests.
- Back/ExtractionApi/Directory.Build.props — API `<Version>` to bump (currently 1.47.0).
- Front/src/apps/coach/pages/quiniela/QuinielaWallets.tsx — list page with inline rows, empty state and no search today.
- Front/src/apps/coach/pages/quiniela/QuinielaWallets.module.css — existing responsive card classes to extend.
- Front/src/apps/coach/pages/quiniela/__tests__/QuinielaWallets.test.tsx — mocks and typed fixtures of the page tests.
- Front/src/apps/coach/services/quinielaService.ts — wallet summary type and `getQuinielaWallets`.
- Front/src/apps/coach/services/__tests__/quinielaService.test.ts — untyped mock data; stays compatible.
- Front/src/apps/coach/pages/lottery/Lottery.tsx — MUI search field with start adornment icon to imitate.
- Front/src/apps/federation/pages/SquadHistory/SquadHistory.tsx — accent-insensitive search precedent; local helper, context only.
- Front/package.json — web version to bump (currently 1.111.0).
- GLOSSARY.md — defines "Jugador asociado" and "Monedero" for naming.

### External URLs
None

## Implementation Context

**Stack**: Backend .NET 9, ASP.NET Core Minimal API with Mediator and EF Core 9 on PostgreSQL, xUnit tests. Frontend React 19, TypeScript 5.5 strict, MUI v5, CSS Modules, Vitest 4 with Testing Library.

**Conventions**:
- Backend feature is one vertical slice file; the handler reads with `AsNoTracking()` and never calls `SaveChangesAsync()`; DTOs are positional records in `QuinielaSupport.cs`.
- Backend handler tests use an in-memory `AppDbContext` seeded through `QuinielaTestSupport.SeedTeamAsync`, and create players with the `AvailabilityTestSupport` pattern.
- Frontend API calls live in `apps/coach/services/*Service.ts` with response types as `type` aliases next to the call; pages never call Axios directly.
- Frontend tests live in a `__tests__/` folder beside the code, use `vi.mock` for services, `getByRole` queries and Spanish sentence names.
- Styles use the page's CSS Module and theme tokens; user-visible text is Spanish and lists are cards, never tables.

**Avoid**: `any` in TypeScript; MUI `Table` or any fixed-column grid for the list; `styled()` or inline `style={{}}`; per-row database queries inside a loop; calling `SaveChangesAsync()` in a handler; importing `Front` code from `Mobile` or the reverse.

**Test Command**: Backend `dotnet test Back/ExtractionApi/tests/RFFM.Api.Tests --filter FullyQualifiedName~<TestName>` (omit the filter for the whole project). Frontend `cd Front && npx vitest run <test-file-path>` (whole suite: `cd Front && npm run test`).
