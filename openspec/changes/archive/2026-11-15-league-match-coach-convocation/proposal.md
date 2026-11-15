## Why

For league matches the coach still goes through the event attendance form and then taps "Ir al partido", although the match page already shows the convocation. The match page also keeps the player-availability lists («Pendientes de respuesta», «Disponibles») even though the coach alone decides who is called up, and the deconvocation reason is a loose selector outside the player card.

## What Changes

- Coaches and administrators opening a league match event (`matchCategory === "League"`) land directly on the match page (`/coach/convocations/match`), skipping the attendance form (`/coach/attendance/{id}`). Players and family keep the attendance page.
- On the match page of a league match, `ConvocationTab` shows only three zones: «Lista de espera», «Convocados» and «Desconvocados». The zones «Pendientes de respuesta» and «Disponibles» are removed, together with the «mark as available» action.
- Waiting-list cards expose two coach actions: **Convocar** and **Desconvocar**. Desconvocar opens a reason picker (bottom sheet on mobile, dialog on desktop) before moving the player to «Desconvocados».
- Called cards keep a **Desconvocar** action that also asks for the reason.
- Deconvoked cards show the reason inside the card as an amber strip («Motivo: X») that opens the reason picker to change it; the loose selector outside the card is removed. A **Convocar** action reverts the player.
- Non-league matches (friendlies) keep their current zones and behaviour.

## Capabilities

### New Capabilities
- `league-match-coach-convocation`: coach-only convocation flow for league matches (direct landing on the match page, three zones, waiting-list actions, deconvocation reason picker, reason inside the deconvoked card).

### Modified Capabilities
- `league-match-availability`: the match page no longer surfaces availability-request states («Pendientes de respuesta», «Disponibles») for the coach; backend endpoints are unchanged.

## Impact

- Frontend only (`Front/`, coach app): `ConvocationTab.tsx` (+ module CSS), `ConvocationMatchDetail.tsx`, `ConvocationPlayerRow`-style card rendering, `AttendanceEvent.tsx` / `EventCard.tsx` (routing), reason picker component, related tests.
- No API, database or Mobile changes. Existing endpoints for convocation, excuse types and availability requests are reused as they are.
- Version bump: `Front/package.json` minor (feat).

## Proposal Research Documentation

**Local files**:
- Front/src/apps/coach/pages/convocations/components/ConvocationTab.tsx
- Front/src/apps/coach/pages/convocations/ConvocationMatchDetail.tsx
- Front/src/apps/coach/pages/attendance/AttendanceEvent.tsx
- Front/src/apps/coach/pages/attendance/EventCard.tsx
- Front/src/apps/coach/pages/attendance/AttendanceTabs.tsx
- Front/src/apps/coach/muiCoachTheme.ts
- openspec/specs/league-match-availability/spec.md
- .design/convocatoria-partido/project/Main.dc.html
- .design/convocatoria-partido/project/Motivo.dc.html

**External URLs**:
- https://claude.ai/artifact/8gQCjFbuWxwEhUm68B3ED1 (design canvas)

## Additional Notes

- Reasons already exist as `excuseTypes` + `mgmtExcuseMap` + `onExcuseChange` in `ConvocationTab`; the picker reuses them instead of inventing a new list. The reasons in the design mockup are illustrative.
- The design uses the dark navy coach palette (`#07071a` / `#1c1c30`, blue `#4d9de0`, amber `#f2a65a`).
