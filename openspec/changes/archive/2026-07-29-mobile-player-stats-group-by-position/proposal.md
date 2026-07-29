## Why

`Mobile/src/screens/PlayerSeasonCardsScreen.tsx` (tab "Estadísticas") renders every player of a
team as a flat, unordered list of cards. As squads grow, coaches/families have to scan the whole
list to find a given player, and there is no visual grouping by role even though the data needed
for it (`activeDemarcation`) already comes back from the endpoint. Grouping by position with a
visible section header per group makes the screen scannable at a glance, mirroring how coaches
already think about a squad (goalkeepers, defense, midfield, attack).

## What Changes

- Group the players rendered in `PlayerSeasonCardsScreen.tsx` into fixed sections by
  `activeDemarcation.code`, each with a visible section header, in this order: **Porteros**,
  **Defensas**, **Medio centros**, **Bandas**, **Delanteros**, **Sin posición**.
- Mapping `code` → group (matching on `code`, not `name`, per `DemarcationMaster.cs`):
  - Porteros: `POR`
  - Defensas: `DFC`, `LIB`, `LI`, `LD`
  - Medio centros: `MCD`, `MC`, `MCO`
  - Bandas: `MI`, `MD`, `EI`, `ED`
  - Delanteros: `SD`, `DC`
  - Sin posición: `activeDemarcation === null`
- Within each group, order players by the sub-position's position in the table above, then by
  `dorsal` ascending (`null` dorsal last within its sub-position).
- A group with zero players in it is not rendered (no empty section headers) — this is a default
  decision, to be confirmed/detailed in `design.md`.
- Replace the current flat `ScrollView` + `.map()` rendering with a sectioned list. The concrete
  RN primitive (`SectionList` vs. grouped `ScrollView` sections) and its interaction with the
  existing loading/error/empty states are a `design.md` decision — `SectionList` is not currently
  used anywhere else in `Mobile/`, so this would be a new pattern for the app and must be checked
  against the versioned React Native docs for the app's exact `react-native` version (`0.81.5`,
  per `Mobile/package.json`) before committing to it.
- No backend or API contract changes: `GET /api/mobile/teams/{teamId}/season-player-cards`
  already returns `activeDemarcation: { id, name, code } | null` per player (confirmed in the
  current `PlayerSeasonCard` type in the screen file), and the position catalog is confirmed
  against `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Demarcations/DemarcationMaster.cs`.
- Existing `testID`s per player card (`player-season-card-{id}`, `player-alias-{id}`, etc.) are
  preserved so unrelated assertions in the current test suite keep passing; new `testID`s are
  added for section headers.

## Capabilities

### New Capabilities
- `mobile-player-stats-grouping`: the Mobile "Estadísticas" screen groups a team's player season
  cards into fixed, ordered position sections with visible headers, instead of one flat list.

### Modified Capabilities
(none — no existing OpenSpec spec currently covers this screen's rendering behavior)

## Impact

- **Mobile only**: `Mobile/src/screens/PlayerSeasonCardsScreen.tsx` and its test file
  `Mobile/src/screens/__tests__/PlayerSeasonCardsScreen.test.tsx`; possibly a small grouping/sort
  helper extracted to `Mobile/src/utils/` or `Mobile/src/screens/hooks/` (decided in `design.md`).
- **Backend**: none — no endpoint or contract change.
- **Front (web)**: none — this screen has no equivalent in `Front/`.
