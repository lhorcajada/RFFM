## Context

`Mobile/src/screens/CalendarScreen.tsx` renders a plain `FlatList` of `Pressable` rows (title, raw `eveDateTime` string, `vs {rivalName}`) fetched from `GET /api/sport-events/{teamId}`. The endpoint (`Back/ExtractionApi/.../Coaches/SportEvents/Queries/GetSportEvents.cs`) already returns `Location`, `IsHomeMatch`, `TeamName`, `TeamPhotoUrl`, `RivalName`, `RivalPhotoUrl`, `LocalGoals`, `VisitorGoals`, `EventTypeId` — Mobile's local `SportEvent` interface just doesn't declare them. Coach's `Front/src/apps/coach/pages/attendance/EventCard.tsx` (+ `.module.css`) is the reference visual: a fixed-height "chrome card" with a colored header (emoji + gradient by event type, or a football-pitch header with shields/score for matches), and a body with title/date/location/rival. Coach resolves `eventTypeName` via a separate call to `GET /api/sport-event-types`, mapped by `eventTypeId` (see `Attendance.tsx`).

React Native has no CSS Modules — visuals must be re-expressed as `StyleSheet.create` objects, reusing `Mobile/src/theme/colors.ts` (`coachColors`, already 1:1 synced from the Coach MUI theme) instead of introducing new color literals.

## Goals / Non-Goals

**Goals:**
- Rename the calendar screen's section title to "Eventos", and the Mobile navigation labels (bottom tab + stack header) that pointed to it from "Calendario" to "Eventos".
- Render each event as a card component visually equivalent to Coach's `EventCard` (adapted to RN primitives: `View`/`Text`/`Image` + `StyleSheet`, `LinearGradient` for header backgrounds if already a project dependency, otherwise a flat header color as a documented simplification).
- Reuse 100% existing backend data (`sport-events` + `sport-event-types` endpoints) — no API contract changes.
- Preserve current interaction: tapping a card navigates to `EventDetail` with the same params as today.
- Preserve current loading/error/empty states (test IDs `loading-indicator`, `error-message`, `retry-button`, `empty-message` stay stable).

**Non-Goals:**
- No edit/delete/attendance/live-match actions (Mobile has no role system to gate them — separate future feature-request).
- No changes to `Back/ExtractionApi` or to Coach web.
- No pixel-perfect port of CSS gradients/box-shadows — RN styling approximates the Coach look (rounded corners, colored header block, shield circles, score typography) rather than replicating every CSS effect (skew shine overlays, multi-layer box-shadow borders).

## Decisions

1. **New `EventCard` component under `Mobile/src/screens/components/EventCard.tsx`** (+ co-located `.test.tsx`), consumed by `CalendarScreen`. Keeps `CalendarScreen.tsx` focused on data-fetching/state, mirrors the "one card, one file" shape of the Coach reference.
   - *Alternative considered*: inline the card markup in `CalendarScreen.tsx`. Rejected — the card has enough branching (match vs. generic, home/away, has-score) to warrant its own tested unit.

2. **Extend the local `SportEvent` interface** in `CalendarScreen.tsx` to match the real API shape (`location`, `isHomeMatch`, `teamName`, `teamPhotoUrl`, `rivalPhotoUrl`, `localGoals`, `visitorGoals`, `eventTypeId`), instead of introducing a shared DTO package. Mobile has no shared-types module today; matching Coach's `SportEventResponse` field names keeps future alignment cheap.

3. **Fetch event types once per screen mount** via a new `Mobile/src/api/sportEventTypes.ts` (thin wrapper around `api.get('/api/sport-event-types')`), build an `id → name` map, pass the resolved name into `EventCard`. Mirrors Coach's `eventTypeMap` pattern in `Attendance.tsx`. Fetched in parallel with the events request (`Promise.all`) to avoid a sequential network waterfall.

4. **Match detection reuses the same heuristic as Coach**: `eventTypeName.toLowerCase().includes('partido')`. No new backend flag — keeps behavior identical to web without a data model change.

5. **Header visuals**: `expo-linear-gradient` is not currently a Mobile dependency (checked `Mobile/package.json`). Adding a native Expo module for a styling nicety is out of proportion to this change, so headers use a solid `backgroundColor` matching each gradient's midpoint color (entrenamiento = `#2e7d32` green, torneo/competición = `#c62828` red, generic = `#455a64` slate) instead of introducing the dependency now.

6. **Score/result badge**: only rendered when `localGoals`/`visitorGoals` are both present and numeric — same guard as Coach's `getMatchResult`. Result label uses the same three states (`Victoria`/`Empate`/`Derrota`) with the equivalent color tokens from `coachColors` (`primary` for won accent context is insufficient — reuse literal green/orange/red used by Coach's `.resultWon/.resultDraw/.resultLost` since `coachColors` doesn't have semantic win/draw/lose tokens; add them if a second consumer appears, not now).

7. **Event time display and timezone conversion**: the backend stores and returns `eveDateTime` as UTC (`DateTime.SpecifyKind(..., DateTimeKind.Utc)` in `CreateSportEvent.cs`; `timestamptz` column via Npgsql). Mobile parses the raw string with `new Date(raw)` and reads the time via `getHours()`/`getMinutes()` — JS `Date` methods without an explicit `timeZone` return the **device's local time**, so the displayed hour automatically matches the phone's timezone instead of the raw UTC hour. This fixed an initial bug where `formatTime` sliced the UTC time directly out of the ISO string (`raw.split('T')[1]`) with no timezone conversion. Time is shown next to the date for generic events (`fecha · hora`) and next to "vs" for matches without a score yet (kickoff time); hidden when the time component is absent or is exactly midnight, mirroring Coach's `EventCard` heuristic.
   - *Alternative considered*: use `Intl.DateTimeFormat`/`toLocaleTimeString('es-ES')` for locale-aware formatting consistent with `formatDate`. Deferred — plain `getHours()/getMinutes()` already fixes the correctness bug (wrong timezone) with less runtime cost; revisit if Hermes's `Intl` support needs to be leaned on for other locale-formatting needs.

## Risks / Trade-offs

- **[Risk] RN has no native CSS gradients/shadows** → mitigated by using flat header colors (midpoint of each Coach gradient) instead of adding `expo-linear-gradient` as a new dependency; documented, deliberate visual simplification, not an oversight.
- **[Risk] Existing tests assert exact plain-text rendering** (`getByText('2026-07-27')`, `getByText('vs Barcelona')`) → these will be rewritten as part of Red-Green-Refactor for the new card output; no production behavior is preserved by coincidence, it's redesigned intentionally per this proposal.
- **[Risk] Card height fixed at 320px on web** doesn't translate directly to mobile list density → use a shorter fixed height tuned for phone screens (matching Coach's own `@media (max-width: 480px)` compact variant, ~230px, as the mobile baseline) rather than the desktop 320px.

## Open Questions

(none — resolved above)
