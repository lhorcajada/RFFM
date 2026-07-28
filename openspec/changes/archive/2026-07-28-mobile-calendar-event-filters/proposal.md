## Why

`Mobile/src/screens/CalendarScreen.tsx` always requests the first 50 events for the active team (`pageNumber: 1, pageSize: 50, descending: false`) and renders every one of them, with no way for the user to narrow the list. As a team accumulates entrenamientos, partidos and other event types over a season, both coaches and families/players lose the ability to quickly find "just the matches" or "just next month's training sessions" — they have to scroll through everything. The backend already supports exactly the filtering needed: `GET /api/sport-events/{teamId}` (`Back/ExtractionApi/src/RFFM.Api/Features/Coaches/SportEvents/Queries/GetSportEvents.cs`) accepts `startDate`/`endDate` query params and filters server-side on `EveDateTime`, and `GET /api/sport-event-types` already backs the `eventTypeId → name` map Mobile fetches today via `fetchSportEventTypeMap()`. No backend change is needed.

## What Changes

- **Mobile only**: add a filter entry point (button/icon) to `CalendarScreen.tsx` that opens a filter panel with two controls: event type (single-select from the same type map already fetched via `fetchSportEventTypeMap`) and a date range (start/end).
- Date range is sent to the backend as `startDate`/`endDate` params on the existing `GET /api/sport-events/{teamId}` call. Event type is filtered **client-side** on the already-fetched `events` array (the endpoint has no `eventTypeId` query param and none is being added).
- Filters persist locally (device-level, per logged-in user, not per team) so they survive app restarts and team switches, and are re-applied automatically the next time `CalendarScreen` loads, until the user explicitly changes or clears them.
- A visible "clear filters" action resets both controls and reloads the unfiltered (still team-scoped, still paginated as today) list.
- Empty-state message is shown (reusing the existing `empty-message` pattern) when filters produce zero matching events — never treated as an error.
- Switching teams keeps the saved filters (they are global to the user) but always re-queries the backend with the current team's `teamId` and the saved `startDate`/`endDate`.

## Capabilities

### New Capabilities
- `mobile-calendar-event-filters`: `CalendarScreen` gains a user-controlled, persisted filter (event type + date range) narrowing the events list, combining a server-side date filter with a client-side type filter.

### Modified Capabilities
(none — no existing spec covers Mobile calendar filtering)

## Impact

- **Mobile**: `Mobile/src/screens/CalendarScreen.tsx` (wire filter state into the existing fetch effect), a new filter UI component + its test file, a new small persistence hook/module + its test file. New dependency: `@react-native-community/datetimepicker` (confirmed included in Expo Go for Expo SDK 54 / docs v57, `npx expo install`-able — no dev-build/prebuild required).
- **Backend**: no changes — `GetSportEvents.cs` already accepts and filters on `startDate`/`endDate`.
- **Front (web)**: not touched.
