## 1. Domain model (`Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/GameModels/`)

Aggregate root stays `GameModel` (`TeamId`, `Name`, `Season`), but the tree under it changes shape entirely. Catalog entities `GameMoment` (Fase) and `GameZone` (zoneKey) are **kept as-is** — they already model `faseSlug`/`zoneKey` from §1 of the spec.

```
GameModel (existing, unchanged)
 └─ GamePrinciple            (existing entity, repurposed)
     Id, GameModelId, GameMomentId, Key, Numero, Titulo, Texto
     └─ Subprincipio          (NEW)
         Id, GamePrincipleId, Key, Numero, Titulo, Texto
         ├─ Zona (0..N)                              (NEW — replaces GameZone-as-scenario-scope)
         │   Id, SubprincipioId, Key, ZoneKeysCsv, Label, ZonaTexto, Texto
         │   └─ SubSubPrincipio (0..N)
         └─ SubSubPrincipio (0..N, when Subprincipio has no Zona)
             Id, Key, Numero, Rol, Texto, SubprincipioId (nullable), ZonaId (nullable)
             └─ Habilidad (0..N)
                 Id, SubSubPrincipioId, Nombre (closed vocabulary), Descripcion, Entrenable, ReferenciaAKey (nullable)
 └─ Nota (0..N)                                       (NEW — polymorphic anchor)
     Id, GameModelId, Tipo, Texto, PrincipioId?, SubprincipioId?, ZonaId?, SubSubPrincipioId?
 └─ SetPieceRule (0..N, GameMomentId = balon-parado)   (NEW — flat, no children)
     Id, GameModelId, Subtype, Texto
 └─ OpenIssue (0..N)                                  (NEW)
     Id, GameModelId, Topic, Description, Status
```

Removed entities: `GameScenario`, `SubPrinciple` (old), `SubSubPrinciple` (old shape, replaced), `EssentialSkill` (old shape, replaced by `Habilidad`), `ZoneRule`, `Trigger`, `RuleException`, `IdentityAxis` (never shipped — was part of the abandoned prior design, not referenced anywhere outside it).

### 1.1 `SubSubPrincipio` polymorphic parent
Per spec §0: "si el Subprincipio no varía por zona, cuelga directo del Subprincipio". Model with two nullable FKs and enforce exactly-one-set in the `Create()` factory (throw/return a validation failure otherwise — follow whatever `BaseEntity`/handler-level validation pattern `GameScenario.ReparentTo` already uses for similar invariants).

