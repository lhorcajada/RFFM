# Tasks

## Backend

All paths relative to `C:\Proyects\MisProyectos\FutbolBase\Back\ExtractionApi`. Each task
targets ~2h. Run `dotnet build` after every task that touches compiled code, and the
relevant `dotnet test` filter before moving to the next task — don't batch build/test
failures across tasks.

Before task 1: **confirm with the user** whether the current development database has any
`SessionTrainings` rows worth preserving (their shape changes regardless — `Tasks`/`Section`
disappear in favor of `Blocks`) — decide together whether task 3's migration also wipes
existing sessions or only exercises, and record the decision in this file before writing the
migration.

### 1. Domain — Exercise model relations & levels

- Add `src/RFFM.Api/Domain/Aggregates/Training/TasksTraining/ExerciseModelRelation.cs` and
  `ExerciseModelRelationItem.cs` per `design.md` §1.2 (factory validation: relation requires
  `SubprincipioId`; items require `SubSubPrincipioId`; `HabilidadesImprescindibles` validated
  against `Habilidad.Vocabulary`, mirroring `TaskTrainingBase.UpdateHabilidades`).
- Add `ExerciseLevelRow` record (`Nivel`, `Valores: Dictionary<string,string>`) alongside
  `TaskTrainingBase` (or in its own file `ExerciseLevelRow.cs`).
- Delete `src/RFFM.Api/Domain/Aggregates/Training/TasksTraining/ExerciseModelLink.cs` and
  `ExerciseCondition.cs`.
