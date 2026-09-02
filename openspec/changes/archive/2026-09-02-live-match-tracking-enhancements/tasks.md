# Tasks: Live Match Tracking Enhancements

Each task follows Red → Green → Refactor (see CLAUDE.md). Backend and Frontend Group A can
run in parallel; Group B (UI) depends on Group A's type/hook changes.

## Backend

### B1 — `MatchParticipation` entity + migration (~1h)
- [ ] Add `FormationChangesJson` property + `Create`/`Update` params in
      `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/TeamPlayers/MatchParticipation.cs`.
- [ ] `dotnet ef migrations add AddFormationChangesJsonToMatchParticipation --startup-project src/RFFM.Host`.
- Verify: `dotnet build`.

### B2 — `SaveMatchParticipation` + `GetMatchParticipation` (~1.5h)
- [ ] `SaveMatchParticipationRequest.FormationChangesJson` + handler wiring
      (`Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Convocations/SaveMatchParticipation.cs`).
- [ ] `GetMatchParticipationResponse`: add `CardsJson` (bug fix — currently dropped) and
      `FormationChangesJson`; update handler mapping
      (`Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Convocations/GetMatchParticipation.cs`).
- [ ] xUnit test (Red first): saving a participation with `CardsJson`/`FormationChangesJson`
      then fetching it via `GetMatchParticipation` returns both fields unchanged.
- Verify: `dotnet test --filter FullyQualifiedName~MatchParticipation`, `dotnet build`.

### B3 — Documentation-only shape update (~0.5h)
- [ ] Update XML doc comments on `CardsJson` (entity) and `GetPlayerSeasonCards.CountCards`
      to describe the richer `CardEvent` shape (minute, half, isRivalPlayer, rivalDorsal) —
      no functional change, `CountCards` already reads by property name.
- Verify: `dotnet build`.

## Frontend

### F1 — Types (~0.5h)
- [ ] Extend `GoalEvent` (`pitchZone`, `bodyPart`), add `CardEvent`, add `FormationChangeEvent`,
      extend `LiveMatchBackup` and `LiveMatchParticipationPayload` in
      `Front/src/apps/coach/pages/convocations/components/simulation/liveMatch.types.ts`.
- Verify: `npm run build` (type-check only, no runtime behavior yet).

### F2 — `useLiveMatch.ts`: unlimited windows option (~1h, TDD)
- [ ] Test (Red): with `unlimitedWindows: true`, `canOpenWindow` stays `true` past
      `MAX_TOTAL_WINDOWS`/`MAX_SECOND_HALF_WINDOWS`; with `false`/default, existing limit
      behavior is unchanged (regression test).
- [ ] Implement `UseLiveMatchOptions`/`unlimitedWindows` param (Green).
- Verify: `npm run test -- useLiveMatch`.

### F3 — `useLiveMatch.ts`: cards (~1.5h, TDD)
- [ ] Test (Red): `addCard`/`removeCard` update `cards` state; `persistMatchParticipation`
      payload includes `cardsJson` matching the recorded cards.
- [ ] Implement `cards` state, `addCard`, `removeCard`, wire into `initMatch`,
      `writeBackup`/`restoreFromBackup`, `persistMatchParticipation` (Green).
- Verify: `npm run test -- useLiveMatch`.

### F4 — `useLiveMatch.ts`: goal zone + body part (~1h, TDD)
- [ ] Test (Red): `addGoal(..., pitchZone, bodyPart)` stores both fields on the resulting
      `GoalEvent`; omitted/`null` values behave like today (regression test for existing calls).
- [ ] Update `addGoal` signature and `GoalEvent` construction (Green).
- Verify: `npm run test -- useLiveMatch`.

### F5 — `useLiveMatch.ts`: mid-match formation change (~2h, TDD)
- [ ] Extract shared `applySlotChange(newSlots, minute)` helper from `commitWindow`'s
      leaving/entering diff logic (Refactor step, done first so F5/F3 build on it cleanly).
- [ ] Test (Red): `changeFormation(id, name, newSlots)` appends a `FormationChangeEvent` to
      `formationChanges`, updates `slots`, and updates `playerStates` consistently with
      `applySlotChange`.
- [ ] Implement `changeFormation`, `formationChanges` state, wiring into `initMatch`,
      backup/restore, `persistMatchParticipation` (`formationChangesJson`) (Green).
- Verify: `npm run test -- useLiveMatch`.

