## 1. Backend — Domain

- [ ] 1.1 Create `Domain/Aggregates/SeasonPlans/SeasonPlan.cs`, `Macrociclo.cs`, `Mesociclo.cs`, `Microciclo.cs` per `design.md` Decision 1 (plain constructors, `BaseEntity`, mutators with `ArgumentException` guards). `SeasonPlan : IAggregateRoot`.
  - Verify: `dotnet build`
- [ ] 1.2 Add `MicrocicloId` (nullable `string`) + FK config to `TaskTrainingBase.cs` and `TaskTrainingBaseEntityConfiguration.cs` (per Decision 4, `OnDelete: SetNull`).
  - Verify: `dotnet build`

## 2. Backend — Persistence

- [ ] 2.1 Create `Infrastructure/Persistence/Configuration/Aggregates/SeasonPlans/{SeasonPlan,Macrociclo,Mesociclo,Microciclo}Configuration.cs` (schema `app`, FKs, cascade delete parent→children, `GameZoneId` FK on `Mesociclo`, `SeasonId` FK on `SeasonPlan`).
- [ ] 2.2 Add `DbSet<SeasonPlan> SeasonPlans`, `DbSet<Macrociclo> Macrociclos`, `DbSet<Mesociclo> Mesociclos`, `DbSet<Microciclo> Microciclos` to `AppDbContext.cs`.
- [ ] 2.3 Generate migration: `dotnet ef migrations add AddSeasonPlan --startup-project ../../RFFM.Host` (adjust path). Review generated SQL for the new tables + `TaskTrainingBases.MicrocicloId` column.
  - Verify: `dotnet build`, migration applies cleanly against local DB (`dotnet ef database update`)

## 3. Backend — Seed importer

- [ ] 3.1 Re-read `docs/game-model/Plan-de-Temporada.docx`/`.pdf` in full and transcribe every macrociclo/mesociclo/microciclo (dates, `GameZoneId`, `WeekLabel`, `ObjetivoSesionA`/`B`) into `Infrastructure/Services/SeasonPlanImporter.cs` as hardcoded data, per Decision 5's deterministic-key upsert pattern.
- [ ] 3.2 Query the dev DB for the target Team (Cadete, 2ª División) + its active `Season`: `SELECT t."Id", t."Name", s."Id", s."Name" FROM app."Teams" t JOIN app."Seasons" s ON s."Id" = t."SeasonId" WHERE ...`. Eyeball-confirm the match before hardcoding `TeamId`/`SeasonId` into the migration's data step. If no confident match, skip the migration data step (importer service still ships, callable manually) and note this explicitly when reporting completion.
- [ ] 3.3 Wire the importer as a data step in the `AddSeasonPlan` migration (or a follow-up migration if 3.2 needs more time), mirroring how the `ReplaceGameModelAdnHierarchy`/`TeamRulesSet` migrations invoke seed data.
  - Verify: `dotnet ef database update` on a clean local DB produces the full expected tree; spot-check row counts (4 macrociclos... actually 2 macrociclos total, 8 mesociclos, ~44 microciclos per the source doc — recount exactly against the transcribed data).

## 4. Backend — Features

- [ ] 4.1 Add `CoachFeatureRoutes.SeasonPlan = "/coach/season-plan"` to `Domain/Entities/CoachFeatureRoutes.cs`; seed the corresponding `FeaturePermission` row alongside existing routes.
- [ ] 4.2 `Features/Coaches/SeasonPlans/Commands/CreateSeasonPlan.cs` — `IFeatureModule` + command + handler + FluentValidation validator, per Decision 2. TDD: write handler tests first (happy path, duplicate Team+Season → `409`).
- [ ] 4.3 `Features/Coaches/SeasonPlans/Commands/UpdateSeasonPlan.cs` — full-tree replace, server-derived `Order`. TDD: tests first (happy path, not-found → `404`, cross-team access → `403`).
- [ ] 4.4 `Features/Coaches/SeasonPlans/Commands/DeleteSeasonPlan.cs` — cascades, nulls out linked `TaskTrainingBase.MicrocicloId` first. TDD: tests first (happy path, verifies exercises survive with `MicrocicloId = null`).
- [ ] 4.5 `Features/Coaches/SeasonPlans/Queries/GetSeasonPlan.cs` — `teamId`/`seasonId` query params, `204` if none, `ExerciseCount` per Microciclo via grouped `AsNoTracking` count. TDD: tests first (found, not-found → `204`, exercise-count correctness).
  - Verify: `dotnet build && dotnet test` (SeasonPlans feature tests + regression on Trainings/Exercises tests from 4.6)

