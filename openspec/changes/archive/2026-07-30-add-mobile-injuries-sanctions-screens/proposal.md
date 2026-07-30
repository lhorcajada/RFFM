## Why

Coach (`Front/`) already lets coaches review player injuries and sanctions per team. Mobile (`Mobile/`) has no equivalent, forcing coaches/families to switch to the web app to check a player's medical or disciplinary status. The backend endpoints already exist (`GET /api/catalog/teamplayer/{id}/injuries`, `GET /api/catalog/teamplayer/{id}/sanctions?category=...`), so this is a read-only Mobile client addition.

## What Changes

- Add a new `Mobile/src/api/injuries.ts` client exposing `getTeamPlayerInjuries(teamPlayerId)`.
- Add a new `Mobile/src/api/sanctions.ts` client exposing `getTeamPlayerSanctions(teamPlayerId, category)` for both `Competition` and `InternalDiscipline` categories.
- Add `Mobile/src/screens/InjuriesScreen.tsx`: aggregates all team players' injuries (via the existing roster endpoint used by `PlayerSeasonCardsScreen` for player photo/alias/position, combined per-player with the injuries endpoint), sorted by date, showing active/discharged status, dates, and full injury detail.
- Add `Mobile/src/screens/SanctionsScreen.tsx`: same aggregation approach, with two segmented sections/tabs for `Competition` and `InternalDiscipline` sanctions.
- Add two new bottom tabs ("Lesiones", "Sanciones") to `CalendarTabs` in `Mobile/src/navigation/RootNavigator.tsx`, following the existing tab pattern (stable internal `name`, `Ionicons` icon, `initialParams={{ teamId }}`).
- Add Jest + Testing Library for RN tests for both new screens and both new API clients (loading/error/empty/data states), TDD Red→Green→Refactor.

No changes to `Front/` or `Back/ExtractionApi/` — backend contract is already implemented and verified against `SetPlayerInjury.cs` / `SetPlayerSanction.cs`.

## Capabilities

### New Capabilities
- `mobile-player-injuries`: Read-only team-wide injuries listing screen in Mobile.
- `mobile-player-sanctions`: Read-only team-wide sanctions listing screen (Competition / InternalDiscipline) in Mobile.

### Modified Capabilities
(none — no existing spec requirements change)

## Impact

- New files under `Mobile/src/api/`, `Mobile/src/screens/`, and their `__tests__/`.
- Modified: `Mobile/src/navigation/RootNavigator.tsx` (two new tabs in `CalendarTabs`), and its existing test file if one asserts the exact tab list.
- No backend or Front changes; no database/API contract changes.
