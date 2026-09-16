Technical script for `openspec-implementer`. Follow TDD strictly: write/extend the test file for a
step, run it and confirm it fails (Red), then write the minimal production code (Green), then move
to the next step. Do not batch all production code before running any test.

Read `design.md` in this change folder for full rationale and code sketches before starting — this
file is the execution checklist, `design.md` has the "why" and the exact snippets.

---

## Step 1 — `UpdateConvocationAssistance.cs`: allow reason on "Llegó tarde"

File: `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Convocations/UpdateConvocationAssistance.cs`

1. Find the existing xUnit test file for this handler (search `UpdateConvocationAssistance` under
   `tests/`). Add two `[Fact]`s:
   - `Handle_WithLateArrivalAndExcuseTypeId_PersistsExcuse` — asserts `conv.ExcuseTypeId` is set.
   - `Handle_WithLateArrivalAndNoExcuseTypeId_LeavesExcuseNull` — regression guard.
   Run `dotnet test --filter UpdateConvocationAssistance` and confirm both new tests fail (the second
   should already pass — confirm it doesn't regress once code changes; the first must fail first).
2. In the handler, change:
   ```csharp
   if (request.AssistanceTypeId == AssistanceType.ExcusedAbsence.Id)
   ```
   to:
   ```csharp
   var excuseAllowed = request.AssistanceTypeId == AssistanceType.ExcusedAbsence.Id
       || request.AssistanceTypeId == AssistanceType.LateArrival.Id;

   if (excuseAllowed)
   ```
   (keep the rest of the `if`/`else` body unchanged).
3. Re-run `dotnet test --filter UpdateConvocationAssistance` — both new tests green, no regressions.

## Step 2 — `GetTeamPlayerStatistics.cs`: attendance ratio

File: `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Queries/GetTeamPlayerStatistics.cs`

1. Find or create `GetTeamPlayerStatisticsHandlerTests.cs` under the matching test project (mirror
   the folder structure per `.claude/rules/testing.md` / `dotnet.md` — same relative path under
   `tests/` as the feature file). Write failing tests (RED) per `tasks.md` §2:
   - finished vs. future events per type (only finished count toward `Possible`)
   - player `JoinedDate` after some finished events → those excluded from `Possible`
   - `Attendance`/`LateArrival` count as attended; `ExcusedAbsence`/`UnexcusedAbsence`/no-convocation
     count toward `Possible` but not `Attended`
   - assert `Trainings`, `Friendlies`, `League` independently
   These will fail to compile against the current DTO — that's expected Red; write them against the
   target shape from `design.md` (`AttendanceRatioDto`, `Trainings`/`Friendlies`/`League`).
2. Apply the DTO change: add `AttendanceRatioDto(int Attended, int Possible)`, replace
   `TrainingsAttended`/`MatchesPlayed` in `PlayerStatisticsDto` with `Trainings`/`Friendlies`/`League`.
3. Add `using RFFM.Api.Features.Coaches.SportEvents.Queries;` (for `SportEventsConstants`).
4. Extend `TeamPlayerProjection` with `JoinedDate`/`LeftDate` and select them from `db.TeamPlayers`.
5. Replace the old training-only "season totals" block (`allTrainingEventIds`,
   `allTrainingConvocations`, `trainingsAttendedByPlayer`) with the unified `finishedEvents` /
   `convocationsForFinishedEvents` / `attendedByPlayerAndType` queries from `design.md`.
6. Inside the per-player `foreach`, replace the `trainingsAttended`/`matchesPlayed` lookups and the
   `PlayerStatisticsDto` construction with the `PossibleFor`/`AttendedFor` helpers and the three
   `AttendanceRatioDto` values, per `design.md`.
7. Remove the now-unused old `matchesPlayed = playerParticipations.Count` line and any now-dead
   variables. Leave `MinutesPlayed`/`Goals`/cards computation from `playerParticipations` untouched.
8. Run `dotnet build` (fix compile errors) then `dotnet test --filter GetTeamPlayerStatistics` until
   green. Confirm the 8-week "Rodaje" windowed blocks (`trainingConvocationsInWindow`,
   `matchMinutesInWindowByPlayer`, `PlayerReadinessCalculator.Calculate` call) are untouched and their
   existing tests still pass.

## Step 3 — Frontend stats display

Files: `Front/src/apps/coach/services/teamPlayerStatisticsService.ts`,
`Front/src/apps/coach/pages/squad/components/SquadStatistics.tsx` (+ its `__tests__`).

1. RED: update `SquadStatistics.test.tsx` fixtures to the new `trainings`/`friendlies`/`league`
   shape and assert the three tiles render `"{attended} de {possible}"` text. Run
   `npm run test -- SquadStatistics` and confirm it fails (old fixture shape / old rendering).
2. GREEN: update the `PlayerStatistics` type in `teamPlayerStatisticsService.ts`
   (`trainings`/`friendlies`/`league: AttendanceRatio`, remove `trainingsAttended`/`matchesPlayed`).
   Update `SquadStatistics.tsx` rendering per `design.md` (three tiles, same CSS classes reused).
3. Search the repo for any other reader of `trainingsAttended`/`matchesPlayed` from this service
   (`grep -rn "trainingsAttended\|matchesPlayed" Front/src`) and update/remove as needed — do not
   leave a dangling reference to the removed fields.
4. `npm run test -- SquadStatistics` green, then `npm run build`.

## Step 4 — Thread assistance state through the live-match hooks

Files: `Front/src/apps/coach/pages/squad/components/IdealLineup.tsx` (`SquadPlayer` type),
`Front/src/apps/coach/pages/convocations/hooks/useConvocationPlayerViews.ts`,
`Front/src/apps/coach/pages/convocations/hooks/useConvocationManagement.ts`,
`Front/src/apps/coach/pages/convocations/ConvocationMatchDetail.tsx`.

1. RED: extend `useConvocationPlayerViews.availability.test.tsx` (or add a new test file next to it)
   asserting that passing `assistanceMap`/`excuseMap`/`excuseTypesById` produces
   `assistanceTypeId`/`excuseTypeId`/`excuseReasonName` on the returned `lineupPlayers` entries. Run
   and confirm it fails (fields/inputs don't exist yet).
2. GREEN, in this order:
   a. `IdealLineup.tsx`: add `assistanceTypeId?: number | null`, `excuseTypeId?: number | null`,
      `excuseReasonName?: string | null` to `SquadPlayer`.
   b. `useConvocationPlayerViews.ts`: add the three inputs to `ConvocationPlayersInput`, set the
      three new fields on every `lineupPlayers` mapped entry (see `design.md` snippet).
   c. `useConvocationManagement.ts`: add `assistanceInit` construction next to the existing
      `excuseInit` loop (~line 259-266), add `mgmtAssistanceMap` state (`useState`), set it alongside
      `setMgmtExcuseMap`, add it to the hook's returned object.
   d. `ConvocationMatchDetail.tsx`: build `excuseTypesById` via `useMemo` over
      `convocation.excuseTypes` (`Map<number, { name, justified }>`, mirror
      `matchAttendanceState.ts`'s shape), pass `mgmtAssistanceMap`, `mgmtExcuseMap`, `excuseTypesById`
      into the existing `useConvocationPlayerViews({...})` call.
3. Re-run the test from step 1 — green. `npm run build`.

## Step 5 — Live-match badge for absent/late players

File: `Front/src/apps/coach/pages/convocations/components/simulation/BenchPlayerCard.tsx` (+ CSS in
`Front/src/apps/coach/pages/convocations/components/SimulacionTab.module.css`).

1. RED: create/extend `BenchPlayerCard.test.tsx` with cases for `hasPlayed=false` +
   `assistanceTypeId` = 2 (ExcusedAbsence), 3 (UnexcusedAbsence), 4 (LateArrival), each with and
   without `excuseReasonName`; assert badge text/title. Add one case with `assistanceTypeId=null` /
   `hasPlayed=false` asserting the plain `—` still renders (no regression). Run and confirm the new
   assertions fail against the current `—`-only rendering.
2. GREEN: replace the `hasPlayed ? ... : <span className={styles.benchNoPlayTag}>—</span>` branch
   with the badge logic from `design.md` §"BenchPlayerCard.tsx". Add `.benchAbsentTag`/`.benchLateTag`
   rules to `SimulacionTab.module.css` — check existing color tokens in that file (and
   `matchAttendanceState.ts`'s `MATCH_STATE_RGB` for an established palette) before adding new hex
   values; reuse rather than invent.
3. `npm run test -- BenchPlayerCard` green.
4. Manual check: `npm run dev`, open Coach → Convocatorias → a match with an accepted player marked
   `ExcusedAbsence`/`UnexcusedAbsence`/`LateArrival` via the Asistencia tab (mark one there first if
   none exists), open both `PartidoEnDirectoTab` (live) and `SimulacionTab` (prepare) bench lists,
   confirm the badge renders with the right label + reason tooltip.

## Step 6 — Full verification

1. `dotnet build && dotnet test` — full backend suite for touched projects, no regressions.
2. `npm run build && npm run test` — full frontend suite, no regressions.
3. `openspec validate player-attendance-ratio-and-live-match-status --strict` — must pass with no
   errors before requesting commit.
4. `git status` / `git diff --stat` — review the full diff for stray debug code, unused imports, or
   leftover dead fields before asking the user to confirm commit (per `.claude/rules/git.md` §6.3 —
   never commit/push without explicit confirmation, even after this script completes).
