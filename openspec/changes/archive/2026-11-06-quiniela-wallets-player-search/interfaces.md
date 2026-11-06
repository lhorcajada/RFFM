## Step 1: Return associated players from the wallets endpoint

**Interfaces**:
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Quiniela/QuinielaSupport.cs`
  - `public record QuinielaAssociatedPlayerDto(Guid Id, string Name);` where `Id` is the `TeamPlayer` id and `Name` is the player's `Name` and `LastName` joined by one space and trimmed.
  - `QuinielaWalletSummaryDto` keeps its four existing members in the same order and gains a last member `IReadOnlyList<QuinielaAssociatedPlayerDto> AssociatedPlayers`; it is never null.
- `GetQuinielaWallets.Handler` keeps its route, `Query(TeamId)` and result type `IReadOnlyList<QuinielaWalletSummaryDto>` unchanged.
- Test support in `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/QuinielaTestSupport.cs` (names are a contract for the new handler tests): `Task<Guid> SeedTeamPlayerAsync(AppDbContext db, QuinielaSeed seed, string name, string lastName)` returning the new `TeamPlayer` id for the seeded team; `Task LinkFamilyAsync(AppDbContext db, Guid familyUserId, Guid teamPlayerId)` creating a `TeamPlayerFamilyMember` linked to that user; `Task LinkPlayerUserAsync(AppDbContext db, QuinielaSeed seed, Guid playerUserId, Guid teamPlayerId)` calling `UserTeam.LinkPlayer` on the user's team row.

**Test assertions** (all anchored to `openspec/changes/quiniela-wallets-player-search/specs/quiniela-wallet/spec.md`, requirement "The coach lists the wallets of the team"):
- Scenario "Family member linked to several players": a FamilyPlayer user linked to players "Ana Lopez" and "Beto Lopez" of the team gives exactly one row for that user whose `AssociatedPlayers` names are `["Ana Lopez", "Beto Lopez"]` in that order.
- Scenario "Family member linked to players of other teams": a FamilyPlayer linked to "Ana Lopez" of the requested team and to "Cleo Ruiz" of another team gives `AssociatedPlayers` with the single name `"Ana Lopez"`.
- Scenario "Family member without linked players": a FamilyPlayer with no family link gives a row with `AssociatedPlayers.Count == 0`.
- Scenario "Family member without wallet": a FamilyPlayer with a link and no wallet gives `Balance == 0.00m` and one associated player.
- Scenario "Player row": a Player user linked with `LinkPlayer` to "Ana Lopez" of the team gives `AssociatedPlayers` with exactly one entry named `"Ana Lopez"` whose `Id` equals that team player id.
- Scenario "Player user without a linked player record": a Player user without link gives `AssociatedPlayers.Count == 0`.
- Scenario "Coach row": a Coach who is also linked as family member of a player gives, on the Coach row, `AssociatedPlayers.Count == 0`.
- A player whose `LastName` is empty gives `Name == "<Name>"` with no trailing space.
- Scenario "List": the number of rows and every `Balance` are the same as before the change for the same seed.
- Endpoint contract: the JSON of an authorized `GET /api/teams/{teamId}/quiniela/wallets` response contains the property `associatedPlayers` on every row, as an array.

## Step 2: Front types and the pure search filter

**Interfaces**:
- `Front/src/apps/coach/services/quinielaService.ts`
  - `export type QuinielaAssociatedPlayer = { id: string; name: string };`
  - `QuinielaWalletSummary` keeps its four fields and gains the required `associatedPlayers: QuinielaAssociatedPlayer[]`.
- `Front/src/apps/coach/pages/quiniela/walletSearch.ts`
  - `export function normalizeSearchText(text: string): string` — lowercases, removes combining accent marks after NFD decomposition, collapses every run of whitespace to a single space and trims.
  - `export function filterWallets(wallets: QuinielaWalletSummary[], query: string): QuinielaWalletSummary[]` — returns the input array content unchanged for a blank normalized query; otherwise only the rows whose normalized `userName` or any normalized associated player `name` contains the normalized query, in the original order, each row once and with its `associatedPlayers` untouched.

**Test assertions** (anchored to `openspec/changes/quiniela-wallets-player-search/specs/quiniela-wallet/spec.md`, requirement "The coach searches the wallets list by player or family member name"):
- `normalizeSearchText("  jOSE   perez ")` → `"jose perez"`; `normalizeSearchText("José Pérez")` → `"jose perez"` (scenario "Case, accents and spaces are ignored").
- `normalizeSearchText("   ")` → `""`.
- Rows: player user "José Pérez" (players `[José Pérez]`), family "Marta" (players `[José Pérez, Lucía Pérez]`), family "Pedro" (players `[José Pérez]`), family "Rosa" (players `[Otro Niño]`). `filterWallets(rows, "  jOSE   perez ")` → the rows José Pérez, Marta, Pedro in that order, and not Rosa (scenario "Search by player name").
- A family row with no player user: `filterWallets(rows, "lucia")` → only Marta, and Marta's `associatedPlayers` still lists both players (scenarios "Search by player name when the player has no user" and "Search by family member name").
- `filterWallets(rows, "marta")` → the Marta row with `associatedPlayers` of length 2 (scenario "Search by family member name").
- Text that matches player A and a family member of player B returns each matching row once, in original order, even if one row matches by user name and by player name (scenario "Text matching a player and a family member of another player").
- `filterWallets(rows, "")` and `filterWallets(rows, "   ")` → all rows, in the original order (scenario "Empty search box").
- `filterWallets(rows, "zzz")` → `[]` (scenario "No matches").
- `filterWallets` does not mutate its input array or its rows.

## Step 3: Search box and players area on the wallets list page

**Interfaces**:
- `Front/src/apps/coach/pages/quiniela/QuinielaWallets.tsx` (default export unchanged): renders, once data has loaded, a text input with the accessible name `Buscar por jugador o familiar` above the card list; keeps the search text in local state; the visible rows are `filterWallets(wallets, searchText)`.
- Per-card players area rendered only when `associatedPlayers.length > 0`, listing every player name inside the card.
- Messages: `No hay participantes en el equipo` when the loaded list is empty (unchanged, shown with or without search text); `No se encontraron resultados` when the loaded list is not empty and the filter returns no rows.

**Test assertions** (anchored to `openspec/changes/quiniela-wallets-player-search/specs/quiniela-wallet/spec.md`, requirement "The wallets list shows the associated players of each row" and requirement "The coach searches the wallets list by player or family member name"):
- Family member card with players `[Ana Lopez]` → the text `Ana Lopez` appears inside that card (scenario "Family member with one player").
- Family member card with three players → all three names appear inside the same single card, and the family member's name appears once in the whole list (scenario "Family member with several players").
- Player row with its own player → the card shows the player's own name as associated player (scenario "Player row").
- Coach card and a family member card with an empty `associatedPlayers` → no players area inside those cards, while name, role and balance are shown (scenarios "Coach row" and "Family member without players").
- Typing `jOSE   perez` in the textbox named `Buscar por jugador o familiar` leaves only the cards tied to "José Pérez" (scenario "Search by player name" and "Case, accents and spaces are ignored").
- After typing a family member's name, that card still shows all its players (scenario "Search by family member name").
- Clearing the textbox, or typing only spaces, shows every card (scenario "Empty search box").
- Typing text that matches nothing, with participants loaded, shows `No se encontraron resultados` and does not show `No hay participantes en el equipo` (scenario "No matches").
- With a team whose loaded list is empty, `No hay participantes en el equipo` is shown both before and after typing text, and `No se encontraron resultados` is never shown (scenario "Team without participants").
- Typing and changing the text does not increase the call count of the mocked `getQuinielaWallets` beyond the initial one (scenario "Typing does not call the API").
