# Implement: add-mobile-injuries-sanctions-screens

COMPLETED: All tasks implemented following strict TDD (Red → Green → Refactor).
Scope was **Mobile/ only** — no changes to `Front/` or `Back/ExtractionApi/`.
No commits or pushes made; changes left in working tree as requested.

## Ground truth / contracts (verified against source, do not re-derive)

- Injuries endpoint (existing, read-only from Mobile): `GET /api/catalog/teamplayer/{id}/injuries`
  returns `InjuryRecord[]`: `{ id: string; startDate: string; injuryType: string; description?:
  string | null; estimatedRecovery?: string | null; endDate?: string | null }`. `endDate == null`
  means the injury is active ("de baja"); non-null means discharged ("de alta").
- Sanctions endpoint (existing, read-only from Mobile):
  `GET /api/catalog/teamplayer/{id}/sanctions?category=Competition|InternalDiscipline` returns
  `SanctionRecordResponse[]`: `{ id: string; category: "Competition" | "InternalDiscipline";
  startDate: string; sanctionType: string; description?: string | null; estimatedEnd?: string |
  null; endDate?: string | null }`. Source of truth:
  `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Commands/SetPlayerSanction.cs` (record
  `SanctionRecordResponse`). `endDate == null` means active.
- Roster with player photo/alias/position (existing, already used by
  `Mobile/src/screens/PlayerSeasonCardsScreen.tsx`): `GET /api/mobile/teams/{teamId}/season-player-cards`
  returns entries with `teamPlayerId`, `alias`, `urlPhoto`, `activeDemarcation: { id, name, code } | null`.
  Use `resolvePhotoUrl` from `Mobile/src/utils/resolvePhotoUrl.ts` to resolve `urlPhoto` against
  `API_BASE_URL` from `Mobile/src/api/client.ts`, exactly like `PlayerSeasonCardsScreen.tsx` does.

## Conventions to follow exactly (see `.claude/rules/react-native.md` for full detail)

- Single Axios instance: import `api` from `Mobile/src/api/client.ts`. Never `axios.create()`
  elsewhere.
- New API client files are typed functions (no class), one file per resource, matching the style
  of `Mobile/src/api/team.ts` and `Mobile/src/api/clubEmblem.ts`.
- Screens: `PascalCase` + `Screen` suffix, one per file, under `Mobile/src/screens/`. Data-loading
  pattern: `useState` for `loading`/`error`/`data`, `useEffect` triggers async `fetchXxx`,
  `try/catch` sets `error` to `e.response?.data?.detail || '<fallback en español>'`.
- Colors from `Mobile/src/theme/colors.ts` (`coachColors`) — no new hardcoded hex.
- User-facing text in Spanish.
- Never change the internal `name` of an existing `Tab.Screen`/`Stack.Screen` — only add new ones.
- Tests co-located in `__tests__/` next to the file under test, Jest + `@testing-library/react-native`.
  Mock the `api` module (`jest.mock('../client', ...)` or equivalent relative path) for every API
  client test — never hit real network. Mock `@react-navigation/bottom-tabs` the way
  `Mobile/src/navigation/__tests__/CalendarTabs.test.tsx` already does, when testing navigation.

## Task execution notes

### 1. API clients (tasks 1.1–1.4)
- `Mobile/src/api/injuries.ts`: export `InjuryRecord` type and
  `getTeamPlayerInjuries(teamPlayerId: string): Promise<InjuryRecord[]>` calling
  `api.get(\`/api/catalog/teamplayer/${teamPlayerId}/injuries\`)`. On error, follow the existing
  `team.ts` pattern (catch and decide return shape) OR let the error propagate for the screen's own
  try/catch to handle — pick whichever matches how `PlayerSeasonCardsScreen.tsx` composes with its
  own `api.get` call (screen catches, not the client) since both injuries and sanctions clients are
  simple pass-through wrappers; write the test first to lock in the chosen behavior.
- `Mobile/src/api/sanctions.ts`: export `SanctionRecord` type and
  `getTeamPlayerSanctions(teamPlayerId: string, category: 'Competition' | 'InternalDiscipline'):
  Promise<SanctionRecord[]>` calling
  `api.get(\`/api/catalog/teamplayer/${teamPlayerId}/sanctions\`, { params: { category } })`.

