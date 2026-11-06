# Code Review — Quiniela Wallets Player Search

**Reviewed:** `2946cadb` 8a70f0f6..a5d48438 · 2026-11-05

## Security Surface Triage

- **Surface touched:** No

---

## Performance Surface Triage

- **Surface touched:** Yes

---

## Accessibility Surface Triage

- **Surface touched:** Yes

---

## Findings

### Critical

None.

### High

None.

### Medium

#### M1 — The row role, and so its associated players, is arbitrary for a user with several roles in the team
- **Location:** `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Quiniela/GetQuinielaWallets.cs:58-61` (role source `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Quiniela/QuinielaSupport.cs:398-406`)
- **Problem:** The handler builds one row per distinct user (`.Select(ut => ut.ApplicationUserId).Distinct()`) and takes the row role from `LoadParticipantsAsync`, which uses `roles.FirstOrDefault(r => r.ApplicationUserId == id)` over an unordered, role-unfiltered `UserTeams` query. `AssociatedPlayersOf` then decides the players from that role. For a user who has both a Coach and a FamilyPlayer (or Player) `UserTeam` row in the team, the row shows either "Entrenador" with no players or "Familiar" with players, depending on database row order. The spec scenario "rows with the role Coach have an empty list of associated players, even if that user is linked as family member" and design Decision 1 ("applied per row role") rely on a stable row role, which the code does not give. The role picker is older code, but this change makes visible output depend on it. The existing test `List_CoachWhoIsAlsoAFamilyMember_ShowsNoPlayersOnTheCoachRow` links a family record to the coach without adding a FamilyPlayer `UserTeam` row, so it does not exercise this case.
- **Suggested fix:** (a) Resolve the role with a fixed precedence among `ParticipantRoles` (for example Coach > Player > FamilyPlayer) in `LoadParticipantsAsync`, and add a handler test with a user who holds two `UserTeam` rows. This is deterministic and small, but it changes the role shown in other quiniela lists that share the helper. (b) Compute the role precedence only inside `GetQuinielaWallets`. This keeps other features unchanged but duplicates role logic.

#### M2 — Search result changes are not announced to screen readers
- **Location:** `Front/src/apps/coach/pages/quiniela/QuinielaWallets.tsx:169-171`
- **Problem:** Typing in the search box replaces the card list or shows "No se encontraron resultados", but neither the count nor the empty message is in a live region. Screen-reader users get no feedback that the filter ran or found nothing (WCAG 2.2 SC 4.1.3 Status Messages, level AA). The accessibility audit covers the rest of the page.
- **Suggested fix:** Add a visually hidden `role="status"` (or `aria-live="polite"`) element that announces the visible row count, or the no-results text, when the search text is not blank.

### Low

#### L1 — Player-row team scoping and family-link exclusion are untested
- **Location:** `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/QuinielaWalletHandlerTests.cs:425-440`
- **Problem:** The Player-row tests cover a linked player and a missing link only. No test covers a Player user whose `LinkedTeamPlayerId` points to a team player of another team (the `tp.TeamId == teamId` filter at `GetQuinielaWallets.cs:82`), or a Player user who is also linked as a family member of another player (family links must be ignored for Player rows, `GetQuinielaWallets.cs:103-106`). A regression in either filter would pass the suite.
- **Suggested fix:** Add two handler tests: a Player user linked to another team's team player gets an empty list; a Player user who also has a family link to a second player gets only their own player.

#### L2 — `Guid.Parse` on a string team player id can turn bad data into a 500
- **Location:** `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Quiniela/GetQuinielaWallets.cs:93`
- **Problem:** `TeamPlayer.Id` is a `string` (`BaseEntity.cs:8`), and `Guid.Parse(l.TeamPlayerId)` throws `FormatException` for any non-GUID id, failing the whole list. Every other quiniela DTO in `QuinielaSupport.cs` exposes ids as strings, and the front type declares `id: string`. Design Decision 4 chose `Guid`, so the type itself is settled; the risk is the throwing parse.
- **Suggested fix:** Keep `Guid` and use `Guid.TryParse`, skipping or logging unparsable ids; or confirm all `TeamPlayer` ids are GUID strings and leave as is.

#### L3 — Combining-mark range is written with invisible characters
- **Location:** `Front/src/apps/coach/pages/quiniela/walletSearch.ts:6`
- **Problem:** The regex `/[̀-ͯ]/g` contains the literal characters U+0300 and U+036F. It works, but the range is invisible in review and easy to corrupt with an editor or encoding change.
- **Suggested fix:** Write it as `/[̀-ͯ]/g`, or `/\p{M}/gu`.

#### L4 — Player-card lookup in a test hides a missing card behind a cast
- **Location:** `Front/src/apps/coach/pages/quiniela/__tests__/QuinielaWallets.test.tsx:342-343`
- **Problem:** `screen.getAllByTestId("wallet-card").find(...)` followed by `playerCard as HTMLElement` passes `undefined` to `within` when no card matches, which fails with an opaque TypeError instead of a clear assertion. It also relies on `getAllByTestId`, while the project rules prefer role or text queries.
- **Suggested fix:** Find the card through the existing `cardOf("José Pérez")` helper (or a role query), or assert `expect(playerCard).toBeDefined()` before using it.

### Questions

#### Q1 — Should players who left the team count as associated players?
- **Location:** `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Quiniela/GetQuinielaWallets.cs:69-85`
- **Question:** Neither query filters `TeamPlayer.LeftDate`, so a family member keeps showing a player who has left the team. Other features (`AddPlayerTeam.cs`, `GetCoachSquadComparison.cs`) treat `LeftDate == null` as an active player. The spec says "every player of the team that the family member is linked to" and does not mention departures. Should departed players be excluded?

#### Q2 — Should the front tolerate a response without `associatedPlayers`?
- **Location:** `Front/src/apps/coach/services/quinielaService.ts:335-337`, `Front/src/apps/coach/pages/quiniela/walletSearch.ts:19`, `Front/src/apps/coach/pages/quiniela/QuinielaWallets.tsx:185`
- **Question:** Design Decision 7 makes the field required because the endpoint always returns it. The web and API are versioned and deployed separately, so if the web ships before the API, `wallet.associatedPlayers.length` throws and the page breaks. Is a coordinated deploy guaranteed, or should the service default the field to `[]`?

#### Q3 — Should "ñ" match "n" in the search?
- **Location:** `Front/src/apps/coach/pages/quiniela/walletSearch.ts:5-6`
- **Question:** NFD decomposition plus mark removal turns "ñ" into "n", so searching "Nuñez" also matches "Nunez", and typing "ñ" matches every name with an "n". The spec asks to ignore accents; in Spanish "ñ" is a separate letter, not an accented "n". Is this folding intended?

---

Summary: Critical=0 High=0 Medium=2 Low=4 Questions=3
