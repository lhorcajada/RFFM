## Why

The Coach app's `EventCard` (used in the "Eventos" list and the dashboard's "Próximos eventos" widget) hides the arrival-time chip for anything that isn't a training, has no visible event-type tag on the match header, and — on mobile (≤480px) — clips most of its status/attendance chips because the fixed-height card doesn't reserve enough room for the content it now needs to show. Users need arrival time visible for every event type, a clearly placed event-type tag, and all chips legible at every breakpoint without overlap or clipping.

## What Changes

- Show the "Llegada HH:MM" chip for any event type (not just training), whenever `event.arrivalDate`/`event.arrival` has a value.
- Add a single, shared event-type tag (chip) lateralized to the left edge of the card header, implemented once for both the compact (dashboard) and non-compact (Eventos) card, not duplicated per mode.
- Consolidate the body's chip rows (Partido / Llegada / Convocatoria) into one wrapping row, always rendered in flow (not absolutely positioned), preserving the existing flex-shrink:0 anti-overlap fix from the prior session.
- Increase the fixed card/body height budget (desktop and the `@media (max-width:480px)` breakpoint) so the reorganized header + body content — including the 5-chip attendance badges row — fits without being clipped by `overflow:hidden`, instead of only patching one CSS value.
- No change to `compact` (dashboard) sizing behavior — it already uses `height:auto`.

## Capabilities

### New Capabilities
- `coach-event-card-layout`: layout/content rules for the Coach app's `EventCard` (header event-type tag, arrival-time visibility, chip rows, and the fixed-height budget that keeps them all clip-free at every breakpoint).

### Modified Capabilities
(none — `EventCard` has no existing `openspec/specs/` entry, so this is introduced as a new capability rather than a delta)

## Impact

- `Front/src/apps/coach/pages/attendance/EventCard.tsx`
- `Front/src/apps/coach/pages/attendance/EventCard.module.css`
- Existing tests: `Front/src/apps/coach/pages/attendance/__tests__/EventCard.trainingBadges.test.tsx` (one assertion is now stale per the new "arrival always visible" behavior and will be updated)
- No backend impact. No other consumers of `EventCard` besides `AttendanceTabs.tsx` and `UpcomingEventsWidget.tsx`.
