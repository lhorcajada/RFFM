## 1. Routing: coach lands on the match page

- [x] 1.1 RED: write `AttendanceEvent` tests — coach/admin + league event navigates (replace) to `/coach/convocations/match?teamId&eventId` with match state; player + league and coach + friendly/training do not redirect
- [x] 1.2 GREEN: implement the redirect in `AttendanceEvent.tsx` (keep the loading state until decided); run `npx vitest run src/apps/coach/pages/attendance`
- [x] 1.3 REFACTOR: reuse `toMatchState` for the redirect and the «Ir al partido» button

## 2. Three zones for league matches

- [x] 2.1 RED: update `ConvocationTab` league tests — only «Lista de espera», «Convocados», «Desconvocados»; no «Pendientes de respuesta», «Disponibles» nor «Disponible» button; players with old availability requests appear in the waiting list; friendly zones unchanged
- [x] 2.2 GREEN: change the zone config in `ConvocationTab.tsx`, merge pending/available into waiting in `ConvocationMatchDetail`, remove `onMarkAvailable` usage; run `npx vitest run src/apps/coach/pages/convocations`
- [x] 2.3 Update dependent tests and summary counters (`ConvocationTab.summary/groups/emptyZones`) to the three-zone layout

## 3. Waiting-list actions

- [x] 3.1 RED: tests — waiting card shows «Convocar» and «Desconvocar»; Convocar calls `onCallPlayers([id])`; failure keeps the player in the waiting list and shows the error; Desconvocar opens the picker without moving the player
- [x] 3.2 GREEN: add the action buttons (≥44 px, CSS Module) to waiting cards in `ConvocationTab.tsx`
- [x] 3.3 Wire the called-card «Desconvocar» to open the picker too

## 4. Deconvocation reason picker

- [x] 4.1 RED: picker tests — lists excuse types, «Desconvocar» disabled without selection, confirm calls `moveToNotCalled(playerId, excuseId)`, cancel changes nothing, change mode preselects the current reason
- [x] 4.2 GREEN: rework `ConvocationDeconvokeDialog.tsx` into the option-list picker (bottom sheet on narrow screens, dialog on desktop) with its CSS Module
- [x] 4.3 REFACTOR: single picker state in `ConvocationTab` shared by the waiting, called and deconvoked entry points

## 5. Reason inside the deconvoked card

- [x] 5.1 RED: tests — «Motivo: X» rendered inside the card, no combobox outside, strip opens the picker in change mode and `onExcuseChange` is called, «Convocar» moves the player back to «Convocados»
- [x] 5.2 GREEN: replace the external `Select` with the amber strip and add the «Convocar» button in `ConvocationTab.tsx` / `ConvocationTab.module.css`
- [x] 5.3 Check the card at ~360 px in the dark coach theme (visual check only if the user asks)

## 6. Wrap-up

- [x] 6.1 Bump `Front/package.json` minor version (feat)
- [ ] 6.2 Run the full suite once (`npx vitest run --maxWorkers=4`) and `npm run build`; fix regressions
- [x] 6.3 `openspec validate league-match-coach-convocation --strict`
