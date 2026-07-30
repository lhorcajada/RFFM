## Context

Mobile has no team-wide aggregate endpoint for injuries or sanctions — only per-`teamPlayerId` endpoints exist:
`GET /api/catalog/teamplayer/{id}/injuries` and `GET /api/catalog/teamplayer/{id}/sanctions?category=Competition|InternalDiscipline`.
The roster (player photo/alias/position) is already available team-wide via
`GET /api/mobile/teams/{teamId}/season-player-cards` (`teamPlayerId`, `alias`, `urlPhoto`, `dorsal`, `activeDemarcation`),
already consumed by `Mobile/src/screens/PlayerSeasonCardsScreen.tsx` and `Mobile/src/utils/resolvePhotoUrl.ts`.

Both new screens are read-only and need to show, per entry, which player it belongs to (photo, alias, position) —
so the screens must combine the roster call with N per-player detail calls, client-side.

## Goals / Non-Goals

**Goals:**
- Read-only team-wide Lesiones (injuries) and Sanciones (sanctions) screens in Mobile.
- Reuse existing roster data (`season-player-cards`) for player photo/alias/position instead of adding a new backend endpoint.
- Follow existing screen/navigation/api conventions exactly (single Axios instance, `PascalCase` + `Screen` files, stable tab `name`s, `coachColors`).

**Non-Goals:**
- No create/edit/delete of injuries or sanctions from Mobile (Front/Coach already owns that).
- No new backend endpoint — the per-player fan-out approach is acceptable given typical squad sizes (~20-25 players).
- No changes to `Front/` or `Back/ExtractionApi/`.

## Decisions

### 1. Client-side aggregation via roster + per-player fan-out
Fetch `season-player-cards` once for the roster (photo/alias/position), then `Promise.all` one
`getTeamPlayerInjuries(teamPlayerId)` (or `getTeamPlayerSanctions`) call per roster entry, merge results into a flat
list of `{ player, record }` pairs, sort by `startDate` descending.
**Alternative considered**: add a new backend aggregate endpoint (`GET /api/mobile/teams/{teamId}/injuries`) — rejected
because it touches `Back/`, which is out of scope per the user's explicit instruction to keep this change Mobile-only.
If squad sizes grow large enough to make fan-out slow, a follow-up backend change can add the aggregate endpoint.

### 2. Two new API client files
`Mobile/src/api/injuries.ts` exports `getTeamPlayerInjuries(teamPlayerId): Promise<InjuryRecord>[]` mirroring
`InjuryRecord` shape from `Front/src/apps/coach/services/teamplayerService.ts` (`id`, `startDate`, `injuryType`,
`description?`, `estimatedRecovery?`, `endDate?`).
`Mobile/src/api/sanctions.ts` exports `getTeamPlayerSanctions(teamPlayerId, category): Promise<SanctionRecord[]>`
mirroring `SanctionRecordResponse` from `Back/ExtractionApi/.../SetPlayerSanction.cs`
(`id`, `category`, `startDate`, `sanctionType`, `description`, `estimatedEnd`, `endDate`).
Both follow the existing pattern of `Mobile/src/api/team.ts` / `clubEmblem.ts` — typed functions, no class wrapper.

### 3. Screens: `InjuriesScreen.tsx` and `SanctionsScreen.tsx`
- `InjuriesScreen`: single flat list sorted by `startDate` desc. Each item shows player avatar (reusing
  `resolvePhotoUrl`) + alias + position, status badge (de alta / de baja from `endDate == null`), start date, end
  date ("Sin definir" if null), injury type, description, estimated recovery.
- `SanctionsScreen`: same aggregation run twice (once per category) or once fetching both categories per player and
  splitting client-side; a segmented control (two `Pressable` tabs, following the toggle-button pattern already used
  for section expand/collapse in `PlayerSeasonCardsScreen`) switches between "En competición" and "Por normas
  internas" without refetching.
- Both follow the standard Mobile data-loading pattern: `useState` for `loading/error/data`, `useEffect` triggers
  async `fetchXxx`, `catch` sets `error` to `e.response?.data?.detail || '<fallback en español>'`.
- Shared row rendering (avatar + alias + position header) is extracted into
  `Mobile/src/screens/components/PlayerRecordHeader.tsx` if duplication between the two screens is not trivial —
  decided during implementation based on actual overlap.

### 4. Navigation: two new tabs on `CalendarTabs`
Add `InjuriesTab` (`medkit-outline` icon, label "Lesiones") and `SanctionsTab` (`warning-outline` icon, label
"Sanciones") to `CalendarTabs` in `Mobile/src/navigation/RootNavigator.tsx`, both with `initialParams={{ teamId }}`,
following the exact pattern of the existing `PlayersTab`. Internal route `name`s are new and stable from creation —
no existing route is renamed.
**Alternative considered**: nesting under `PlayersTab` as a per-player drill-down — rejected because the acceptance
criteria explicitly ask for a team-wide list with player info per entry, which fits a flat aggregate screen better
than a per-player detail view.

## Risks / Trade-offs

- **[Risk] N+1 network calls per screen open** (one per roster player) → **Mitigation**: `Promise.all` parallelizes
  the fan-out; acceptable for typical grassroots squad sizes. Documented as a candidate for a future backend
  aggregate endpoint if it becomes a real perf issue.
- **[Risk] Seven bottom tabs may crowd the tab bar** → **Mitigation**: matches the existing simple one-tab-per-screen
  pattern already used for five tabs; if the user wants a different information architecture (e.g., grouping under a
  single "Estado" tab) this can be revisited in a follow-up, kept out of scope here to match approved requirements.
- **[Risk] Partial failure (roster loads, one player's injuries/sanctions call fails)** → **Mitigation**: individual
  failed fan-out calls are treated as "no records for that player" rather than failing the whole screen; only a
  roster fetch failure surfaces the screen-level error state.

## Open Questions

None — scope and approach confirmed by the user before starting.
