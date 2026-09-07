## 1. Domain — nullable session schedule

- [x] 1.1 `Domain/Aggregates/Training/TrainingSession.cs`: change `Date` to `DateTime?` and
      `StartTime` to `TimeSpan?`.
- [x] 1.2 `Infrastructure/Persistence/Configuration/Aggregates/Trainings/
      SessionTrainingEntityConfiguration.cs`: drop `.IsRequired()` on `Date`/`StartTime`
      (`IsRequired(false)`, matching the existing `EndTime` convention).
- [x] 1.3 EF Core migration `MakeSessionDateAndStartTimeNullable` (`app` schema), mirroring
      `20260829164526_MakeEventDateTimeAndStartTimeNullable`'s `AlterColumn` shape for
      `SportEvent`. No default value needed (existing rows keep their real dates).

## 2. Domain — session targets (Sub-subprincipio join)

- [x] 2.1 New `Domain/Aggregates/Training/TrainingSessionSubSubPrincipio.cs` (per design.md
      Decision 2): `BaseEntity`, `TrainingSessionId`, `SubSubPrincipioId`, private ctor + public
      ctor with guard clauses.
- [x] 2.2 `TrainingSession.cs`: add `List<TrainingSessionSubSubPrincipio> Targets { get; set; }
      = new();` and `ReplaceTargets(IEnumerable<string> subSubPrincipioIds)` (clear + rebuild
      with `.Distinct()`, same "trust server-derived state" pattern as
      `SessionBlock.ReplaceExercises`).
- [x] 2.3 New EF config `TrainingSessionSubSubPrincipioConfiguration.cs` (same directory as
      `SessionTrainingEntityConfiguration.cs`): table `TrainingSessionSubSubPrincipios`,
      cascade FK to `TrainingSession` and cascade FK to `SubSubPrincipio`, indexes on both FK
      columns (design.md Decision 2).