### F6 — `PitchZoneGrid.tsx` (new component) (~1h, TDD)
- [ ] Test (Red): renders 5×10 = 50 cells, clicking a cell calls `onChange({col, row})` with
      the right coordinates, no cell has visible text/name.
- [ ] Implement component + CSS module (Green).
- Verify: `npm run test -- PitchZoneGrid`.

### F7 — `LiveMatchScoreboard.tsx`: goal dialog rework (~2h, TDD)
- [ ] Test (Red): clicking "Gol rival" now opens the dialog (no longer calls `onAddGoal`
      immediately); dialog collects dorsal + pitch zone + body part for rival goals; own-team
      flow still lists `fieldPlayers` and now also collects pitch zone + body part.
- [ ] Implement dialog rework using `PitchZoneGrid` + `ToggleButtonGroup` (Green).
- Verify: `npm run test -- LiveMatchScoreboard`.

### F8 — `GoalTimeline.tsx`: show zone/body-part (~0.5h, TDD)
- [ ] Test (Red): a goal with `pitchZone`/`bodyPart` set renders an extra indicator; a legacy
      goal (`pitchZone: null`) renders exactly as before (regression test).
- [ ] Implement (Green).
- Verify: `npm run test -- GoalTimeline`.

### F9 — Card UI: `CardEventDialog.tsx` + `CardsTimeline.tsx` (new) (~2h, TDD)
- [ ] Test (Red) for `CardEventDialog`: selecting an own player + amarilla calls `onSubmit`
      with `{teamPlayerId, isRivalPlayer:false, rivalDorsal:null, cardType:"yellow"}`;
      selecting "Rival" + entering a dorsal + roja calls `onSubmit` with
      `{teamPlayerId:null, isRivalPlayer:true, rivalDorsal:<n>, cardType:"red"}`.
- [ ] Test (Red) for `CardsTimeline`: renders minute, icon per `cardType`, player name or
      "Rival (#dorsal)", remove button hidden when `readOnly`.
- [ ] Implement both components + wire a new "Tarjeta" button into `LiveMatchScoreboard.tsx`
      (Green).
- Verify: `npm run test -- CardEventDialog CardsTimeline`.

### F10 — Mid-match formation change UI (~2h, TDD)
- [ ] Test (Red) in `PartidoEnDirectoTab.test.tsx`: changing the formation selector during
      `firstHalf` opens a confirmation dialog; confirming calls `live.changeFormation` with
      the new formation id/name/slots; canceling leaves the current formation untouched.
- [ ] Implement the `<Select>` + confirmation `Dialog` + best-effort slot remapping (Green).
- Verify: `npm run test -- PartidoEnDirectoTab`.

### F11 — `SubstitutionWindowTracker.tsx`: unlimited dot-counter branch (~0.5h, TDD)
- [ ] Test (Red): with `unlimitedWindows=true` and `showCounters=true` (default), the
      component renders the raw count with no `/MAX` denominator/dot cap; existing
      `showCounters=false` "Infinitos" behavior is unchanged (regression test).
- [ ] Implement (Green).
- Verify: `npm run test -- SubstitutionWindowTracker`.

### F12 — Thread `isFriendly` from event into the live tracker (~1h, TDD)
- [ ] Test (Red) in `ConvocationMatchDetail.test.tsx` (or nearest existing test file): when
      `getSportEventById` resolves `matchCategory: "Friendly"`, `PartidoEnDirectoTab` receives
      `isFriendly=true` and `useLiveMatch` is called with `unlimitedWindows: true`.
- [ ] Implement `getSportEventById` fetch + prop threading
      (`ConvocationMatchDetail.tsx` → `PartidoEnDirectoTab.tsx` → `useLiveMatch`) (Green).
- Verify: `npm run test -- ConvocationMatchDetail`.

### F13 — Full regression pass (~0.5h)
- [ ] `npm run build`
- [ ] `npm run test` (full suite)
- [ ] Manual smoke test in dev server: start a match, register a goal (own + rival) with
      zone/body-part, register a card (own + rival), open a substitution window on a friendly
      event past the old 4-window cap, change formation mid-match and confirm the dialog,
      save the match, reload the page and confirm all data round-trips via
      `GetMatchParticipation`.

## Order of work
B1 → B2 → B3 can proceed independently of frontend. F1 first (types unblock everything else).
F2/F3/F4/F5 can be done in any order once F1 lands. F6 before F7. F9 depends on F1 only. F10
depends on F5. F11 independent. F12 independent but should land before the final F13 smoke test.
