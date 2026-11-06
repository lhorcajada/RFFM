## Target State

The change converges on one extended response row and one filtered list page.

The wallets endpoint `GET /api/teams/{teamId}/quiniela/wallets` returns rows with one new field, `associatedPlayers`; route and parameters are unchanged:

```json
[
  {
    "userId": "6f1c...",
    "userName": "Marta Perez",
    "role": "FamilyPlayer",
    "balance": 12.50,
    "associatedPlayers": [
      { "id": "a1b2...", "name": "Jose Perez" },
      { "id": "c3d4...", "name": "Lucia Perez" }
    ]
  },
  { "userId": "...", "userName": "Jose Perez", "role": "Player", "balance": 0.00,
    "associatedPlayers": [ { "id": "a1b2...", "name": "Jose Perez" } ] },
  { "userId": "...", "userName": "Ana Coach", "role": "Coach", "balance": 3.00,
    "associatedPlayers": [] }
]
```

On the web, the coach wallets list page shows a search box above the card list. Each card keeps its name, role and balance and, when the row has associated players, a players area listing every name. Typing filters the already loaded rows in the browser.

### Architecture Snapshot

#### External Surfaces

- `GET /api/teams/{teamId}/quiniela/wallets` (Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Quiniela/GetQuinielaWallets.cs): response row gains `associatedPlayers: { id, name }[]`; existing fields, route, parameters and authorization unchanged.
- Wallets list page `Front/src/apps/coach/pages/quiniela/QuinielaWallets.tsx`: gains a search box and a players area per card; same route and menu entry "Monederos del equipo".

#### Internal Public Surfaces

- `QuinielaWalletSummaryDto` and new `QuinielaAssociatedPlayerDto` in `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Quiniela/QuinielaSupport.cs`: the DTO gains `AssociatedPlayers`; the handler fills it.
- `QuinielaWalletSummary` and new `QuinielaAssociatedPlayer` types in `Front/src/apps/coach/services/quinielaService.ts`: mirror the response row.
- `Front/src/apps/coach/pages/quiniela/walletSearch.ts` (new): `normalizeSearchText(text)` and `filterWallets(wallets, query)`, pure functions consumed by the list page.

### File Manifest

- M Back/ExtractionApi/Directory.Build.props (Step 1)
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Quiniela/GetQuinielaWallets.cs (Step 1)
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Quiniela/QuinielaSupport.cs (Step 1)
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/QuinielaEndpointTests.cs (Step 1)
- M Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/QuinielaTestSupport.cs (Step 1)
- M Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/QuinielaWalletHandlerTests.cs (Step 1)
- M Front/package.json (Step 3)
- M Front/src/apps/coach/pages/quiniela/QuinielaWallets.module.css (Step 3)
- M Front/src/apps/coach/pages/quiniela/QuinielaWallets.tsx (Step 3)
- M Front/src/apps/coach/pages/quiniela/__tests__/QuinielaWallets.test.tsx (Step 2, Step 3)
- A Front/src/apps/coach/pages/quiniela/__tests__/walletSearch.test.ts (Step 2)
- A Front/src/apps/coach/pages/quiniela/walletSearch.ts (Step 2)
- M Front/src/apps/coach/services/quinielaService.ts (Step 2)

## Context

The page "Monederos del equipo" lists the team participants (roles Coach, Player, FamilyPlayer) as inline cards with name, role and balance. A family member card does not say which player the member belongs to, and there is no way to find the family members of a player.

Current code facts that shape the design:

- The handler `GetQuinielaWallets.Handler` reads `UserTeams` of the team filtered by `ParticipantRoles`, resolves user names, and builds `QuinielaWalletSummaryDto(UserId, UserName, Role, Balance)`.
- The user of a Player (and of a FamilyPlayer) has one nullable `UserTeam.LinkedTeamPlayerId`, set by `UserTeam.LinkPlayer` for those two roles only.
- A family member can be linked to several players of the team through `TeamPlayerFamilyMember` (one row per member-player pair: `LinkedUserId`, `TeamPlayerId`). `QuinielaSupport.LoadParticipantsAsync` already restricts those rows with `TeamPlayer.TeamId == teamId`.
- A player's display name already exists as `Name` + `LastName` trimmed in `Features/Coaches/Users/Queries/GetTeamUsers.cs`; `Alias` is not used there.
- Rows of the list are rendered by the page itself; `WalletCard.tsx` is the participant's own "Mi monedero" card and is not part of the list.
- The page has no search or filter today. An accent-insensitive search precedent exists only as a local, unexported helper in the federation app (`SquadHistory.tsx`).
- The existing list tests build rows through `QuinielaTestSupport.SeedTeamAsync`, which creates `UserTeam` rows without `LinkPlayer` and without team players or family links; the front test fixtures are typed `QuinielaWalletSummary[]`.

## Goals / Non-Goals

Goals:

- Return the associated players of each row in the existing wallets response, with no new endpoint and no database change.
- Show them in each card and let the coach search the loaded list by player or family member name, ignoring case, accents and extra spaces.
- Keep the card layout responsive (no table), readable at 360 px.

Non-Goals:

- out of scope: showing associated players or search on the Mobile app — revisit when Mobile gets a team wallets list (no Mobile consumer of this endpoint exists).
- out of scope: server-side search or pagination of the wallets list — revisit when a team's participant count makes the full list slow to load.
- out of scope: a shared search component for the coach app — revisit when a second coach page needs the same box.
- No change to other quiniela endpoints, to `WalletCard.tsx`, or to the database schema.

## Decisions