### 2. InjuriesScreen (tasks 2.1–2.3)
- Accept `teamId` via route params (`useRoute()`), same as `PlayerSeasonCardsScreen.tsx`.
- `fetchInjuries`: `api.get(\`/api/mobile/teams/${teamId}/season-player-cards\`)` for the roster,
  then `Promise.all(roster.map(p => getTeamPlayerInjuries(p.teamPlayerId)))`, merge each player's
  records with that player's roster info into a flat array of `{ player, injury }`, sort by
  `injury.startDate` descending. A single failed per-player fan-out call should not fail the whole
  screen (treat as empty for that player) — only a roster-fetch failure sets the screen `error`
  state.
- Render: player avatar (via `resolvePhotoUrl`) + alias + `activeDemarcation` code/name next to each
  entry (or grouped under a header if you find grouping by player reads better — either satisfies
  the spec as long as photo/alias/position is visibly associated with each injury). Status badge
  ("De baja" if `endDate == null`, else "De alta"). Dates: format `startDate`; `endDate` shows the
  literal string `'Sin definir'` when null. Show `injuryType`, `description` (if present),
  `estimatedRecovery` (if present).
- Empty state: Spanish message when the merged list is empty after a successful roster load.

### 3. SanctionsScreen (tasks 3.1–3.2)
- Same roster fetch as InjuriesScreen. Fan out `getTeamPlayerSanctions(p.teamPlayerId, 'Competition')`
  and `getTeamPlayerSanctions(p.teamPlayerId, 'InternalDiscipline')` for every roster player (both
  categories fetched once on load, kept in state separately) so switching the segmented control is
  instant and does not refetch.
- Segmented control: two `Pressable`/`TouchableOpacity` tabs labeled "En competición" and "Por
  normas internas", local `useState` for the active category, following the toggle pattern already
  present in `PlayerSeasonCardsScreen.tsx` (`expandedSectionKey` toggle) for a consistent look/feel
  and `coachColors` usage.
- Same per-entry rendering rules as InjuriesScreen: `sanctionType`, `startDate`, `description` (if
  present), `estimatedEnd` (if present), status derived from `endDate`, `'Sin definir'` when
  `endDate` is null.

### 4. Navigation (tasks 4.1–4.2)
- Update `Mobile/src/navigation/__tests__/CalendarTabs.test.tsx`: add `jest.mock` lines for the two
  new screens, add assertions for `tab-screen-InjuriesTab` / `tab-label-InjuriesTab` ("Lesiones"),
  `tab-screen-SanctionsTab` / `tab-label-SanctionsTab` ("Sanciones"), their icons
  (`medkit-outline`, `warning-outline`), and **update the existing tab-order assertion** (currently
  `['NewsTab', 'CalendarTab', 'LeagueTab', 'FriendliesTab', 'PlayersTab']`) to append the two new
  tabs at the end in the order they are added to `RootNavigator.tsx`.
- In `Mobile/src/navigation/RootNavigator.tsx`: import `InjuriesScreen` and `SanctionsScreen`, add
  two `<Tab.Screen>` entries to `CalendarTabs` after `PlayersTab`, each with
  `initialParams={{ teamId }}`, `tabBarIcon` using `Ionicons` (`medkit-outline` for Lesiones,
  `warning-outline` for Sanciones). Do not touch any existing `Tab.Screen`'s `name`.

### 5. Verification (tasks 5.1–5.3)
- Run `cd Mobile && npm test`. Full suite must pass, zero skipped tests.
- Run `openspec validate add-mobile-injuries-sanctions-screens --strict` from the repo root — must
  report valid.
- Run `git status` (repo root) and confirm only files under `Mobile/` and `openspec/changes/add-mobile-injuries-sanctions-screens/`
  changed — nothing under `Front/` or `Back/`.
- Do **not** commit, push, or archive. Leave the change directory as-is for the user to review.

## Report back

When done, report: every file created/modified (absolute paths), the exact `npm test` result
summary (pass/fail counts), and confirmation that `openspec validate --strict` passed and no
`Front/`/`Back/` files were touched.