## 5. Backend — Exercise linking

- [ ] 5.1 Add `microcicloId?` to `CreateExercise.cs`/`UpdateExercise.cs` request records + handlers (nullable passthrough, validate FK exists if provided). Add `MicrocicloId` to `GetExercises`/`GetExerciseById`'s DTO projection, plus an optional `microcicloId` filter param on `GetExercises`.
  - Verify: `dotnet build && dotnet test` (Exercises feature tests)

## 6. Frontend — Types & service

- [ ] 6.1 `Front/src/apps/coach/types/seasonPlan.ts` — `SeasonPlan`, `Macrociclo`, `Mesociclo`, `Microciclo` interfaces (client-side temp `id` + `apiId`, mirroring `gameModel.ts`'s shape) + `ExerciseCount` on `Microciclo`.
- [ ] 6.2 `Front/src/apps/coach/services/seasonPlanService.ts` — `Api*` DTOs + mappers + `nextKey()` temp-id scheme (mirroring `gameModelService.ts`), `getByTeamIdAndSeason`, `create`, `update`, `delete`.
- [ ] 6.3 Add `microcicloId?` to `Exercise`/`CreateExerciseRequest`/`UpdateExerciseRequest` in `types/training.ts`; pass through in `trainingService.ts`'s `getExercises`/`createExercise`/`updateExercise` (optional filter param + body field).
  - Verify: `npx tsc --noEmit` (or `npm run build`)

## 7. Frontend — Planificación tab

- [ ] 7.1 Write component tests first (`__tests__/`) for the new tab: renders empty state (no `SeasonPlan` yet → "Crear planificación" CTA), renders tree with coverage badges (0 exercises = warning chip, N exercises = count chip), "Crear ejercicio" navigates with the Microciclo context. Mock `seasonPlanService`.
- [ ] 7.2 Add `<Tab label="Planificación" />` to `Trainings.tsx`, third tab, conditional action bar button ("Nueva planificación" / "Editar planificación" depending on existence).
- [ ] 7.3 New `pages/trainings/season-plan/SeasonPlanView.tsx` (read view: tree + coverage badges) and `SeasonPlanEditor.tsx` (create/edit form: add/remove/reorder macro/meso/microciclos, `GameZoneId` selector fed by the existing `getZones()`-equivalent moments/zones catalog call), mirroring `game-model/components/GameModelFormEditor.tsx`'s tree-editing UX.
  - Verify: `npm run test -- season-plan` (green), then `npm run build`

## 8. Frontend — Exercise creation from a Microciclo

- [ ] 8.1 `SeasonPlanView.tsx`'s "Crear ejercicio" button navigates to `new-exercise` with `microcicloId` in the query string (or `NavState`, matching `NewExercisePage.tsx`'s existing `location.state` pattern).
- [ ] 8.2 `NewExercisePage.tsx` reads `microcicloId`, passes to `useExerciseForm`; form seeds `microcicloId` and shows read-only context (Microciclo's `WeekLabel` + parent Mesociclo's zone label) above the fields.
- [ ] 8.3 Add an optional Microciclo selector to `ExerciseFormPanel.tsx` for the existing Ejercicios-tab creation flow (fetches the current team's `SeasonPlan` tree for the dropdown, skips gracefully if none exists).
  - Verify: `npm run test` (full suite, watch for regressions in existing exercise-form tests), `npm run build`

## 9. End-to-end check

- [ ] 9.1 Run backend (`dotnet run --project src/RFFM.Host`) + frontend (`npm run dev`), log in as Coach, confirm: Planificación tab shows the seeded plan, coverage badges are accurate, "Crear ejercicio" round-trips a new exercise linked to a Microciclo, deleting a Microciclo (via full-plan edit) leaves that exercise intact with `microcicloId` cleared.
- [ ] 9.2 `dotnet test` (full backend suite) + `npm run test` + `npm run build` (frontend) green before considering the change complete.

## 10. Amendment — ADN links on Microciclo sessions (post-implementation)

See `design.md`'s "Amendment" section. Backend and frontend for tasks 1–9 are already implemented and merged; this section is additive on top of that working tree.

- [x] 10.1 Backend domain: add `MicrocicloSubprincipioLink`/`MicrocicloSubSubPrincipioLink` entities (or a single join-configuration approach — decide at implementation time whether a dedicated entity class is needed or a plain EF many-to-many join suffices given no extra columns beyond `Session`), plus `SesionAHabilidades`/`SesionBHabilidades` (`List<string>`, jsonb) on `Microciclo`, with a validating mutator against `Habilidad.Vocabulary`.
  - TDD: domain tests first (rejecting a non-vocabulary Habilidad name; session lists start empty).
  - Decision: dedicated entity classes (not a plain many-to-many join) — matches this codebase's existing precedent (`Habilidad`, `TeamRule`, `SubSubPrincipio`) where every join-like relationship is modeled as a real `BaseEntity`-derived class with a private/internal constructor, never a shadow join table.
- [x] 10.2 EF config + migration `AddMicrocicloAdnLinks`: two join tables (cascade delete on the `Subprincipio`/`SubSubPrincipio` side), two jsonb columns.
  - Verify: `dotnet ef database update` against the dev DB used for the original seed; re-run `SeasonPlanImporter` to confirm it's unaffected (session links start empty for seeded data, that's expected — the source document's granular ADN links aren't in the transcribed data).
  - Done: migration `20260811190519_AddMicrocicloAdnLinks` created and applied cleanly to the Supabase dev DB (`ConnectionStrings:FutbolBaseConnection` via user-secrets). `SeasonPlanImporterTests` still green (3/3), unaffected.
