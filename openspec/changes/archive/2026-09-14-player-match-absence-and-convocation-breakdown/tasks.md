## Task 1 — Backend: `GetPlayerConvocationSummary` read-model (≈2h) ✅

**Files**:
`Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Queries/GetPlayerConvocationSummary.cs`

- [x] RED: extend
  `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GetPlayerConvocationSummaryHandlerTests.cs`:
  - Extend `SeedConvocationAsync` to accept optional `assistanceTypeId`/`excuseTypeId` params
    (default null), passed through to `ConvocationModel`.
  - Replace `Handle_NoJustifiedAbsences_ReturnsNullLastJustifiedAbsenceMatch` and
    `Handle_TwoJustifiedAbsences_ReturnsMostRecentWithRivalAndEventType` with equivalents seeding
    `AssistanceTypeId = AssistanceType.ExcusedAbsence.Id` (+ an `ExcuseTypeId`) instead of
    `ConvocationStatusId = Justified`; assert against `result.LastAbsenceMatch` (renamed) including
    `Reason` equals the seeded `ExcuseTypes.FromId(...).Name`.
  - Add a case seeding `AssistanceTypeId = AssistanceType.UnexcusedAbsence.Id` (no excuse) and assert
    `LastAbsenceMatch.Reason` is null.
  - Add a case with convocations across training/friendly/league `SportEvent.EventTypeId` and assert
    `TotalTrainingConvocations`/`TotalFriendlyConvocations`/`TotalLeagueConvocations` each count only
    their own type, and `TotalConvocations` is still the sum across all types (incl. any non-match
    type, if seeded).
  - Update `Handle_TwoDeconvokedMatches_ReturnsMostRecentWithRivalAndEventType` to also seed/assert
    `Reason` on `LastDeconvokedMatch` (seed `ExcuseTypeId` in `SeedConvocationAsync` for that case).
  - Update `Handle_PlayerWithNoConvocationsOrParticipations_ReturnsZeroesAndNulls` to assert the 3
    new breakdown fields are `0` and `LastAbsenceMatch` (renamed) is null.
  - Run `dotnet test --filter GetPlayerConvocationSummaryHandlerTests` — confirm RED (compile
    failures from the rename are expected/fine at this point).
- [x] GREEN: implement per `design.md` — DTO rename/additions, grouped-by-event-type count query,
  `.Include(c => c.ExcuseType)` on both absence queries, switch the "absence" query from
  `ConvocationStatusId == Justified` to `AssistanceTypeId ∈ {ExcusedAbsence, UnexcusedAbsence}`.
- [x] Verify: `dotnet build` and
  `dotnet test --filter GetPlayerConvocationSummaryHandlerTests` pass, 100%.

## Task 2 — Frontend: types + card (≈2h) ✅

**Files**:
- `Front/src/apps/coach/services/convocationService.ts`
- `Front/src/apps/coach/pages/player/components/PlayerConvocationSummaryCard.tsx`
- `Front/src/apps/coach/pages/player/components/PlayerConvocationSummaryCard.module.css`
- `Front/src/apps/coach/pages/player/components/__tests__/PlayerConvocationSummaryCard.test.tsx`

- [x] RED: update `PlayerConvocationSummaryCard.test.tsx` fixtures to the new
  `PlayerConvocationSummary` shape (`totalTrainingConvocations`, `totalFriendlyConvocations`,
  `totalLeagueConvocations`, `lastAbsenceMatch` with `reason`, `lastDeconvokedMatch` with `reason`).
  Add/adjust assertions:
  - 3 breakdown tiles render with correct labels ("Entrenamientos"/"Amistosos"/"Liga") and values.
  - Tile labeled "Última desconvocatoria" (not "Última desconvocación") renders.
  - When `reason` is set, "Motivo: {reason}" text renders inside the corresponding tile; when
    `reason` is null, no motivo line renders.
  - Run `npm run test -- PlayerConvocationSummaryCard` — confirm RED against current component.
- [x] GREEN: update `convocationService.ts` types (`PlayerAbsenceMatch.reason`,
  `PlayerConvocationSummary` new/renamed fields) and `PlayerConvocationSummaryCard.tsx` per
  `design.md`; add `.absenceReason` style to the CSS module.
- [x] Verify: `npm run test -- PlayerConvocationSummaryCard` and `npm run build` pass.

## Task 3 — Manual verification in browser (≈30min)

- [ ] `cd Back/ExtractionApi && dotnet run --project src/RFFM.Host` and `cd Front && npm run dev`.
- [ ] In the coach app, open a player with mixed convocation history (or seed one): confirm the
  "Estadísticas" tab shows 3 separate totals (entrenamientos/amistosos/liga), "Última
  desconvocatoria" with motivo, and "Última ausencia" with motivo populated after marking a player
  "No asiste con excusa" + motivo from the event's "Asistencia" tab (`AttendanceEvent` →
  `AttendanceTabs`) for a past/accepted convocation.
- [ ] Confirm mobile width (~390px) still renders the grid as 2 columns without overflow.

  Deferred by user request — not performed by the agent; user will verify manually.

## Task 4 — Final checks

- [x] `dotnet build && dotnet test` (full backend suite) — 1229/1229 passed, no regressions.
- [x] `npm run build && npm run test` (full frontend suite) — build passes; test suite has 10
  pre-existing failures in `SportEventDialog.test.tsx` and `GameModelFormEditor.test.tsx`,
  unrelated to this change (confirmed via `git status`/`git diff` showing no modifications to
  those files or their sources).
- [x] Update `openspec/specs/spec.md` §9 "Implemented Capabilities" with a one-line entry once
  archived.

## Task 5 — Unplanned: pre-existing ADN game-model importer bugs (fixed at user's request, outside original scope)

Surfaced while investigating two unrelated pre-existing test failures the user asked to be fixed
mid-session. Not part of the convocation/absence feature; kept here for the record.

- [x] `Back/ExtractionApi/src/RFFM.Api/Infrastructure/GameModelImport/AdnLegibleImporter.cs`:
  added missing `CompoundZoneMap` entry for `"Zona de Creación Propia / Iniciación (bloque
  medio)"` (real document heading, analogous to the existing "bloque bajo" entry). RED/GREEN test:
  `AdnLegibleImporterTests.Parse_ZonaCreacionPropiaIniciacionBloqueMedio_ResolvesToBothZoneKeysWithoutLabel`.
- [x] Same file: `SetPieceRuleRegex` didn't accept the real document's numbered-list heading
  format (`1. **Córners.**`), only bare `**Córners.**`; made the numeral prefix optional. RED/GREEN
  test: `AdnLegibleImporterTests.Parse_NumberedListSetPieceHeading_ResolvesToSubtype`.
- [x] Updated two stale hardcoded assertions (`Assert.Equal(7, ...)` → `9`) in
  `AdnLegibleImporterFullDocumentSpotCheckTests.cs` and `GameModelSeederRealDocumentTests.cs` that
  predated the real document's current Principio count (never reached before because the zona
  exception aborted parsing first).
- [x] `SetPieceRuleConfiguration.cs`: widened `SetPieceRules.Texto` from `varchar(4000)` to
  unbounded `text` (Postgres) — the real "Faltas" ABP subsection's nested prose exceeded 4000
  chars. New EF migration `20260914154550_WidenSetPieceRuleTextoColumn`, generated via
  `manage-migrations.ps1` and applied to the local dev database.
