## Context

Verified facts:
- Event cards link to `/coach/attendance/{id}` (`EventCard.tsx`); `AttendanceEvent.tsx` shows the attendance form and an «Ir al partido» button that navigates to `/coach/convocations/match?teamId&eventId` with `state.match = toMatchState(event)`.
- `ConvocationTab.tsx` builds its zones from `LEAGUE_ONLY_ZONES` («Lista de espera», «Pendientes de respuesta») plus `COMMON_ZONES` («Disponibles», «Convocados», «Desconvocados») when `isLeagueMatch`.
- `useConvocationManagement` exposes `handleCallPlayers`, `moveToNotCalled(playerId, excuseId?)`, `markAvailable` and `mgmtExcuseMap`; `ConvocationDeconvokeDialog.tsx` already is a reason dialog (MUI `Select`) and `excuseTypes` come from `excuseTypeService`.
- In `notCalled` the reason is rendered as a `Select` outside the card (`ConvocationTab.tsx` ~l.396).
- `isLeagueMatch` reaches `ConvocationTab` from `convocation.mgmtIsLeagueMatch`; `AttendanceTabs` (player/family view) also uses `isLeagueMatch` and must not change.

Assumptions: coach/admin detection uses the existing role helper of the coach auth context; the event is known (`matchCategory`) before deciding to redirect.

## Goals / Non-Goals

Goals:
- Coach/admin open a league match straight on the match page.
- League match page: three zones, waiting-list Convocar/Desconvocar, reason picker, reason inside the deconvoked card.

Non-goals:
- Backend, database or Mobile changes.
- Friendly matches, trainings and the player/family attendance view.
- Removing availability-request endpoints or the player's «Tu jugador» response flow.

## Decisions

### D1. Redirect at the attendance route, not at the card link
`AttendanceEvent` redirects (`navigate(..., { replace: true, state })`) once the event is loaded, when the user is coach/admin and `event.matchCategory === "League"`. This also covers notification deep links to `/coach/attendance/{id}`. Alternative: change `EventCard`'s link only — rejected, it leaves deep links and the back-stack on the form. `replace` avoids a back-button loop.

### D2. Zones are driven by a single list
For league matches the zone config becomes `waiting`, `called`, `notCalled`; friendlies keep the current zones. `mgmtAvailabilityPending` and `mgmtAvailable` of league matches are merged into the waiting list, so any unconvoked player appears in «Lista de espera». `onMarkAvailable` and its button are removed from the tab. Convoking uses `handleCallPlayers` (regular convocation endpoints) instead of the availability decision endpoint (see the REMOVED requirement in the `league-match-availability` delta).

### D3. One reason picker, reused for three entry points
Rework `ConvocationDeconvokeDialog` into the picker of the design: option list (large buttons, selected state in amber), «Cancelar» and «Desconvocar» (disabled without selection), rendered as a bottom sheet on narrow viewports and as a centered dialog on desktop via MUI `Dialog` + `useMediaQuery`. It is opened from waiting-list «Desconvocar», called-card «Desconvocar» and the amber strip of deconvoked cards (change mode, preselected reason). Confirming calls `moveToNotCalled(playerId, excuseId)`, or `onExcuseChange(playerId, excuseId)` when only changing. Alternative: inline select inside the card — rejected, the design asks for a cleaner card and a mandatory choice.

### D4. Reason strip inside the card
`notCalled` cards render a footer strip (`button`, amber tint, «Motivo: {name}» + chevron) styled in `ConvocationTab.module.css`; the outer `Select` is deleted. The amber is defined as a CSS custom property in the module, not hardcoded inline. Cards are stacked (no table) and buttons are at least 44 px.

## Target State

Coach taps a league match event, lands on the match page with «Lista de espera», «Convocados», «Desconvocados». Waiting cards: Convocar / Desconvocar. Deconvoke opens the picker, then the card appears in «Desconvocados» with the «Motivo: X» strip; the strip reopens the picker; «Convocar» brings the player back.

## Risks / Trade-offs

- Existing tests assert the five-zone league layout and the «Disponible» button; they must be updated first (RED). Stale assertions may remain in `ConvocationTab.*.test.tsx`.
- Players with `Requested`/`Available` requests previously in separate zones now merge into the waiting list; acceptable, no data migration.
- Redirect timing: the attendance form could flash before redirect. Keep the existing loading state until the event is loaded and the decision is made.
- `onExcuseChange` for an already deconvoked player must keep persisting through the existing path; the picker only changes the trigger UI.

## Migration Plan

Not applicable: frontend-only change, no schema or data impact. Rollback is a revert of the commit.

## Validation Strategy

Vitest + Testing Library; area-only runs during development, full suite and `npm run build` once at the end.
- `AttendanceEvent`: coach + league navigates to the match page; player + league and coach + friendly stay.
- `ConvocationTab` (league): exactly three zone headings; no «Pendientes de respuesta», «Disponibles» nor «Disponible» button; waiting card shows Convocar and Desconvocar; Convocar calls `onCallPlayers`; Desconvocar opens the picker without moving the player.
- Picker: confirm disabled without selection; confirm calls `moveToNotCalled` with the excuse id; cancel does nothing.
- Deconvoked card: «Motivo: X» inside the card, no combobox in the card, strip opens the picker, «Convocar» reconvokes; friendly layout unchanged.
No real database or external dependency is needed.

## ADR / DDR Evaluation

Neither: UI behavior change inside an existing feature, with no new architectural or domain decision beyond the specs.

## Open Questions

None.
