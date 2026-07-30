## 1. Event types client

- [x] 1.1 (RED) Write `Mobile/src/api/__tests__/sportEventTypes.test.ts` asserting a function calls `GET /api/sport-event-types` and returns an `id → name` map
- [x] 1.2 (GREEN) Implement `Mobile/src/api/sportEventTypes.ts` (thin wrapper over `api.get`, builds the map)

## 2. EventCard component

- [x] 2.1 (RED) Write `Mobile/src/screens/components/__tests__/EventCard.test.tsx` covering: generic event render (title/date/location), match event render (shields/vs/home-away badge), score + result badge (won/draw/lost) when goals present, no result badge when goals absent, tap calls `onPress`
- [x] 2.2 (GREEN) Implement `Mobile/src/screens/components/EventCard.tsx` + `StyleSheet` to pass the tests, reusing `coachColors` from `Mobile/src/theme/colors.ts` per design.md decisions 5-6
- [x] 2.3 (REFACTOR) Extract shared date/result-formatting helpers if duplicated; keep the component focused

## 3. CalendarScreen integration

- [x] 3.1 (RED) Update `Mobile/src/screens/__tests__/CalendarScreen.test.tsx`: replace the plain-text assertions with card-based assertions (title "Eventos", rendered `EventCard` content, unchanged navigation params, unchanged loading/error/empty test IDs), plus a case asserting the event-types request fires alongside the events request
- [x] 3.2 (GREEN) Update `Mobile/src/screens/CalendarScreen.tsx`: rename section title to "Eventos", widen the local `SportEvent` interface with the extra fields, fetch event types in parallel (`Promise.all`) with events, render `EventCard` per item instead of the current `Pressable` row
- [x] 3.3 (REFACTOR) Clean up any now-unused styles in `CalendarScreen.tsx` (card/eventTitle/eventDate/eventOpponent styles superseded by `EventCard`)

## 4. Verification

- [x] 4.1 Run `cd Mobile && npx jest` — 100% pass, no skipped tests (39/39 across the whole Mobile suite)
- [x] 4.2 `npx tsc --noEmit` — no errors outside `__tests__` files (pre-existing repo-wide gap: missing `@types/jest` in tsconfig, not introduced by this change)
- [x] 4.3 Confirmed via `git status` — only `Mobile/` and `openspec/` changed; no `Back/ExtractionApi` or `Front/` files touched

## 5. Follow-up: event time + navigation labels

- [x] 5.1 (RED) Add `EventCard.test.tsx` cases: time shown next to the date for generic events, kickoff time shown next to "vs" for scoreless matches, no time when the component is absent
- [x] 5.2 (GREEN) Add `formatTime` in `EventCard.tsx` and wire it into the generic-event meta row and the match "vs" block
- [x] 5.3 Rename `tabBarLabel` and stack screen `title` from "Calendario" to "Eventos" in `Mobile/src/navigation/RootNavigator.tsx` (no test coverage existed or was added — plain static label strings, no branching logic)
- [x] 5.4 Bug found post-review: displayed time was the raw UTC hour sliced out of the ISO string, not converted to the device's local time zone. (RED) added a regression test asserting the shown time matches `new Date(...).toTimeString()` (device-local) for a `Z`-suffixed UTC input. (GREEN) rewrote `formatTime` to use `new Date(raw).getHours()/getMinutes()` instead of string-slicing, which yields the device's local time automatically
- [x] 5.5 Full suite re-run: 42/42 Mobile tests pass; `tsc --noEmit` clean outside `__tests__`