### Decision 1: Associated players come from a different link per role

- Player row: the player record of `UserTeam.LinkedTeamPlayerId`, kept only when that team player belongs to the requested team; no link means an empty list.
- FamilyPlayer row: every player of the requested team reachable through `TeamPlayerFamilyMember.LinkedUserId == userId`, ignoring `UserTeam.LinkedTeamPlayerId` of that user.
- Coach row: always empty, decided by the row's role, even if that user is also a family member of a player.

The rule is applied per row role, never per user, so a user who appears as Coach and as family member in the same team gets an empty list on the Coach row.

**Record family**: ddr
**Provenance**: user

Alternatives considered: (a) use `UserTeam.LinkedTeamPlayerId` for family members too — rejected because it holds a single player and the spec requires all linked players; (b) union both links for family rows — rejected because approval of a family account sets both links to the same player in practice, so the union adds no player and hides a bad link. The family table is the one that can hold several players, so it is the source of truth for family rows.

### Decision 2: Two extra batched queries in the handler, no per-row queries

The handler keeps its participant query and adds exactly two reads, both scoped to the requested team and to the participant user ids: one over `TeamPlayerFamilyMember` joined to `TeamPlayer` and `Player` for FamilyPlayer rows, and one over `TeamPlayers` joined to `Player` for the `LinkedTeamPlayerId` values of Player rows. Both use `AsNoTracking()`. Results are grouped in memory by user id and attached while building the DTOs.

**Provenance**: derived

### Decision 3: Player display name is `Name` + `LastName` trimmed, computed in memory

The query projects `Name` and `LastName`; the name is built in memory as `$"{Name} {LastName}".Trim()`, matching `GetTeamUsers.cs`. `Alias` is not used. The associated players of a row are ordered by name, then by id, so the response is deterministic.

**Provenance**: derived

### Decision 4: `AssociatedPlayers` is a new record list on the existing DTO

`QuinielaWalletSummaryDto` gains `IReadOnlyList<QuinielaAssociatedPlayerDto> AssociatedPlayers`, and `QuinielaAssociatedPlayerDto(Guid Id, string Name)` is added next to it. `Id` is the `TeamPlayer` id (the team-scoped record both links point to). The list is never null: rows without players carry an empty list. Existing fields keep their names and order, so current clients keep working.

**Provenance**: derived

### Decision 5: Search is a pure client-side filter in its own module

`walletSearch.ts` exports `normalizeSearchText` (lowercase, Unicode NFD with combining marks removed, runs of whitespace collapsed to one space, trimmed) and `filterWallets(wallets, query)`. A row matches when the normalized query is a substring of the normalized user name or of the normalized name of any associated player. A blank query returns the list unchanged. Rows are returned in the original order, once each, with all their associated players intact, because the filter selects rows and never edits them.

The page holds the query in local state and derives the visible rows with `useMemo`; typing triggers no request. The helper lives beside the page instead of in `shared/` because only the coach wallets page uses it, and the federation helper is local and unexported.

**Provenance**: derived

### Decision 6: Page states and copy

The search box is a MUI `TextField` with an accessible label ("Buscar por jugador o familiar") rendered above the list once data has loaded. Empty states are separate:

- no participants loaded: "No hay participantes en el equipo" (unchanged), regardless of the search text;
- participants exist but none match: "No se encontraron resultados".

Each card shows a players area (a short labelled list of names, wrapping inside the card) only when the row has associated players. Styles go in the existing `QuinielaWallets.module.css`, using theme tokens and the existing responsive card classes; no table and no inline styles.

**Provenance**: derived

### Decision 7: Test fixtures and seeds are extended, not replaced

Backend: `QuinielaTestSupport` gains seeding of team players with players and of family links (and `LinkPlayer` for Player users) so handler tests can express the spec scenarios. Frontend: the list fixtures in `QuinielaWallets.test.tsx` gain `associatedPlayers`. The new field is required in the front type because the endpoint always returns it.

**Provenance**: derived

## Risks / Trade-offs

- [A family user with links to players of other teams leaks those names] → Mitigation: both reads filter by `TeamPlayer.TeamId == teamId`; a dedicated handler test covers a family member linked to a player of another team.
- [One user has several `UserTeam` rows in the team (for example Coach and FamilyPlayer)] → Mitigation: the associated players are decided from the row's own role (Decision 1), and a test covers a Coach row of a user who is also a family member.
- [A required `associatedPlayers` field breaks typed front fixtures and any consumer built before the field existed] → Mitigation: the front type and fixtures are updated in the same change; no Mobile consumer of the endpoint was found, and existing fields are untouched.
- [Substring matching can match unrelated rows for short text] → Mitigation: accepted trade-off of a simple in-browser filter; the full list is small (one team) and the specs ask for name matching, not ranking.
- [JSON property casing of the new field depends on the API serializer] → Mitigation: the existing fields already arrive camelCase to the front type, and the endpoint test asserts the new field name in the raw payload.

## Open Questions

None. The proposal note about the link between a player user and its player record is answered by `UserTeam.LinkedTeamPlayerId` (Decision 1), confirmed in `UserTeam.cs` (`LinkPlayer`, roles Player and FamilyPlayer only).

## Manual Verification

- End-to-end smoke across API and browser: run the API and the web app, open "Monederos del equipo" as the coach of a team that has a family member linked to two players, and confirm the family card lists both players and typing one player's name (in different case and without accent) shows that family member's card and the player's own card.
- Narrow screen: open the same page at 360 px and confirm the card with several players wraps its names with no horizontal scroll. This visual check is not covered by an automated test.
