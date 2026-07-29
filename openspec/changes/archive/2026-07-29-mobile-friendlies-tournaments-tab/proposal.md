## Why

Mobile's `CalendarScreen` mixes every event type (training, league matches, friendlies, tournaments) into one general list. Families/coaches who only want to check upcoming friendly matches and tournaments must scan the full calendar and manually apply a filter each time. A dedicated tab gives direct, always-current visibility into just those two event categories.

## What Changes

- Add a new tab `FriendliesTab` to `CalendarTabs` in `Mobile/src/navigation/RootNavigator.tsx`, alongside `CalendarTab`, `NewsTab`, `PlayersTab`, `LeagueTab`. Receives `initialParams={{ teamId }}`, same pattern as `LeagueTab`/`PlayersTab`. Label "Amistosos" (final copy to confirm in design), icon TBD in design (candidate: `Ionicons` `football-outline` or `shield-outline` — avoid reusing `trophy-outline`, already used by `LeagueTab`).
- Add a new screen, `Mobile/src/screens/FriendliesScreen.tsx`, following the existing data-loading pattern (`useState` loading/error/data, `useEffect` → async fetch, `try/catch` → `error` from `e.response?.data?.detail` with a Spanish fallback).
- Fetch from the existing `GET /api/sport-events/{teamId}` endpoint (same call as `CalendarScreen`, no new backend work) plus `fetchSportEventTypeMap()` (`Mobile/src/api/sportEventTypes.ts`) to resolve `eventTypeId` → type name.
- Filter events client-side to only "amistoso"/"torneo" categories. `CalendarScreen`'s sibling component `EventCard.tsx` already does substring matching on the resolved type name (`'entrenamiento'`, `'torneo'`/`'competici'`, `'partido'`) to select header styling — this change extracts/adds an equivalent, reusable classification helper (exact location and shape decided in design.md) instead of duplicating a third inline substring-matching block. Because event type names are free text from the backend (no fixed enum), "friendly" classification needs a working definition — to confirm in design.md: match by type name containing `"amistos"`, as no such keyword exists in today's matching in `EventCard.tsx`.
- Sort the filtered list by `eveDateTime` ascending (soonest first) and render with the existing `EventCard` component, reusing `EventDetailScreen` navigation (`navigation.navigate('EventDetail', { eventId, teamId, teamPlayerId })`) on tap.
- Show an explicit empty state ("No hay amistosos ni torneos próximos" or equivalent copy, confirmed in design.md) when the filtered list is empty.
- No backend changes: reuses `GET /api/sport-events/{teamId}` and `GET /api/sport-event-types`, both already consumed by `CalendarScreen`.

## Capabilities

### New Capabilities
- `mobile-friendlies-tab`: A dedicated Mobile tab listing only upcoming friendly matches and tournaments (excluding training, league/competition matches shown elsewhere, etc.), sorted soonest-first, navigating to the existing event detail screen, with an explicit empty state.

### Modified Capabilities
(none — no existing spec covers Mobile calendar/navigation; no API contract changes)

## Impact

- **Mobile only**: `Mobile/src/navigation/RootNavigator.tsx` (new `Tab.Screen`), new `Mobile/src/screens/FriendliesScreen.tsx` + tests, possibly a new shared classification helper (exact file TBD in design — candidate: `Mobile/src/utils/` or `Mobile/src/screens/hooks/`) reused by `EventCard.tsx`'s existing inline matching to avoid a third duplicate.
- **Backend**: none — reuses existing `GET /api/sport-events/{teamId}` and `GET /api/sport-event-types` endpoints.
- **Front (`Front/`)**: none.