- Verify: `dotnet build` (expect failures in dependents — fixed in later tasks; note them,
  don't chase yet).

### 2. Domain — restructure `TaskTrainingBase`

- Rewrite `src/RFFM.Api/Domain/Aggregates/Training/TasksTraining/TaskTrainingBase.cs` per
  `design.md` §1.1: remove `Types`, `Section`, `Methodology`→`Tipo`,
  `PlayersNumber`/`GoalPeekersNumber`/`FieldSpace`/`Series`/`DurationSeries`/`RestSeries`/
  `TouchesNumber`/`WildCards`/`Points`/`MicrocicloId`/`Material`/`Conditions`/`ModelLinks`;
  add `Objetivo`, `ObjetivoPorRol`, `Logistica`, `DurationMinutes`, `Porteros`, `Dibujo`,
  `Descripcion` (rename from `Description`), `NivelesColumnas`, `Niveles`,
  `ModelRelations: List<ExerciseModelRelation>` with a `ReplaceModelRelations(...)` method
  (same "clear + rebuild" shape as the old `ReplaceModelLinks`) and an
  `UpdateNiveles(columnas, niveles)` method enforcing the 2–5 rows / no-gap-numbering /
  no-orphan-cell invariants from `design.md` §1.3.
- Before deleting `TaskTrainingType`/`ExerciseType`/`MaterialsEnum`/`TrainingPointsReport`
  navigation, grep the solution (`Grep` tool) for each type name outside
  `Features/Coaches/Trainings/Exercises` and `Domain/Aggregates/Training` — if any hit is
  outside those paths, stop and report it before deleting.
- Delete `src/RFFM.Api/Domain/Aggregates/Training/TasksTraining/ExerciseType.cs` and
  `TaskTrainingType.cs` if the grep above is clean.
- Verify: `dotnet build` (still expect downstream failures in Features/Configuration —
  tracked in tasks 5–6).

### 3. Domain — `TrainingSession` blocks + `Microciclo` simplification

- Add `src/RFFM.Api/Domain/Aggregates/Training/SessionBlock.cs` and
  `SessionBlockExercise.cs` per `design.md` §1.4.
- Rewrite `src/RFFM.Api/Domain/Aggregates/Training/TrainingSession.cs`: replace
  `List<TaskTraining> Tasks` with `List<SessionBlock> Blocks`; add `MicrocicloId`,
  `ObjetivoGeneral`, `MapaCampoTexto`.
- Delete `src/RFFM.Api/Domain/Aggregates/Training/TasksTraining/TaskTraining.cs`.
- Rewrite `src/RFFM.Api/Domain/Aggregates/SeasonPlans/Microciclo.cs` per `design.md` §1.5
  (remove `ObjetivoSesionA/B`, `GameZoneIdSesionA/B`, `SesionAHabilidades/SesionBHabilidades`,
  `SubprincipioLinks/SubSubPrincipioLinks`, `SessionA/SessionB` constants, and their methods).
- Delete `src/RFFM.Api/Domain/Aggregates/SeasonPlans/MicrocicloSubprincipioLink.cs` and
  `MicrocicloSubSubPrincipioLink.cs`.
- Verify: `dotnet build`.

### 4. Infrastructure — EF configuration

- Delete configs: `ExerciseConditionEntityConfiguration.cs`, `ExerciseModelLinkConfiguration.cs`,
  `TaskTrainingEntityConfiguration.cs`, `TaskTrainingTypeConfiguration.cs`,
  `ExerciseTypeConfiguration.cs`, `MicrocicloSubprincipioLinkConfiguration.cs`,
  `MicrocicloSubSubPrincipioLinkConfiguration.cs` (all under
  `Infrastructure/Persistence/Configuration/Aggregates/`).
- Rewrite `TaskTrainingBaseEntityConfiguration.cs`: drop config for removed properties/nav;
  add `ExerciseModelRelationConfiguration.cs` and `ExerciseModelRelationItemConfiguration.cs`
  (new files, same folder as `ExerciseModelLinkConfiguration.cs` used to live) with the jsonb
  `HabilidadesImprescindibles` conversion copied from `TaskTrainingBaseEntityConfiguration`'s
  `ConfigureHabilidadesColumn` helper; configure `NivelesColumnas`/`Niveles` jsonb columns the
  same way (a small internal `ExerciseLevelRowListConverter` helper for the `Niveles` column,
  since it's `List<ExerciseLevelRow>` not `List<string>`).
- Add `SessionBlockConfiguration.cs`, `SessionBlockExerciseConfiguration.cs` (new folder
  `Configuration/Aggregates/Trainings/`), with `SessionBlockExercise → TaskTrainingBase` on
  `DeleteBehavior.Restrict` and `SessionBlock → TrainingSession` /
  `SessionBlockExercise → SessionBlock` on `DeleteBehavior.Cascade` (per `design.md` §1.4).
- Rewrite `SessionTrainingEntityConfiguration.cs`: replace `Tasks` config with `Blocks`;
  configure `MicrocicloId` FK (`HasOne<Microciclo>().WithMany().OnDelete(SetNull)`, mirroring
  the old `TaskTrainingBaseEntityConfiguration` FK-on-child pattern), `ObjetivoGeneral`,
  `MapaCampoTexto` max lengths (reuse/add constants in `ValidationConstants.cs`).
- Rewrite `MicrocicloConfiguration.cs`: drop config for removed properties.
- Update `AppDbContext.cs` DbSets: remove `TasksTraining`, `ExerciseTypes`,
  `TaskTrainingTypes`, `ExerciseConditions`, `ExerciseModelLinks`,
  `MicrocicloSubprincipioLinks`, `MicrocicloSubSubPrincipioLinks`; add
  `ExerciseModelRelations`, `ExerciseModelRelationItems`, `SessionBlocks`,
  `SessionBlockExercises`.
- Verify: `dotnet build`.

### 5. Migrations

- Confirm the dev-DB decision recorded at the top of this file, then:
- `.\manage-migrations.ps1 -Action create -MigrationName DeleteDevelopmentExercisesAndSessions`
  — hand-edit the generated (empty, since it's data-only) migration to add the raw-SQL
  deletes from `design.md` §2 step 1 in `Up()`; leave `Down()` empty with a comment.
- `.\manage-migrations.ps1 -Action create -MigrationName RestructureExerciseSchema`
- `.\manage-migrations.ps1 -Action create -MigrationName RestructureSessionSchema`
- `.\manage-migrations.ps1 -Action create -MigrationName SimplifyMicrociclo`
- Inspect each generated migration's `Up()`/`Down()` for correctness (EF sometimes needs
  manual `DropColumn`/`AddColumn` ordering fixes around FKs) before moving on.
- Verify: `.\manage-migrations.ps1 -Action apply -Context AppDbContext` against a local dev
  Postgres instance; `dotnet build`.

### 6. Feature modules — Exercises

- Rewrite `Features/Coaches/Trainings/Exercises/CreateExercise.cs` and `UpdateExercise.cs`
  per `design.md` §4 table (new request shape, `ExerciseModelRelationRequest`/
  `ExerciseModelRelationItemRequest`, `NivelesRequest`/`NivelColumnRequest`-style DTOs,
  FluentValidation rules: `Tipo` in `Analitico|Situacional|Global`, `Objetivo` required,
  `Niveles.Count` 2–5, closed-vocabulary check on `HabilidadesImprescindibles`).
- Rewrite `GetExercises.cs`: drop `methodology`/`microcicloId` query params; add
  `IsAssociatedToGameModel`; rename `ExerciseModelLinkResolver` → `ExerciseModelRelationResolver`
  resolving the new grouped shape.
- Rewrite `GetExerciseById.cs` to match.
- Update `DeleteExercise.cs`: add the `SessionBlockExercise` reference guard +
  `ErrorCodes.ExerciseInUseBySession`.
- Delete `ExerciseConditionsCrud.cs`.
- Add `ErrorCodes.ExerciseInUseBySession` to `Domain/ErrorCodes.cs`.
- Verify: `dotnet build`.

### 7. Feature modules — Sessions

- Rewrite `Features/Coaches/Trainings/Sessions/CreateSession.cs` and `UpdateSession.cs` per
  `design.md` §4 table (`Blocks`/`SessionBlockRequest`/`SessionBlockExerciseRequest`,
  `MicrocicloId` + team/plan cross-check, `ObjetivoGeneral`, `MapaCampoTexto`).
- Rewrite `GetSessions.cs`: add `IsAssociatedToPlan`, `MicrocicloId`, `MicrocicloWeekLabel`,
  recomputed `ExerciseCount`.
- Rewrite `GetSession.cs` (find it first — not read during design; follow `GetExerciseById`'s
  detail-DTO pattern) for the new `Blocks`/`Exercises` nested shape.
- Confirm `DeleteSession.cs` still compiles/behaves correctly against the new cascade
  behavior (no code change expected, but re-read after task 4's FK changes).
- Add `ErrorCodes.MicrocicloTeamMismatch`, `ErrorCodes.MicrocicloNotFound` to
  `Domain/ErrorCodes.cs`.
- Verify: `dotnet build`.

### 8. Feature modules — SeasonPlan

- Rewrite `Features/Coaches/SeasonPlans/Queries/GetSeasonPlan.cs`: drop the removed
  `MicrocicloResponse` fields, add `Sessions: IEnumerable<SessionSummary>` per `design.md`
  §4.
- Rewrite `Features/Coaches/SeasonPlans/Commands/CreateSeasonPlan.cs`: simplify
  `MicrocicloRequest` to `(Order, WeekLabel, StartDate, EndDate)`; delete
  `ApplySesionAdnLinks`.
- Read then rewrite `Features/Coaches/SeasonPlans/Commands/UpdateSeasonPlan.cs` mirroring
  `CreateSeasonPlan`'s new shape.
- Re-read `Features/Coaches/SeasonPlans/Commands/DeleteSeasonPlan.cs` to confirm no reference
  to removed fields (expected: no change needed).
- Verify: `dotnet build`.

### 9. Seed — `ExampleSessionSeeder`

- Add `Infrastructure/Persistence/Seed/ExampleSessionSeeder.cs` per `design.md` §3,
  transcribing `docs/game-model/Ejemplo-Sesion.md` content: 1 Microciclo (upsert into the
  team's existing `SeasonPlan`), 1 `TrainingSession`, 4 `SessionBlock`s, 5 exercises with
  `Niveles`/`ModelRelations`/`Logistica`/`Descripcion`, `SessionBlockExercise` rows
  (including the Bloque 2 parallel pair).
- Wire it into whatever admin/tooling entry point `SeasonPlanImporter`/`GameModelSeeder` use
  today (`RFFM.Host/DependencyInjection/WebApplicationExtensions.cs` — inspect the existing
  `SeedSeasonPlanAsync`/game-model seeding call sites and add a matching
  `SeedExampleSessionAsync`, following the same "hardcoded target team/season, invoked on
  startup or via a one-off tool" convention already established there).
- Verify: run locally against a dev DB, confirm `GET /api/season-plans` and
  `GET /api/trainings/sessions?teamId=` reflect the seeded data.

### 10. Tests

- Update/replace `tests/RFFM.Api.Tests/UnitTests/CreateExerciseHandlerTests.cs`,
  `UpdateExerciseHandlerTests.cs`, `GetExercisesHandlerTests.cs`,
  `GetExerciseByIdHandlerTests.cs`, `ExerciseModelLinkTests.cs` (→ rename/rewrite for
  `ExerciseModelRelation`), `ExerciseModelLinkingTests.cs`, `ExerciseMicrocicloLinkingTests.cs`
  (→ delete or repurpose, since direct exercise↔microciclo linking no longer exists — replace
  with a `SessionMicrocicloLinkingTests.cs` covering the new session-level association and
  its team/plan cross-check).
- Add new unit tests: `TaskTrainingBase.UpdateNiveles` invariants (row count, numbering
  gaps, orphan cells); `ExerciseModelRelation`/`Item` FOCO/INTEGRADO + habilidades vocabulary
  validation; `CreateSession`/`UpdateSession` handler tests covering `Blocks` clear+rebuild
  and the `MicrocicloId` team-mismatch guard; `DeleteExercise` in-use guard.
- Update `GetSeasonPlan`/`CreateSeasonPlan` handler tests for the simplified `Microciclo`
  shape.
- Verify: `dotnet test --filter "FullyQualifiedName~Exercise|FullyQualifiedName~Session|FullyQualifiedName~SeasonPlan"`
  then a full `dotnet test` pass.

### 11. Final verification

- `dotnet build` (whole solution) — zero warnings introduced beyond pre-existing baseline.
- `dotnet test` — full suite green, no skipped tests.
- Manual smoke: create an exercise, create a session with 2 blocks (one with 2 parallel
  exercises), link the session to a microciclo, fetch `GET /api/season-plans` and confirm the
  session appears; delete the exercise while still referenced and confirm the 409
  `ProblemDetails` with `code: ExerciseInUseBySession`.

## Frontend

All paths relative to `C:\Proyects\MisProyectos\FutbolBase\Front`. Each task targets ~2h.
Run `npm run build` after every task that touches types/compiled code and `npm run test`
(scoped to the affected file when possible) before moving to the next task — don't batch
failures across tasks. This section depends on the Backend DTOs in `design.md`'s Backend §4
being stable (route shapes, field names) — coordinate with the back-specialist if those
change before/while these tasks run; do not guess at a shape that isn't in the design doc.

### F1. Types — `training.ts` and `seasonPlan.ts` rewrite

- Rewrite `src/apps/coach/types/training.ts` per `design.md` Frontend §1: drop
  `ExerciseType`, `ExerciseSection`, `ExerciseCondition`, `ExerciseModelLink`,
  `ExerciseModelLinkRequest`, `SessionExerciseEntry`, `SessionExerciseItem`; rename
  `ExerciseMethodology` → `ExerciseTipo`; add `ExerciseLevelRow`, `ExerciseModelRelation(Item)`,
  `ExerciseModelRelationRequest`/`ItemRequest`, rewrite `Exercise`/`CreateExerciseRequest`/
  `UpdateExerciseRequest`, add `SessionBlock(Exercise)`, `SessionBlock(Exercise)Request`,
  rewrite `TrainingSession`/`TrainingSessionDetail`/`CreateSessionRequest`/
  `UpdateSessionRequest`.
- Edit `src/apps/coach/types/seasonPlan.ts` per Frontend §2: drop `objetivoSesionA/B`,
  `exerciseCount`, all `sesionA/B*` fields from `Microciclo`; add `SessionSummary` and
  `sessions: SessionSummary[]`.
- Verify: `npm run build` (expect many downstream type errors in dependents — this is
  expected; fixed in F2–F9, don't chase them here, just confirm this file's own syntax/types
  are internally consistent).

### F2. Services — `trainingService.ts` and `seasonPlanService.ts`

- Rewrite `src/apps/coach/services/trainingService.ts` per Frontend §3: new
  `getExercises`/`createExercise`/`updateExercise`/`getExerciseById`/`deleteExercise`
  payload/response shapes; drop `createCondition`/`updateCondition`/`deleteCondition`; new
  `getSessions`/`getSessionById`/`createSession`/`updateSession` shapes.
- Edit `src/apps/coach/services/seasonPlanService.ts` per Frontend §3: `mapMicrociclo`/
  `mapMicrocicloCreateRequest`/`mapMicrocicloUpdateRequest` drop `sesionA/B*` mapping, add
  `mapSessionSummary` + `sessions` mapping on `mapMicrociclo`.
- Update `src/apps/coach/services/__tests__/seasonPlanService.test.ts` for the new mapper
  shape (drop sesionA/B assertions, add a `sessions` mapping test).
- Verify: `npm run test -- seasonPlanService` then `npm run build`.

### F3. `NivelesEditor.tsx` — new component

- Add `src/apps/coach/pages/trainings/new/components/NivelesEditor.tsx` +
  `NivelesEditor.module.css` per `design.md` Frontend §4.1: editable columns header,
  editable rows (2–5 clamp), orphan-cell stripping on column delete, exported
  `renumberNiveles` helper.
- Add `src/apps/coach/pages/trainings/new/components/__tests__/NivelesEditor.test.tsx`
  (Red first): column add/remove, row add/remove with clamp, renumbering, orphan-cell
  stripping, controlled value round-trip.
- Verify: `npm run test -- NivelesEditor` then `npm run build`.

### F4. `ModelRelationSection.tsx` — rewrite for grouped relations

- Rewrite `src/apps/coach/pages/trainings/new/components/ModelRelationSection.tsx` and
  `ModelRelationSection.module.css` per `design.md` Frontend §5: relation cards (Subprincipio
  required, FOCO/INTEGRADO, per-relation Habilidades), nested Items list narrowed by
  `subprincipioId`, add/remove relation and item.
- Rewrite `src/apps/coach/pages/trainings/new/components/__tests__/ModelRelationSection.test.tsx`
  per Frontend §9: Subprincipio-required-before-item, FOCO/INTEGRADO at both levels,
  per-relation Habilidades scoping.
- Verify: `npm run test -- ModelRelationSection` then `npm run build`.

### F5. Exercise form — widen panel, rebuild fields, rewrite `useExerciseForm`

- Edit `src/apps/coach/pages/trainings/new/NewExercisePage.module.css` per Frontend §4:
  widen `.formPanel` (`min(720px, 55vw)`, mobile override `min(680px, 92vw)`), switch
  `.panelBody` to a responsive two-column grid with full-width rows for name/objetivo/
  niveles/model-relation/descripcion, collapse to one column below 768px.
- Rewrite `src/apps/coach/pages/trainings/new/hooks/useExerciseForm.ts` per Frontend §4: new
  `CreateExerciseRequest`-shaped state, drop `isPhysical`/`isTechTac`/condition handlers/
  `microcicloId` param, add client-side validation (name/tipo/objetivo required, niveles
  2–5 rows, at least a chosen Subprincipio per relation before save).
- Update `src/apps/coach/pages/trainings/new/constants.ts`'s `emptyExercise` (and
  `methodologyOptions` → `tipoOptions` with `Analitico|Situacional|Global`) to match.
- Rewrite `src/apps/coach/pages/trainings/new/components/ExerciseFormPanel.tsx` per Frontend
  §4: new field order (Nombre, Tipo, Objetivo, Objetivo por rol, ModelRelationSection,
  NivelesEditor, Logística, Duración, Porteros, Dibujo, Descripción, Imagen/Video); delete
  the Condiciones UI block entirely.
- Edit `src/apps/coach/pages/trainings/new/NewExercisePage.tsx`: remove
  `microcicloContext`/`SessionAdnContext` state, effect, and banner JSX; remove the
  `microcicloId` query param read.
- Rewrite `src/apps/coach/pages/trainings/new/hooks/__tests__/useExerciseForm.test.ts` and
  `src/apps/coach/pages/trainings/new/components/__tests__/ExerciseFormPanel.test.tsx` per
  Frontend §9.
- Verify: `npm run test -- useExerciseForm ExerciseFormPanel` then `npm run build`.

### F6. Exercise list — `ExerciseCromo.tsx` and `exerciseTypeLabels.ts`

- Edit `src/apps/coach/pages/trainings/exerciseTypeLabels.ts`: drop `TYPE_LABELS`/
  `SECTION_LABELS`, rename `METHODOLOGY_LABELS` → `TIPO_LABELS` with
  `Analitico|Situacional|Global` values.
- Rewrite `src/apps/coach/pages/trainings/components/ExerciseCromo.tsx` and
  `ExerciseCromo.module.css` per Frontend §7: remove Section strip and old Type badges, keep
  a relabeled Tipo badge, add the "Asociado al modelo" chip gated on
  `isAssociatedToGameModel`, flatten `modelRelations`/`items` for the model chips row, drop
  `playersNumber`/`goalPeekersNumber` stats, add optional `durationMinutes` stat.
- Extend `src/apps/coach/pages/trainings/components/__tests__/ExerciseCromo.test.tsx` per
  Frontend §9.
- Verify: `npm run test -- ExerciseCromo` then `npm run build`.

### F7. Session form — new page, hook, block editor (replaces `SessionDialog`)

- Add `src/apps/coach/pages/trainings/new-session/NewSessionPage.tsx` +
  `NewSessionPage.module.css` per `design.md` Frontend §6: top bar, Nombre, Ubicación en el
  plan (inline Microciclo picker), Fecha/Inicio/Fin/Lugar/Evento deportivo, Objetivo general,
  Mapa de campo texto, then the blocks editor; `sessionDraftKey` restore-from-`sessionStorage`
  logic on mount.
- Add `src/apps/coach/pages/trainings/new-session/hooks/useSessionForm.ts` per Frontend §6:
  `CreateSessionRequest`-shaped state, save/cancel handlers, validation (Nombre/Fecha
  required).
- Add `src/apps/coach/pages/trainings/new-session/components/SessionBlockEditor.tsx` +
  `.module.css` per Frontend §6.1: block cards (Nombre, Cómo conecta — required even for
  block 1, Rotación — only shown at ≥2 exercises), existing-exercise `Autocomplete` picker,
  "Crear ejercicio nuevo" inline flow (sessionStorage draft write + `pendingBlockIndex` +
  navigation `state`), parallel-exercise side-by-side rendering, block add/remove/renumber.
- Delete `src/apps/coach/pages/trainings/components/SessionDialog.tsx` and
  `SessionDialog.module.css`.
- Add route `trainings/new-session` (lazy) to `src/apps/coach/routes.tsx`, guarded by
  `COACH_FEATURE_ROUTES.Trainings`, mirroring the existing `trainings/new-exercise` route.
- Edit `src/apps/coach/pages/trainings/new/NewExercisePage.tsx`: when opened with a
  `sessionDraftKey` nav state, `handleSave` navigates back with
  `{ state: { returnTo, createdExerciseId } }` instead of the plain `returnTo` (small addition
  to the existing `handleCancel`/save flow in `useExerciseForm.ts`, gated so the normal
  create/edit flow is unaffected).
- Add `useSessionForm.test.ts` and `SessionBlockEditor.test.tsx` per Frontend §9 (Red first).
- Verify: `npm run test -- useSessionForm SessionBlockEditor NewSessionPage` then
  `npm run build`.

### F8. Sessions tab + Trainings.tsx tab reorder

- Edit `src/apps/coach/pages/trainings/Trainings.tsx` per Frontend §7–§8: reorder `<Tabs>` to
  `Planificación(0) / Ejercicios(1) / Sesiones(2)`; move every `tab === 2` plan-loading/
  action-bar conditional to `tab === 0`, shift the old `tab === 0`/`tab === 1` blocks to
  `tab === 1`/`tab === 2`; replace the `SessionDialog` open/edit wiring in the Sesiones tab
  with navigation to `/coach/trainings/new-session` (mirroring `goToExercisePage`); add the
  `isAssociatedToPlan` → `microcicloWeekLabel` chip / "Independiente" chip per session row;
  surface `ExerciseInUseBySession` as a specific delete-exercise error message.
- Verify: `npm run build`; manual check in `npm run dev` that Planificación loads as the
  first tab.

### F9. `SeasonPlanView.tsx` and `SeasonPlanEditor.tsx` — sessions instead of Sesión A/B

- Rewrite `src/apps/coach/pages/trainings/season-plan/SeasonPlanView.tsx` and
  `SeasonPlanView.module.css` per Frontend §8: delete `SessionBlock`/`SessionAdnChips`;
  `MicrocicloRow` renders `microciclo.sessions` (name/date/`exerciseCount`/objetivoGeneral,
  click-through to `new-session?...&sessionId=`), rename `onCreateExercise` prop →
  `onCreateSession`, "Sin sesiones"/"N sesiones" coverage chip.
- Rewrite `src/apps/coach/pages/trainings/season-plan/SeasonPlanEditor.tsx` per Frontend §8:
  delete `SessionAdnPickersProps` and its rendering block; `EMPTY_MICROCICLO` and the
  Microciclo row editor become just `Order`/`WeekLabel`/`StartDate`/`EndDate`; keep the
  `Mesociclo.GameZoneId` picker unchanged.
- Rewrite `src/apps/coach/pages/trainings/season-plan/__tests__/SeasonPlanView.test.tsx` and
  `__tests__/SeasonPlanEditor.test.tsx` per Frontend §9.
- Verify: `npm run test -- SeasonPlanView SeasonPlanEditor` then `npm run build`.

### F10. Final verification

- `npm run build` — zero TypeScript errors, confirms no leftover reference to any deleted
  type/field (`ExerciseType`, `ExerciseSection`, `ExerciseCondition`, `ExerciseModelLink`,
  `sesionA/B*`, etc.) anywhere in `Front/src/apps/coach/`.
- `npm run test` — full suite green, no skipped tests.
- `npx playwright test` — run the existing suite; fix any E2E flow that still references the
  old exercise form fields or the `SessionDialog` (search `Front/` for any Playwright spec
  under a `trainings`/`season-plan` path before assuming there are none).
- Manual smoke in `npm run dev`: Planificación loads first; create an exercise with 3 niveles
  rows and 2 model relations (one with items); create a session with 2 blocks, the second
  having 2 parallel exercises (one created inline mid-flow); confirm the session appears
  under its Microciclo in Planificación with the right "N sesiones" count; confirm the
  Ejercicios/Sesiones list badges reflect plan/model association correctly.