- [x] 2.4 Confirm the exact navigation chain `SubSubPrincipio → (SubprincipioId direct |
      ZonaId → Zona.SubprincipioId) → Subprincipio.GamePrincipleId → GamePrinciple.GameModelId
      → GameModel.TeamId` against the real entity code (design.md's Open Questions item) and
      implement `EnsureTargetsBelongToTeam(AppDbContext, IEnumerable<string> ids, string
      teamId, CancellationToken)` as an internal static helper (mirrors
      `CreateSessionHandler.EnsureMicrocicloBelongsToTeam`).
- [x] 2.5 EF Core migration `AddTrainingSessionSubSubPrincipio` (`app` schema) for the new
      table.

## 3. Domain — retire Microciclo weekly-objective join

- [x] 3.1 Remove `Microciclo.SubprincipiosObjetivo`/`ReplaceSubprincipiosObjetivo`
      (`Domain/Aggregates/SeasonPlans/Microciclo.cs`).
- [x] 3.2 Delete `Domain/Aggregates/SeasonPlans/MicrocicloSubprincipioObjetivo.cs` and its EF
      config `MicrocicloSubprincipioObjetivoConfiguration.cs`.
- [x] 3.3 Remove any remaining references to `ReplaceSubprincipiosObjetivo`/
      `SubprincipiosObjetivo` in `Features/Coaches/SeasonPlans/Commands/
      {CreateSeasonPlan,UpdateSeasonPlan}.cs` (request DTOs and handler calls).
- [x] 3.4 EF Core migration `DropMicrocicloSubprincipioObjetivo` (`app` schema) dropping the
      `MicrocicloSubprincipiosObjetivo` table.

## 4. Feature slice — CreateSession / UpdateSession

- [x] 4.1 `CreateSessionCommand`/`CreateSessionRequest`/`UpdateSessionCommand`/
      `UpdateSessionBody`: change `DateTime Date, TimeSpan StartTime` to
      `DateTime? Date, TimeSpan? StartTime`; add `List<string> TargetSubSubPrincipioIds`
      (default empty).
- [x] 4.2 `CreateSessionHandler`/`UpdateSessionHandler`: call `EnsureTargetsBelongToTeam` (task
      2.4) before persisting; call `session.ReplaceTargets(request.TargetSubSubPrincipioIds)`.
- [x] 4.3 Implement automatic Microciclo resolution (design.md Decision 6): when
      `request.Date is not null && request.MicrocicloId is null`, resolve via the
      Microciclo→Mesociclo→Macrociclo→SeasonPlan join filtered by date-range containment and
      `TeamId`; leave null if no match. Applies to both create and update.
- [x] 4.4 `CreateSessionValidator`/`UpdateSessionValidator`: no `NotEmpty` rule needed on
      `Date`/`StartTime` (already optional); change the unconditional `RuleFor(x =>
      x.Blocks).NotEmpty()` to a `When(x => x.Date is not null, () => RuleFor(x =>
      x.Blocks).NotEmpty()...)` block per design.md Decision 3.1 — an unscheduled session
      (`Date == null`) is valid with only `TargetSubSubPrincipioIds` and no blocks;
      `RuleForEach(x => x.Blocks).SetValidator(...)` stays unconditional.

## 5. Feature slice — GetSession / GetSessions read shape

- [x] 5.1 New `SessionTargetDetail` record (design.md Decision 3: full breadcrumb —
      `SubSubPrincipioId`, `Rol`, `Numero`, `SubprincipioId`, `SubprincipioTitulo`, `ZonaId`,
      `ZonaLabel`, `PrincipioId`, `PrincipioTitulo`, `GameMomentId`, `GameMomentName`).
- [x] 5.2 `SessionDetail`/`SessionListItem`: add `IEnumerable<SessionTargetDetail> Targets`;
      `GetSessionHandler`/`GetSessionsHandler` project it via an `Include(s => s.Targets)` +
      joins against `SubSubPrincipio`/`Subprincipio`/`Zona`/`GamePrinciple`/`GameMoment`
      (mirror `GetGameModel.cs`'s include/mapping style).
- [x] 5.3 `Date`/`StartTime` become `DateTime?`/`TimeSpan?` in both response records; verify
      any `OrderBy(s => s.Date)` (e.g. `GetSessions.cs` line 80) still behaves reasonably with
      nulls (nulls first per default Postgres/EF ordering — confirm this is acceptable or add
      `OrderByDescending(s => s.Date == null).ThenByDescending(s => s.Date)` to keep
      unscheduled sessions grouped predictably).

## 6. New feature — GetAdnCoverage query

- [x] 6.1 New file `Features/Coaches/GameModels/Queries/GetAdnCoverage.cs`
      (`GET /api/game-models/adn-coverage?teamId=&season=`), `IFeatureModule` +
      `IRequestHandler`, `IRequireFeaturePermission` with `Read` permission on
      `CoachFeatureRoutes.GameModel` (same gate as `GetGameModel`).
- [x] 6.2 `AdnCoverageResponse`/`SubSubPrincipioCoverage`/`SessionUsage`/`SubprincipioCoverage`/
      `PrincipioCoverage` records per design.md Decision 5.
- [x] 6.3 Handler: load the team's `GameModel` tree (id-only projection, `AsNoTracking`) plus
      every `TrainingSession` for the team with `Include(s => s.Targets)`; compute
      used/covered in-memory per design.md Decision 5's rules (Subprincipio covered iff all its
      SubSubPrincipios used; Principio covered iff all its Subprincipios covered).
- [x] 6.4 Same team-access check pattern as `GetGameModel.cs` (club or direct team access via
      `UserClubs`/`UserTeams`).

## 7. Feature slice — season plan weekly objective projection

- [x] 7.1 `Features/Coaches/SeasonPlans/Queries/GetSeasonPlan.cs`: per Microciclo, compute the
      weekly objective by querying `TrainingSession`s of the team with `Date` inside
      `[StartDate, EndDate]`, `SelectMany(s => s.Targets)`, distinct `SubSubPrincipioId`,
      shaped as `IEnumerable<SessionTargetDetail>` (design.md Decision 4).
- [x] 7.2 Remove `subprincipioObjetivoIds`/`SubprincipiosObjetivo` from any
      `MicrocicloResponse`-equivalent DTO in `GetSeasonPlan.cs`; replace with the new
      derived-objective field.

**Migration deviation note**: tasks 1.3/2.5/3.4 called for three separate migrations
(`MakeSessionDateAndStartTimeNullable`, `AddTrainingSessionSubSubPrincipio`,
`DropMicrocicloSubprincipioObjetivo`). Since all three domain/config changes were already
applied to the code before the first `dotnet ef migrations add` ran, EF Core's diff-based
scaffolding captured the entire cumulative diff in a single migration regardless of the name
used for subsequent `add` calls (each later call produces an empty migration once the model
already matches). Rather than leave two empty follow-up migrations, this was captured as one
combined migration: `SeasonPlanContentBoard_SessionTargetsAndNullableSchedule`. It contains all
three changes (nullable `Date`/`StartTime`, new `TrainingSessionSubSubPrincipios` table, dropped
`MicrocicloSubprincipiosObjetivo` table) and has been applied and verified against the real dev
database (task 8.5).

## 8. Backend verification

- [x] 8.1 `dotnet build` — 0 errors.
- [x] 8.2 Domain unit tests: `TrainingSession.ReplaceTargets` (dedup, replace-wholesale),
      nullable `Date`/`StartTime` construction, `Microciclo` no longer exposing
      `SubprincipiosObjetivo`.
- [x] 8.3 Functional/handler tests: create/update an unscheduled session; create/update a
      session with targets from another team's GameModel (rejected); date-assignment
      auto-resolves the correct Microciclo; `GetAdnCoverage` reports covered/uncovered
      correctly for a fixture GameModel + sessions; `GetSeasonPlan` weekly objective reflects
      only dated sessions' targets; validator tests for the conditional `Blocks` `NotEmpty`
      rule (design.md Decision 3.1) — an unscheduled session (`Date == null`) with empty
      `Blocks` passes validation, and the same command with a `Date` set and empty `Blocks`
      fails validation.
- [x] 8.4 `dotnet test` — full suite green, no new failures.
- [x] 8.5 Migrations applied against the real dev database and verified (per the `add-news-link`
      change's lesson: check enum/nullable defaults against actual existing rows, not just the
      test fixture).

## 9. Frontend — types and services (design.md F6/F7)

- [x] 9.1 `Front/src/apps/coach/types/training.ts`: add `SessionTargetDetail`; make
      `TrainingSession`/`TrainingSessionDetail.date`/`startTime` nullable and add
      `targets: SessionTargetDetail[]`; make `CreateSessionRequest`/`UpdateSessionRequest.date`/
      `startTime` nullable and add `targetSubSubPrincipioIds: string[]`. TDD: update/extend
      `useSessionForm.test.ts` fixtures first so they fail against the old types, then apply the
      type change.
- [x] 9.2 New `Front/src/apps/coach/types/adnCoverage.ts`: `SessionUsage`,
      `SubSubPrincipioCoverage`, `SubprincipioCoverage`, `PrincipioCoverage`, `AdnCoverage`
      (design.md F7).
- [x] 9.3 `Front/src/apps/coach/types/seasonPlan.ts`: remove `Microciclo.subprincipiosObjetivo`/
      `subprincipioObjetivoIds`; add `WeeklyObjectiveSubprincipio` and
      `Microciclo.weeklyObjective: WeeklyObjectiveSubprincipio[]` (design.md F7 — reconcile exact
      shape against backend task 7.1's actual `GetSeasonPlan` response before finalizing).
- [x] 9.4 `Front/src/apps/coach/services/gameModelService.ts`: add `getAdnCoverage(teamId,
      season): Promise<AdnCoverage>` calling `GET /api/game-models/adn-coverage` (design.md F6).
      Test first: mock `client.get` and assert the mapped shape.
- [x] 9.5 `Front/src/apps/coach/services/trainingService.ts`: no new methods, but its existing
      calls now carry the new/nullable fields per 9.1 — update any inline request-building in
      this file if it constructs request objects directly (verify none does; it just forwards
      typed params).

## 10. Frontend — content-board page (design.md F1-F5)

- [x] 10.1 New route `trainings/content-board` in `Front/src/apps/coach/routes.tsx`
      (`ContentBoardPage`, `React.lazy`, `RequireFeaturePermission` with
      `COACH_FEATURE_ROUTES.Trainings`, same guard as `trainings/new-session`).
- [x] 10.2 New entry-point button "Planificar contenido" in `Trainings.tsx`'s Planificación tab
      toolbar (near "Nueva planificación"), navigating to
      `/coach/trainings/content-board?clubId=&teamId=`.
- [x] 10.3 TDD: write `useContentBoardData.test.ts` first (parallel-loads GameModel + AdnCoverage
      + Sessions; exposes `refetchSessions`/`refetchCoverage`; loading/error states) — Red, then
      implement `hooks/useContentBoardData.ts` (design.md F3) — Green.
- [x] 10.4 TDD: write `AdnDraggableTree.dragdrop.test.tsx` first for the pure helpers
      `flattenSubprincipioTargets`/`toTargetDetail`/`dedupeById` (Subprincipio-with-Zonas case,
      Subprincipio-without-Zonas case, single-SubSubPrincipio case) — Red, then implement
      `components/AdnDraggableTree.tsx` (design.md F2/F4) reusing `GameModelTree.tsx`'s
      `sortByNumero`/`zonaHeading` helpers, with `useDraggable` on Subprincipio/SubSubPrincipio
      nodes — Green.
- [x] 10.5 TDD: write `AdnDraggableTree.coverage.test.tsx` first (check icon only on covered
      Subprincipio/Principio; `UsageBadge` count + tooltip content, including the null-date
      "Sin programar" case) — Red, then implement the coverage/usage overlay + `UsageBadge.tsx`
      — Green.
- [x] 10.6 TDD: write `useSessionDrop.test.ts` first (optimistic add renders synchronously;
      within-session dedup; rollback + `rffm.show_snackbar` error event on a rejected
      `updateSession`; wholesale-PUT payload shape) — Red, then implement `hooks/useSessionDrop.ts`
      (design.md F5) — Green.
- [x] 10.7 TDD: write `SessionCard.test.tsx` first (renders `TargetChip` per target with full
      breadcrumb text, omitting the Zona segment when absent; delete-chip calls
      `onRemoveTarget`; "Asignar fecha" button calls `navigate` with the expected URL + `state`)
      — Red, then implement `components/SessionCard.tsx` + `components/TargetChip.tsx` —
      Green, wiring `useDroppable({ id: `session-drop-${session.id}` })`.
- [x] 10.8 TDD: write `SessionBoardPanel.test.tsx` first (renders only `date === null` sessions;
      "+ Nueva sesión" creates via `trainingService.createSession` with the bare
      `targetSubSubPrincipioIds: []`/`blocks: []` payload from design.md F5; delete confirms
      before calling `deleteSession`) — Red, then implement `components/SessionBoardPanel.tsx`
      — Green.
- [x] 10.9 TDD: write `ContentBoardPage.test.tsx` first (loading state; "no GameModel yet" hint
      reusing the `RouterLink to="/coach/game-model"` pattern from `SeasonPlanEditor.tsx`; both
      panels render with fixture data; `DndContext`/`onDragStart`/`onDragEnd` wiring — dropped
      outside any `session-drop-` id is a no-op) — Red, then implement `ContentBoardPage.tsx`
      (design.md F1/F4) assembling `useContentBoardData` + `useSessionDrop` +
      `AdnDraggableTree` + `SessionBoardPanel` — Green.
- [x] 10.10 Inline session rename in `SessionCard.tsx`: editable `TextField`, commits on
      blur/Enter via the same wholesale-PUT `updateSession` call carrying the session's current
      `targetSubSubPrincipioIds` unchanged (design.md F5). Test first in `SessionCard.test.tsx`.

## 11. Frontend — retire the Microciclo objective picker (design.md F8)

- [x] 11.1 TDD: extend `SeasonPlanEditor.test.tsx` first with a regression assertion that no
      Subprincipio-objetivo `Autocomplete`/picker renders anywhere in the editor — Red against
      current code, then remove `MicrocicloSubprincipioObjetivoPicker`,
      `subprincipioObjetivoIds` (from `EMPTY_MICROCICLO` and `MicrocicloEditorProps`), and the
      `adnOptions`/`hasGameModel` prop threading through `MacrocicloEditor`/`MesocicloEditor`/
      `MicrocicloEditor`/`SeasonPlanEditor` (all four `Props` interfaces) — Green.
- [x] 11.2 `Trainings.tsx`: drop the now-unused `adnOptions={adnOptions}` prop passed to
      `<SeasonPlanEditor>`; verify whether `adnOptions` state/`getAdnOptions` load in this file
      is still needed for anything else before deleting the load itself (grep for other
      consumers in the same file first).
- [x] 11.3 TDD: extend `SeasonPlanView.test.tsx` first asserting the weekly-objective chip row
      reads `microciclo.weeklyObjective` (new shape, design.md F7) instead of
      `subprincipiosObjetivo` — Red, then update `SeasonPlanView.tsx`'s `MicrocicloRow` (lines
      80-91) accordingly — Green.

## 12. Frontend — assign-date flow preserves targets (design.md F9)

- [x] 12.1 TDD: extend `useSessionForm.test.ts` first — cases: (a) `validate()` accepts
      `date: null` with empty `blocks`; (b) `validate()` rejects `date` set with empty `blocks`;
      (c) `loadSession`/`emptySession` carry `targetSubSubPrincipioIds` through unchanged — Red,
      then update `useSessionForm.ts`'s `emptySession`/`loadSession`/`validate` accordingly —
      Green.
- [x] 12.2 `NewSessionPage.tsx`: verify the existing `sessionId` query param + `returnTo` state
      flow (lines 121-131) needs no structural change beyond 12.1's type/validation updates;
      add/adjust a test asserting a session loaded with existing targets keeps them after a
      date-only edit and save.

## 13. Frontend verification

- [x] 13.1 `npm run test` — full suite green, including all new/extended tests from sections
      9-12, no skipped tests.
- [x] 13.2 `npm run build` — 0 type errors (strict mode).
- [ ] 13.3 Manual smoke pass (or Playwright if a critical-path E2E is warranted): drag a
      Subprincipio onto a session card, drag a single Sub-subprincipio onto another, remove a
      target, create/delete an unscheduled session, assign a date via `NewSessionPage.tsx` and
      confirm targets/blocks survive, confirm coverage checks/usage badges update.
