## 1. Backend — allow reason on "Llegó tarde" (~30 min)

- [ ] `UpdateConvocationAssistance.cs`: extend the `ExcuseTypeId`-allowed condition to
  `AssistanceType.ExcusedAbsence.Id || AssistanceType.LateArrival.Id`.
- [ ] `UpdateConvocationAssistanceHandlerTests.cs`: RED — add a test asserting `LateArrival` +
  `ExcuseTypeId` persists the excuse (currently fails/cleared); add a test asserting `LateArrival`
  without `ExcuseTypeId` still leaves it null (regression guard). GREEN — apply the handler change.
- Verify: `dotnet test --filter UpdateConvocationAssistanceHandlerTests`

## 2. Backend — attendance ratio in `GetTeamPlayerStatistics` (~2h)

- [ ] RED — write/extend `GetTeamPlayerStatisticsHandlerTests.cs`:
  - Seed a team with finished trainings/friendlies/league matches (past `EveDateTime`) and at least
    one future (not-yet-finished) event of each type that must NOT count.
  - Seed a player whose `TeamPlayer.JoinedDate` is after some of the finished events — assert those
    pre-join events are excluded from `Possible`.
  - Seed convocations with `AssistanceType.Attendance`, `LateArrival` (both count as attended),
    `ExcusedAbsence`, `UnexcusedAbsence` (don't count as attended but the event still counts as
    `Possible`), and a player with no convocation at all for an event (still counts as `Possible`,
    0 attended).
  - Assert `Trainings`, `Friendlies`, `League` ratios independently per player.
  - Run and confirm these fail against current code (bare `TrainingsAttended`/`MatchesPlayed` ints
    won't even compile against the new DTO shape — expected Red).
- [ ] GREEN — apply the `GetTeamPlayerStatistics.cs` changes from `design.md`:
  DTO (`AttendanceRatioDto`, `Trainings`/`Friendlies`/`League` replacing
  `TrainingsAttended`/`MatchesPlayed`), `TeamPlayerProjection` +`JoinedDate`/`LeftDate`, the unified
  `finishedEvents` query, `attendedByPlayerAndType`, `PossibleFor`/`AttendedFor` helpers per player.
  Remove the dead `allTrainingEventIds`/`allTrainingConvocations`/`trainingsAttendedByPlayer` blocks
  and the old `matchesPlayed` line.
- [ ] Refactor if needed, keep tests green.
- Verify: `dotnet build` && `dotnet test --filter GetTeamPlayerStatisticsHandlerTests`

## 3. Frontend — attendance ratio display (~1h)

- [ ] RED — `SquadStatistics.test.tsx`: update/add a test asserting the three tiles render
  "X de Y" using `trainings`/`friendlies`/`league` fixture shape (fails against current
  `trainingsAttended`/`matchesPlayed` fixture and rendering).
- [ ] GREEN — `teamPlayerStatisticsService.ts`: replace `trainingsAttended`/`matchesPlayed` with
  `trainings`/`friendlies`/`league: AttendanceRatio` types. `SquadStatistics.tsx`: render the three
  "X de Y" tiles per `design.md`.
- Verify: `npm run test -- SquadStatistics` && `npm run build`

## 4. Frontend — thread assistance state through the live-match hooks (~1.5h)

- [ ] RED — `useConvocationPlayerViews.test.tsx`: add a test asserting `assistanceTypeId`/
  `excuseTypeId`/`excuseReasonName` on `lineupPlayers` come from the new `assistanceMap`/`excuseMap`/
  `excuseTypesById` inputs (fails — inputs/fields don't exist yet).
- [ ] GREEN — `IdealLineup.tsx`: add the three optional fields to `SquadPlayer`.
  `useConvocationPlayerViews.ts`: accept `assistanceMap`, `excuseMap`, `excuseTypesById` in
  `ConvocationPlayersInput`, set the three fields on every `lineupPlayers` entry.
  `useConvocationManagement.ts`: build `assistanceInit` alongside the existing `excuseInit` loop,
  add `mgmtAssistanceMap` state + return it.
  `ConvocationMatchDetail.tsx`: build `excuseTypesById` (`useMemo` over `convocation.excuseTypes`,
  same pattern as `matchAttendanceState.ts`), pass `mgmtAssistanceMap`, `mgmtExcuseMap`,
  `excuseTypesById` into the `useConvocationPlayerViews` call.
- Verify: `npm run test -- useConvocationPlayerViews` && `npm run build`

## 5. Frontend — live-match badge for absent/late players (~1.5h)

- [ ] RED — `BenchPlayerCard.test.tsx`: add tests for `hasPlayed=false` with
  `assistanceTypeId=2/3/4` (+ `excuseReasonName` set/unset) asserting the correct badge text/title;
  add a regression test that `assistanceTypeId=null` (or `1`/`Attendance`, shouldn't reach this
  branch anyway) still renders the plain `—`.
- [ ] GREEN — `BenchPlayerCard.tsx`: replace the bare `—` fallback with the badge logic from
  `design.md`. Add `.benchAbsentTag`/`.benchLateTag` to `SimulacionTab.module.css` (check existing
  theme tokens/colors before picking new ones, per `react.md` §5).
- [ ] Manually sanity-check in the running app (`npm run dev`): open a finished/live match with at
  least one accepted player marked `ExcusedAbsence`/`UnexcusedAbsence`/`LateArrival` via the
  Asistencia tab, confirm the badge shows in both `PartidoEnDirectoTab` and `SimulacionTab` bench
  lists (all 6 render sites use the same component, but verify visually since none were touched
  directly).
- Verify: `npm run test -- BenchPlayerCard` && `npm run build`

## 6. Full verification (~30 min)

- [ ] `dotnet build && dotnet test` (backend, full suite for the touched projects)
- [ ] `npm run build && npm run test` (frontend)
- [ ] `openspec validate player-attendance-ratio-and-live-match-status --strict`
- [ ] Review diff for stray debug code / unused old fields before requesting commit confirmation
  (per `.claude/rules/git.md` §6.3 — no commit/push without explicit user confirmation).
