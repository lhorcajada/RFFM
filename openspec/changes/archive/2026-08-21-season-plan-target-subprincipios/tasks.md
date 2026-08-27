# Tasks

## Backend

All paths relative to `C:\Proyects\MisProyectos\FutbolBase\Back\ExtractionApi`. Each task
targets ~2h. Run `dotnet build` after every task that touches compiled code, and the relevant
`dotnet test` filter before moving to the next task.

### 1. Domain — `MicrocicloSubprincipioObjetivo` + `Microciclo` changes

- Add `src/RFFM.Api/Domain/Aggregates/SeasonPlans/MicrocicloSubprincipioObjetivo.cs` per
  `design.md` §1 (factory validation: both ids required).
- Edit `src/RFFM.Api/Domain/Aggregates/SeasonPlans/Microciclo.cs`: add
  `SubprincipiosObjetivo: List<MicrocicloSubprincipioObjetivo>` and
  `ReplaceSubprincipiosObjetivo(IEnumerable<string>? subprincipioIds)` (clear + rebuild,
  `Distinct()`).
- **Test first (Red)**: add `tests/RFFM.Api.Tests/UnitTests/MicrocicloSubprincipioObjetivoTests.cs`
  covering: `MicrocicloSubprincipioObjetivo` factory rejects empty ids; `Microciclo
  .ReplaceSubprincipiosObjetivo` clears+rebuilds, dedupes, accepts null/empty as "clear all".
  Confirm it fails to compile before implementing (types don't exist yet).
- Verify: `dotnet build`, then `dotnet test --filter "FullyQualifiedName~MicrocicloSubprincipioObjetivo"`.

### 2. Infrastructure — EF configuration + migration

- Add `src/RFFM.Api/Infrastructure/Persistence/Configuration/Aggregates/SeasonPlans/MicrocicloSubprincipioObjetivoConfiguration.cs`
  per `design.md` §1 (table `MicrocicloSubprincipiosObjetivo`, both FKs `Cascade`).
- Add `DbSet<MicrocicloSubprincipioObjetivo> MicrocicloSubprincipiosObjetivo` to
  `src/RFFM.Api/Infrastructure/Persistence/AppDbContext.cs`.
- Verify: `dotnet build`.
- Create migration:
  `.\manage-migrations.ps1 -Action create -MigrationName AddMicrocicloSubprincipioObjetivo -Context AppDbContext`
  (or `dotnet ef migrations add AddMicrocicloSubprincipioObjetivo --project src/RFFM.Api/RFFM.Api.csproj
  --startup-project src/RFFM.Host/RFFM.Host.csproj --context RFFM.Api.Infrastructure.Persistence.AppDbContext`).
  Inspect the generated `Up()`/`Down()` — expect only `CreateTable`/`DropTable`, no column
  drops on existing tables. **Do not apply it yet** — apply only after explicit user
  confirmation per `.claude/rules/git.md`-adjacent operating rule already established with
  this user (same as the prior change's migration).
- Verify: `dotnet build`.

### 3. `SeasonPlanImporter` — shared ADN lookup + per-week target subprincipios

- Add `src/RFFM.Api/Infrastructure/Persistence/Seed/AdnLookup.cs` (new internal static class)
  by moving `ExampleSessionSeeder.ResolveSubprincipioIdAsync`'s body into it unchanged; update
  `ExampleSessionSeeder.cs` to call `AdnLookup.ResolveSubprincipioIdAsync(...)` instead of its
  own private copy, and delete the now-redundant private method.
- Verify: `dotnet build`, `dotnet test --filter "FullyQualifiedName~ExampleSessionSeeder"`
  (must still pass unchanged — pure refactor, no behavior change).
- Edit `src/RFFM.Api/Infrastructure/Services/SeasonPlanImporter.cs`: extend the private
  `MicrocicloData` record with `List<(int GameMomentId, string Numero)> SubprincipiosObjetivo`
  per `design.md` §2; populate it for every `MicrocicloData` literal already in the file (30
  weeks + the Cierre block) using the `GameMomentId`/`Numero` pairs already implied by each
  week's existing `ObjetivoSesionA`/`ObjetivoSesionB` prose (transcribe from
  `docs/game-model/Plan-de-Temporada.docx`/`.pdf` if a pair is ambiguous from the prose alone —
  re-check the source document, don't guess).
- Edit `UpsertMicrociclo` to resolve each pair via `AdnLookup.ResolveSubprincipioIdAsync` for
  the importer's target `teamId` and call `microciclo.ReplaceSubprincipiosObjetivo(...)` with
  the resolved (non-null) ids.
- Verify: `dotnet build`.

### 4. `SeasonPlanImporter` — placeholder sessions

- Add the `UpsertPlaceholderSession` helper and the two call sites (`PrincipalSuffix`/
  `AbpSuffix`) inside `UpsertMicrociclo`, per `design.md` §3 (Thursday-date computation,
  `MicrocicloId` set, zero blocks, upsert keyed by `(TeamId, MicrocicloId, suffix)`).
- Verify: `dotnet build`.
- **Test first (Red)**: extend `tests/RFFM.Api.Tests/IntegrationTests/SeasonPlanImporterTests.cs`
  with new cases (write these before finishing the helper's implementation if not already
  green): `ImportAsync_CreatesTwoPlaceholderSessionsPerMicrociclo` (asserts exactly 2
  `TrainingSession`s per `MicrocicloId`, both with `Blocks.Count == 0`); `ImportAsync_AbpSession_FallsOnThursday`
  (asserts the ABP session's `Date.DayOfWeek == DayOfWeek.Thursday` for a handful of
  Microciclos); `ImportAsync_RunTwice_DoesNotDuplicatePlaceholderSessions` (session count per
  Microciclo stays at 2 after a second `ImportAsync` call, even if `WeekLabel` text is
  unchanged — matches the existing "run twice" pattern already in this file).
- Verify: `dotnet test --filter "FullyQualifiedName~SeasonPlanImporter"`.

### 5. Feature modules — SeasonPlan endpoints

- Rewrite `Features/Coaches/SeasonPlans/Queries/GetSeasonPlan.cs` per `design.md` §4:
  `MicrocicloResponse` gains `SubprincipiosObjetivo`; re-add `SubprincipioSummary` DTO and a
  batch resolver (`Subprincipio → GamePrinciple → GameMoment`).
- Rewrite `Features/Coaches/SeasonPlans/Commands/CreateSeasonPlan.cs`: `MicrocicloRequest`
  gains `SubprincipioObjetivoIds`; `BuildMicrociclo` calls `ReplaceSubprincipiosObjetivo`;
  validator gets `RuleForEach(x => x.SubprincipioObjetivoIds).NotEmpty()`.
- Rewrite `Features/Coaches/SeasonPlans/Commands/UpdateSeasonPlan.cs`: same field on
  `MicrocicloUpdateRequest`; both `UpsertMicrociclos` branches call
  `ReplaceSubprincipiosObjetivo`; `Include` chain adds `.ThenInclude(m =>
  m.SubprincipiosObjetivo)`.
- Re-read `Features/Coaches/SeasonPlans/Commands/DeleteSeasonPlan.cs` to confirm no change
  needed (expected: none — cascade handles cleanup).
- **Test first (Red)**: extend `tests/RFFM.Api.Tests/IntegrationTests/CreateSeasonPlanHandlerTests.cs`,
  `UpdateSeasonPlanHandlerTests.cs`, `GetSeasonPlanHandlerTests.cs` with cases covering:
  create with `SubprincipioObjetivoIds` persists them; update replaces them (add/remove);
  `GetSeasonPlan` resolves `SubprincipiosObjetivo` summaries (`Numero`/`Titulo`/
  `GameMomentName`); a Subprincipio removed from the GameModel after being referenced silently
  disappears from a subsequent `GetSeasonPlan` read (mirrors the exercises-side "Linked
  Subprincipio... later removed" scenario).
- Verify: `dotnet test --filter "FullyQualifiedName~SeasonPlan"`.

### 6. Full verification

- `dotnet build` (whole solution) — 0 errors, no new warnings.
- `dotnet test` (whole suite) — all green except the two pre-existing, unrelated
  `AdnLegibleImporter`/`GameModelSeederRealDocument` failures already documented in the prior
  change's report (confirm they're still the *only* failures, don't let a regression hide
  behind that assumption).
- Manual smoke (after explicit user confirmation, against dev DB): apply the migration, run
  `SeedSeasonPlanAsync` (startup), verify via a read-only query — a handful of Microciclos
  have `SubprincipiosObjetivo` populated and exactly 2 linked `TrainingSession`s each (one
  ending in "— Sesión principal", one in "— ABP (jueves)" whose `Date` falls on a Thursday).

## Frontend

All paths relative to `C:\Proyects\MisProyectos\FutbolBase\Front`. Each task targets ~2h. Run
`npm run build` after every task that touches types/compiled code and `npm run test` (scoped
to the affected file) before moving to the next task. Depends on the Backend DTOs in
`design.md`'s Backend §4 being stable — they're already implemented and deployed per the
coordinator's brief, so no drift is expected, but re-check the actual response/request field
names against the real backend code before wiring the service layer, same discipline followed
for `session-exercise-plan-redesign`.

### F1. Types + service — `types/seasonPlan.ts`, `services/seasonPlanService.ts`

- Edit `src/apps/coach/types/seasonPlan.ts` per `design.md` Frontend §1: add
  `subprincipiosObjetivo: AdnSubprincipioSummary[]` and `subprincipioObjetivoIds: string[]` to
  `Microciclo` (no new summary type — reuse `AdnSubprincipioSummary`).
- Edit `src/apps/coach/services/seasonPlanService.ts` per Frontend §2: re-add
  `ApiAdnSubprincipioSummary`, add `subprincipiosObjetivo` to `ApiMicrociclo`, update
  `mapMicrociclo`/`mapMicrocicloCreateRequest`/`mapMicrocicloUpdateRequest`.
- **Test first (Red)**: extend
  `src/apps/coach/services/__tests__/seasonPlanService.test.ts` — `getByTeamIdAndSeason` maps
  `subprincipiosObjetivo` and derives `subprincipioObjetivoIds`; `create`/`update` request
  bodies include `subprincipioObjetivoIds` per Microciclo.
- Verify: `npm run test -- seasonPlanService` then `npm run build`.

### F2. `SeasonPlanEditor.tsx` — Subprincipio-objetivo picker

- Edit `src/apps/coach/pages/trainings/season-plan/SeasonPlanEditor.tsx` per `design.md`
  Frontend §3: re-add `adnOptions: AdnOptions` to `SeasonPlanEditorProps`, thread it down
  through `MacrocicloEditor`/`MesocicloEditor` to `MicrocicloEditor`; add
  `MicrocicloSubprincipioObjetivoPicker` (multi-select `Autocomplete`, no FOCO/INTEGRADO, no
  Habilidades, no SubSubPrincipio); disabled + "Añade primero el Modelo ADN…" hint when
  `adnOptions.subprincipios` is empty; update `EMPTY_MICROCICLO` to include the two new
  fields.
- **Test first (Red)**: extend
  `src/apps/coach/pages/trainings/season-plan/__tests__/SeasonPlanEditor.test.tsx` — picker
  renders `adnOptions.subprincipios` options; selecting updates
  `subprincipioObjetivoIds` and is present in the `onSave` payload; picker disabled + hint
  shown when `adnOptions` is empty while Semana/Inicio/Fin remain editable.
- Verify: `npm run test -- SeasonPlanEditor` then `npm run build`.

### F3. `Trainings.tsx` — reinstate `adnOptions` fetch for the Planificación tab

- Edit `src/apps/coach/pages/trainings/Trainings.tsx` per `design.md` Frontend §4: add
  `adnOptions` state + effect (`seasonPlanService.getAdnOptions(teamId, seasonName)`) scoped
  to `tab === 0`, pass it to `<SeasonPlanEditor adnOptions={adnOptions} .../>`.
- Verify: `npm run build`; manual check in `npm run dev` that the Microciclo picker in
  Planificación → Editar planificación shows real Subprincipio options for a team with a
  GameModel.

### F4. `SeasonPlanView.tsx` — target-Subprincipio chips

- Edit `src/apps/coach/pages/trainings/season-plan/SeasonPlanView.tsx` and
  `SeasonPlanView.module.css` per `design.md` Frontend §5: render a chips row for
  `microciclo.subprincipiosObjetivo` (only when non-empty), positioned above the sessions
  list; add `targetSubprincipiosRow`/`targetSubprincipioChip` CSS classes, visually distinct
  from `coverageChip` and the session-row styling.
- **Test first (Red)**: extend
  `src/apps/coach/pages/trainings/season-plan/__tests__/SeasonPlanView.test.tsx` — renders one
  chip per `subprincipiosObjetivo` entry (`Numero · Titulo`); renders no chips row when the
  list is empty; chip class differs from `coverageChip`.
- Verify: `npm run test -- SeasonPlanView` then `npm run build`.

### F5. Confirm placeholder sessions need no frontend change

- Per `design.md` Frontend §6: read `Trainings.tsx`'s Sesiones tab and
  `SeasonPlanView.tsx`'s per-Microciclo session list to confirm both already render any
  `TrainingSession` regardless of its `Name`/origin — no code change expected. Record the
  confirmation in the PR/commit description; do not add a placeholder badge/icon (explicitly
  out of scope per the proposal).

### F6. Final verification

- `npm run build` — zero TypeScript errors.
- `npm run test` — full suite green (no new failures beyond the pre-existing, unrelated ones
  already documented for this app).
- `openspec validate season-plan-target-subprincipios --strict` — must still pass; the
  Frontend tasks above don't add new spec scenarios (the existing `specs/season-plan/spec.md`
  already covers the UI-facing requirements this section implements).
- Manual smoke in `npm run dev`: open Planificación, edit a Microciclo, select 2 target
  Subprincipios, save, confirm the chips appear on the Microciclo card and persist across a
  reload; confirm a team with no GameModel shows the picker disabled with the hint while
  Semana/Inicio/Fin stay editable.
