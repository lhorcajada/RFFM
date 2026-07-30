## Why

The Mobile app's calendar screen shows a plain, minimal list of events (title, raw datetime string, rival name) with no visual identity. Coach web already has a rich, well-tested event card component (`EventCard.tsx`) that surfaces match context (shields, score, home/away, result) and general event context (type icon, location) at a glance. Bringing that same visual language to Mobile improves scannability for families/players and gives coaches viewing Mobile a consistent experience with the web app they already know.

## What Changes

- Rename the calendar list section title in Mobile to "Eventos".
- Replace the current `Pressable` row items in `Mobile/src/screens/CalendarScreen.tsx` with card components mirroring Coach's `EventCard.tsx` visuals: header (type icon/gradient for generic events, team shields + score/result for matches), title, date, location, rival.
- Mobile's local `SportEvent` type is widened to consume fields the `GET /api/sport-events/{teamId}` endpoint **already returns** but Mobile currently discards: `location`, `isHomeMatch`, `teamName`, `teamPhotoUrl`, `rivalPhotoUrl`, `localGoals`, `visitorGoals`. Event type name is resolved the same way Coach does it: a call to the existing `GET /api/sport-event-types` endpoint, mapped by `eventTypeId`.
- Tapping a card keeps today's behavior: navigate to `EventDetail`. No edit/delete/attendance/live-match actions in this change — Mobile has no role system yet to gate them safely (tracked as a separate future feature-request).
- No backend changes: both endpoints already exist and already expose everything needed (confirmed by reading `GetSportEvents.cs` and `GetSportEventTypes.cs` in `Back/ExtractionApi`).
- Cards show the event time (and, for matches without a score, the kickoff time), converted from the backend's UTC `eveDateTime` to the device's local time zone — not the raw UTC hour.
- Rename the Mobile navigation labels from "Calendario" to "Eventos": the bottom tab (`tabBarLabel`) and the stack screen header (`title`) in `Mobile/src/navigation/RootNavigator.tsx`.

## Capabilities

### New Capabilities
- `mobile-event-cards`: Mobile calendar screen renders events as visual cards (Coach-style) instead of plain list rows, using data already available from the existing sport-events and sport-event-types endpoints.

### Modified Capabilities
(none — no existing spec covers Mobile calendar; no API contract changes)

## Impact

- **Mobile only**: `Mobile/src/screens/CalendarScreen.tsx` and its tests; new card sub-component + styles; a small client for `GET /api/sport-event-types`; `Mobile/src/navigation/RootNavigator.tsx` (tab/header labels).
- **Backend**: none.
- No changes to Coach web (`Front/src/apps/coach`) — used only as the visual/data reference.