### 1.2 `Nota` polymorphic anchor
Same technique: four nullable FKs (`PrincipioId`, `SubprincipioId`, `ZonaId`, `SubSubPrincipioId`), exactly one set, enforced in `Create()`. `Tipo` is one of `riesgo-aceptado | objetivo-temporada | nota | excepcion` (string, validated in the FluentValidation validator — no need for a DB enum given the existing project doesn't use SmartEnums for this kind of tag).

### 1.3 `Habilidad.Nombre` closed vocabulary
A `static readonly string[]` (or a small `HabilidadNombre` static class of consts, matching the flavor of existing catalog usage in this codebase) listing the 14 values from spec §4: Perfilamiento, Anticipación, Activación, Carga, Temporización, Comunicación, Entrada, Conducción, Protección de balón, Control orientado, Pase, Centro, Remate, Remate de cabeza. Validated both in the domain factory (defensive) and in `CreateGameModel`/`UpdateGameModel`'s FluentValidation validator (user-facing error).

### 1.4 `Key` columns and upsert
Every entity from `GamePrinciple` down to `SubSubPrincipio` gets a `Key` string column (unique index scoped to `GameModelId`), derived exactly per spec §1 (`{faseSlug}-{numero}`, `{faseSlug}-{X.Y}`, etc.). `Habilidad` has no own key — it's addressed by `(SubSubPrincipioId, Nombre)`, matching spec §1's "no necesita key propia". These keys are what makes the importer idempotent (upsert instead of duplicate rows) and are also useful for the frontend to build stable anchors when rendering the legible-shaped view.

## 2. Markdown importer (backend)

New service, e.g. `Infrastructure/GameModelImport/AdnLegibleImporter.cs` (project-appropriate namespace), implementing the parse rules in spec §2 (heading patterns → entity), the special-case Zona resolution table in §3, the closed vocabulary check in §4, the flat `SetPieceRule` block in §5, and the two-pass resolution for `(misma que X.Y.Z)` references in §8 (second pass because a referenced key may appear later in the document).

- Input: reads `docs/game-model/ADN-Modelo-de-Juego-Legible.md` from disk (path configurable, mirrors how other file-based config in this repo is read).
- Output: an in-memory tree of the entities in §1, keyed as in §1.4, ready to upsert against a specific `GameModel` (by `TeamId`/`Season`).
- Unresolvable Zona cabeceras (not matching §3's cases nor the catalog) are rejected with a clear error, per spec §8 — never silently forced into a wrong zone.
- Unknown `Habilidad.Nombre` values are rejected, per spec §8 — never silently created.
- `OpenIssue` entries import even if unresolved (`status: open` is a valid, expected state) — they don't block the rest of the import.

### 2.1 Seed usage
A dedicated **data migration** (EF Core migration whose `Up()` calls into the importer, or a `DbContext`-seeding console step run once against the target `GameModel` row for the user's own team/season) runs the importer against the real `ADN-Modelo-de-Juego-Legible.md` at migration time, so the user's actual model is populated without manual entry. Because the importer is idempotent by `Key`, it is safe to point back at the same command later if the legible document changes — this satisfies "seed once" now and "reusable importer" going forward without needing two separate code paths.

## 3. EF Core migration

Single migration, e.g. `20260811_ReplaceGameModelAdnHierarchy`:
- Drop tables (in FK order): `EssentialSkills`, `SubSubPrinciples`, `SubPrinciples`, `GameScenarios`, `TaskTrainingSkills` (see §5 below — dropped, not migrated), plus the never-shipped `IdentityAxes`/`ZoneRules`/`Triggers`/`RuleExceptions`/`OpenIssues`/`SetPieceRules` if any leftover tables exist from the discarded prior attempt (verify against the current DB schema before writing `Down()` — the prior in-progress migrations were never applied, so this is likely a no-op, but confirm).
- Alter `GamePrinciples`: drop `GameZoneId` (a `GamePrinciple` is Fase-scoped only now, not Fase×Zona — Zona moves down to hang off `Subprincipio`), add `Key`.
- Create `Subprincipios`, `Zonas`, `SubSubPrincipios` (new shape), `Habilidades`, `Notas`, `SetPieceRules`, `OpenIssues`.
- No `Down()` data-preservation logic needed — per the confirmed decision, existing `GameModel` data is disposable. `Down()` just reverses the schema.
- This migration is data-destructive by design; call that out in the migration's XML doc comment so nobody mistakes it for reversible.

## 4. Unlink exercises/sessions

- `TaskTrainingBase.cs`: remove `SubSubPrincipleId`, `SubPrincipleId`, `ScenarioId` and their navigation properties.
- `TaskTrainingSkill.cs`: delete entirely (join table Exercise↔EssentialSkill; `EssentialSkill` itself is gone).
- `TrainingSession.cs`: remove `SubPrincipleId`.
- EF configs: `TaskTrainingBaseEntityConfiguration.cs` drop the three `HasOne(...)` blocks; delete `TaskTrainingSkillConfiguration.cs`.
- `CreateExercise.cs`/`UpdateExercise.cs`/`GetExercises.cs`/`GetExerciseById.cs`: drop the three id fields from request/response, the "at most one" validator rule, and the `Include()`s/name projections.
- `CreateSession.cs`/`GetSession.cs`/`GetSessions.cs`: drop `SubPrincipleId`.
- Migration: same migration as §3 (or a preceding one if sequencing requires it) drops `TaskTrainingSkills` and the three FK columns.
- Tests: delete `ExerciseSubPrincipleAssignmentTests.cs` (its entire subject is gone); strip the id fields from `CreateExerciseHandlerTests.cs`, `DeleteScenarioMediaHandlerTests.cs` (delete — no more scenario media), `GetExerciseByIdHandlerTests.cs`, `GetExercisesHandlerTests.cs`, `UpdateExerciseHandlerTests.cs`, `UploadScenarioMediaHandlerTests.cs` (delete — no more scenario media).

## 5. API shape (`Features/Coaches/GameModels/`)

- `GetGameModel` (query, unchanged route `GET /api/game-models?teamId&season`): returns the full nested tree — `principles[] → subprincipios[] → (zonas[] → subsubprincipios[]) | subsubprincipios[] → habilidades[]`, with `notas[]` attached at whichever level they anchor to, plus a top-level `setPieceRules[]` and `openIssues[]`.
- `CreateGameModel`/`UpdateGameModel`: same nested shape as the request body; upsert-by-`Key` semantics reused from the importer's matching logic where practical (handler-level matching can just match by id like today; `Key` is importer-owned, not something the manual editor needs to set).
- Remove: `MoveScenarioLocation.cs` (no `GameScenario` left to move — reparenting a `Subprincipio`/`Zona` isn't a requirement here; add back only if the user asks), `ToggleSkillMastered.cs` (no more mastery tracking per the new `Habilidad` shape — not in spec), `UploadScenarioMedia.cs`/`DeleteScenarioMedia.cs` (no more `GameScenario`/media field in the new spec), `GetSubSubPrinciple.cs` (was exercise-facing; exercises no longer reference this level).
- Keep `GetGameMoments.cs`/`GetGameZones.cs` (catalogs unchanged) and `GetGameModelSeasons.cs`.
- `DeleteGameModel.cs`: cascades through the new tree instead of the old one — same endpoint, new shape underneath.

## 6. Frontend (`Front/src/apps/coach/`)

### 6.1 Types (`types/gameModel.ts`)
Mirror the domain: `GameModel { name, season, principles: Principle[], setPieceRules: SetPieceRule[], openIssues: OpenIssue[] }`, `Principle { faseSlug, numero, titulo, texto, subprincipios: Subprincipio[], notas: Nota[] }`, `Subprincipio { numero, titulo, texto, zonas: Zona[], subsubprincipios: SubSubPrincipio[], notas: Nota[] }` (zonas and direct subsubprincipios are mutually exclusive per spec §0), `Zona { zoneKeys, label?, zonaTexto?, texto, subsubprincipios, notas }`, `SubSubPrincipio { numero, rol, texto, habilidades: Habilidad[] }`, `Habilidad { nombre, descripcion, entrenable, referenciaA? }`, `Nota { tipo, texto }`. Keep the existing client-side numeric `id` + optional `apiId` convention from the current file for reducer/key stability.

### 6.2 Read view — reproduces the legible document
Replace the tabbed moment→zone→accordion browse (`GameModel.tsx`/`ScenarioAccordion.tsx`) with a view structured like `ADN-Modelo-de-Juego-Legible.md` itself: Fase sections in document order, each Principio as a numbered heading with its texto as a paragraph, Subprincipios as sub-headings, Zonas (when present) as labeled blocks under their Subprincipio, SubSubPrincipios with their Rol and Habilidades as a bullet list (nombre + descripcion + entrenable), Notas rendered inline near their anchor (styled distinctly by `tipo`, e.g. a callout for `riesgo-aceptado`/`excepcion`), and a flat "Balón parado" section at the end listing `SetPieceRule`s by `subtype`. `GameModelPrintView.tsx` becomes the same structure, print-styled (this print view and the on-screen read view converge on effectively the same renderer, so consider a single shared component with a `print` prop instead of two divergent trees).

### 6.3 Edit view
`GameModelCreate.tsx`/`ScenarioFormAccordion.tsx` become a form editor over the same tree — CRUD at each level (Principio → Subprincipio → Zona/SubSubPrincipio → Habilidad), Nota add/edit/delete anchored per level, SetPieceRule and OpenIssue as separate flat sections. `GameModelDraftContext.tsx`'s reducer gains actions for every new level and drops all `Scenario`/`SubPrinciple`(old)/`EssentialSkill`/media/tactical-principle actions.

### 6.4 Removed
`CreateSessionFromSubPrinciple.tsx`, `SessionsFromSubPrinciple.tsx`, `components/PrincipleExercisesSection.tsx`, `components/ScenarioMediaField.tsx`, `components/DrillDownPanel.tsx` if nothing else uses it after this rewrite (check other consumers before deleting), `components/SubSubPrincipleCard.tsx`'s exercise section (component itself may be repurposed for rendering a SubSubPrincipio card without the exercise embed).

## 7. Unlink exercises/sessions (frontend)

`pages/trainings/new/hooks/useExerciseForm.ts`, `ExerciseFormPanel.tsx`, `types.ts`, `constants.ts`, `NewExercisePage.tsx`, `pages/trainings/components/ExerciseDialog.tsx`, `ExerciseCromo.tsx`, `Trainings.tsx`, `types/training.ts`, `services/trainingService.ts`: remove `subSubPrincipleId`/`subPrincipleId`/`scenarioId` fields, the level-picker UI, and the `gameModelService.getSubSubPrincipleSkills` call.

## 8. Test strategy

Backend: domain tests for `Create()` invariants (exactly-one-parent on `SubSubPrincipio`/`Nota`, closed-vocabulary rejection on `Habilidad`), an importer test using the §6 fixture from the spec as a golden test case (exact expected entities), a migration/seed integration test asserting the seeded `GameModel` matches the fixture, and handler tests for `CreateGameModel`/`UpdateGameModel`/`GetGameModel`/`DeleteGameModel` against the new shape. Frontend: reducer tests per new action, service mapping tests, and read/edit view tests asserting the legible-shaped rendering (heading levels, Nota callouts, SetPieceRule section) plus regression tests on the trainings pages confirming no game-model fields remain.