- [x] 10.3 Extend `CreateSeasonPlan`/`UpdateSeasonPlan` commands' `MicrocicloRequest` with the 6 new fields; `UpdateSeasonPlan`'s upsert logic clears-and-rebuilds each session's link rows (same "trust server-derived state, not incremental diff" approach already used for the rest of the tree).
  - TDD: handler tests first (add links on create, replace links on update, remove-all via empty list).
- [x] 10.4 Extend `GetSeasonPlan`'s query/DTO to include the denormalized per-session summaries (join `Subprincipio`/`SubSubPrincipio`/`GamePrinciple`/`GameMoment` for display fields), `AsNoTracking`.
  - TDD: query test asserting summaries resolve correctly, and are empty (not null/error) when a Microciclo has no links yet.
  - Verify: `dotnet build && dotnet test` — 557/557 passing (537 pre-existing + 20 new).
- [x] 10.5 Frontend: extend `seasonPlanService.ts`'s DTOs/mappers for the 6 new fields per session; add a helper to fetch and flatten the team's current `GameModel` (reuse `gameModelService.getByTeamIdAndSeason`) into a `{ subprincipios: [...], subSubPrincipios: [...] }` option list for pickers.
  - Decision: `getAdnOptions(teamId, season)` takes `season` (free-text, matches `GameModel.season`), not `seasonId` — `Trainings.tsx` resolves both from the same active-season lookup. Catches the underlying 404 itself so callers always get empty arrays, never an error, when the team has no GameModel yet.
- [x] 10.6 `SeasonPlanEditor.tsx`: per Microciclo, per session (A/B), add a `Subprincipio` multi-select, a `SubSubPrincipio` multi-select (options narrowed to children of the selected Subprincipios when any are selected, else all), and a `Habilidad` multi-select (fixed 14-value list, mirror `HABILIDAD_VOCABULARY` from `types/gameModel.ts`). Empty state when the team has no `GameModel` yet: message + link to the Modelo ADN page, fields disabled rather than hidden (the coach should discover why).
  - Done: `SessionAdnPickers` (MUI `Autocomplete multiple` ×3) threaded through Macrociclo→Mesociclo→Microciclo editors. 7/7 editor tests pass.
- [x] 10.7 `SeasonPlanView.tsx`: render each session's linked Subprincipios/SubSubPrincipios/Habilidades as chips under the existing free-text objective (e.g. "Defensa organizada 1.1", "Transición defensa-ataque 1.1" as chips, then the objective paragraph below), matching how the source document reads.
  - Done: `SessionBlock`/`SessionAdnChips`; the view didn't previously render `objetivoSesionA/B` text at all, added alongside the chips since chip scoping needed it. 7/7 view tests pass.
- [x] 10.8 `NewExercisePage.tsx`'s read-only Microciclo context banner (added in task 8.2): extend it to also show that session's linked Subprincipios/SubSubPrincipios/Habilidades as chips, so a coach creating an exercise from a Microciclo sees the concrete targets, not just the week label.
  - Decision: exercise creation has no A/B session param, so the banner shows both sessions' chip blocks, each labeled "Sesión A"/"Sesión B", rendering only sessions that have links.
  - Verify: `npm run test` — 404/404 passing, 0 failed. `npm run build` — clean, exit 0.
