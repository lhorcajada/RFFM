## 1. API clients

- [x] 1.1 Write failing tests for `Mobile/src/api/injuries.ts` (`getTeamPlayerInjuries`) in `Mobile/src/api/__tests__/injuries.test.ts` — success shape, error/empty handling.
- [x] 1.2 Implement `Mobile/src/api/injuries.ts` (typed `InjuryRecord`, `getTeamPlayerInjuries(teamPlayerId)` via the shared `api` client) to make tests pass.
- [x] 1.3 Write failing tests for `Mobile/src/api/sanctions.ts` (`getTeamPlayerSanctions`) in `Mobile/src/api/__tests__/sanctions.test.ts` — both `Competition` and `InternalDiscipline` categories.
- [x] 1.4 Implement `Mobile/src/api/sanctions.ts` (typed `SanctionRecord`, `getTeamPlayerSanctions(teamPlayerId, category)`) to make tests pass.

## 2. InjuriesScreen

- [x] 2.1 Write failing tests for `Mobile/src/screens/InjuriesScreen.tsx` in `Mobile/src/screens/__tests__/InjuriesScreen.test.tsx` covering: loading state, roster+injuries aggregation and sort by `startDate`, active vs discharged status (`endDate` null → "de baja" / "Sin definir"), full detail rendering (type/description/estimatedRecovery), empty state, roster error state.
- [x] 2.2 Implement `Mobile/src/screens/InjuriesScreen.tsx` (fetch roster via `/api/mobile/teams/{teamId}/season-player-cards`, fan out `getTeamPlayerInjuries` per player with `Promise.all`, merge + sort, render player avatar via `resolvePhotoUrl` + alias + position per entry) to make tests pass.
- [x] 2.3 Extract shared player-header rendering into `Mobile/src/screens/components/PlayerRecordHeader.tsx` only if duplication with `SanctionsScreen` is non-trivial; add/adjust its tests accordingly. (SKIPPED: duplication is manageable without extraction; both screens work correctly as-is.)

## 3. SanctionsScreen

- [x] 3.1 Write failing tests for `Mobile/src/screens/SanctionsScreen.tsx` in `Mobile/src/screens/__tests__/SanctionsScreen.test.tsx` covering: loading state, both categories rendered correctly, segmented control switching without refetch errors, active vs resolved status, full detail rendering, empty state per category, roster error state.
- [x] 3.2 Implement `Mobile/src/screens/SanctionsScreen.tsx` (fetch roster once, fan out `getTeamPlayerSanctions` per player for both categories, segmented control toggling between "En competición" / "Por normas internas") to make tests pass.

## 4. Navigation

- [x] 4.1 Write/update failing test in `Mobile/src/navigation/__tests__/CalendarTabs.test.tsx` (or equivalent) asserting the two new tabs ("Lesiones", "Sanciones") are registered with the expected `tabBarLabel` and icon, without altering existing tab `name`s or labels.
- [x] 4.2 Update `Mobile/src/navigation/RootNavigator.tsx`: add `InjuriesTab` (`InjuriesScreen`, icon `medkit-outline`, label "Lesiones") and `SanctionsTab` (`SanctionsScreen`, icon `warning-outline`, label "Sanciones") to `CalendarTabs`, both with `initialParams={{ teamId }}`.

## 5. Verification

- [x] 5.1 Run `npm test` in `Mobile/` — full suite green, no skipped tests. (PASS: 32 test suites, 276 tests, all passing)
- [x] 5.2 Run `openspec validate add-mobile-injuries-sanctions-screens --strict` — no errors. (PASS: Change is valid)
- [x] 5.3 Confirm no changes were made under `Front/` or `Back/ExtractionApi/`. (CONFIRMED: Only Mobile/ files modified)
