## Context

`docs/game-model/Plan-de-Temporada.docx` (extracted in full during proposal research — see Appendix A) describes the club's periodización táctica methodology for one team (Cadete, 2ª División): Macrociclo (a depth layer of the ADN model) → Mesociclo (weeks dedicated to one field zone — Creación Propia, Creación Rival, Iniciación, Finalización — working defensa organizada, ataque organizado and both transitions together) → Microciclo (a week; Macrociclo 1's mesociclos run analítico → situacional → global over 3 weeks, Macrociclo 2's run analítico A/B → situacional A/B → global exposición/evaluación over 6 weeks).

This mirrors, at the planning-calendar level, the tree shape the codebase already has strong precedent for: `GameModel → GamePrinciple → GameScenario` and `TeamRulesSet → TeamRule` are both "one root per Team(+Season), ordered nested children, edited as a whole via full-aggregate PUT". `SeasonPlan` reuses that shape rather than inventing per-node CRUD endpoints.

The 11 Aug 2026 change (`archive/2026-08-11-game-model-adn-hierarchy`) deliberately removed every FK from `TaskTrainingBase` to the ADN hierarchy ("exercises... will no longer reference the game model at all"). This change reintroduces **one** narrow FK — `TaskTrainingBase.MicrocicloId` — to a **different**, purpose-built planning entity, not back to `GameModel`. This is called out explicitly here and in `tasks.md` so it isn't mistaken for a silent rollback of that decision.

## Goals / Non-Goals

**Goals:**
- One `SeasonPlan` per Team+Season, coach-editable end-to-end (create/edit/delete/reorder macro/meso/microciclos) from the Coach app.
- A rerunnable seed that loads the real Plan de Temporada content for its target team/season.
- Exercises can optionally link to a Microciclo; the Planificación tab shows, per Microciclo, whether it has 0 or N linked exercises.
- Follow existing conventions exactly: `IFeatureModule` vertical slice, `IRequireFeaturePermission`, FluentValidation, flat migration, CSS Modules + MUI theme, single Axios service file.

**Non-Goals:**
- No structured FK from Microciclo to specific `Subprincipio`/`Zona` tree nodes of a team's `GameModel` — session objectives stay free text (see Decision 2). A team's `GameModel` content and its `SeasonPlan` are edited independently; nothing enforces they describe the same subprincipios.
- No automatic/generated exercises — the seed only creates the planning calendar (Macrociclo/Mesociclo/Microciclo rows), never `TaskTrainingBase` rows.
- No versioning/history — edits overwrite in place (same trade-off as `UpdateGameModel`).
- No optimistic concurrency — same accepted trade-off as `UpdateGameModel`/`SaveTeamRules`.
- No changes to `Mobile/`.

## Decisions

### 1. Domain shape: `SeasonPlan` aggregate root, `BaseEntity` children, plain constructors

```
SeasonPlan : BaseEntity, IAggregateRoot         table: SeasonPlans, schema app
  TeamId        string, required
  SeasonId      string, required (FK → Season, see Decision 3)
  Macrociclos: List<Macrociclo>

Macrociclo : BaseEntity                         table: Macrociclos, schema app
  SeasonPlanId  string, required
  Order         int, required
  Name          string, required   e.g. "Macrociclo 1"
  StartDate     DateOnly, required
  EndDate       DateOnly, required
  Mesociclos: List<Mesociclo>

Mesociclo : BaseEntity                          table: Mesociclos, schema app
  MacrocicloId  string, required
  Order         int, required
  Name          string, required   e.g. "Mesociclo 1.1 — Creación Propia"
  StartDate     DateOnly, required
  EndDate       DateOnly, required
  GameZoneId    int, required (FK → GameZone catalog)
  Microciclos: List<Microciclo>

Microciclo : BaseEntity                         table: Microciclos, schema app
  MesocicloId       string, required
  Order             int, required
  WeekLabel         string, required   e.g. "Semana 1 — Analítico", "Semana 2 — Situacional B"
  StartDate         DateOnly, required
  EndDate           DateOnly, required
  ObjetivoSesionA   string, required (free text — Defensa organizada + Transición defensa-ataque)
  ObjetivoSesionB   string, required (free text — Ataque organizado + Transición ataque-defensa)
```

Follows `GameModel`'s actual style (confirmed in this codebase, not the generic `.claude/rules/dotnet.md` template which describes an unrelated project): plain public constructors (`Macrociclo(seasonPlanId, order, name, startDate, endDate)`, etc.), not a `Create()` factory returning `DomainOutcome`. Mutators (`UpdateName`, `Reschedule(startDate, endDate)`, `UpdateObjectives(sesionA, sesionB)`) throw `ArgumentException` on blank required strings / inverted date ranges, matching `Zona`'s/`GamePrinciple`'s invariant style.

`GameZoneId` is a **required** FK on `Mesociclo` (not the per-GameModel `Zona` tree node) — it points at the fixed 4-row `GameZone` catalog (`iniciacion`/`creacion-propia`/`creacion-rival`/`finalizacion`, ids 1–4 per `GameModelKeys.ZoneKeysById`), the same catalog `GamePrinciple`/`Zona` already key off. This is what lets a Mesociclo declare "this is the Creación Propia block" without depending on any specific team's `GameModel` tree existing or being populated.

Rejected: giving `Microciclo` a many-to-many link to actual `Subprincipio` rows — rejected per Non-Goals; it would force `SeasonPlan` to depend on a specific `GameModel` snapshot existing and staying in sync, which the user's stated acceptance criteria (manual CRUD + seed + coverage) don't require. Free-text objectives match how the source document itself describes each week (prose, not subprincipio codes) and avoid a data-integrity dependency between two independently-edited aggregates.

### 2. Endpoints: full-aggregate CRUD, mirroring `GameModel`

New folder `Features/Coaches/SeasonPlans/`:
- `Commands/CreateSeasonPlan.cs` — `CreateSeasonPlanCommand : IRequest<SeasonPlanDto>, IRequireFeaturePermission` (`FeatureRoute = CoachFeatureRoutes.SeasonPlan`, `RequiredPermission = "ReadWrite"`). `POST /api/season-plans`. Body: `{ teamId, seasonId, macrociclos: [{ order, name, startDate, endDate, mesociclos: [{ order, name, startDate, endDate, gameZoneId, microciclos: [{ order, weekLabel, startDate, endDate, objetivoSesionA, objetivoSesionB }] }] }] }`. Fails with `409` (via `ProblemDetails`) if a `SeasonPlan` already exists for that Team+Season.
- `Commands/UpdateSeasonPlan.cs` — `UpdateSeasonPlanCommand : IRequest<SeasonPlanDto>, IRequireFeaturePermission`. `PUT /api/season-plans/{id}`. Same nested body; replaces the full Macrociclo/Mesociclo/Microciclo tree in one save (clear-and-rebuild children, contiguous `Order` re-derived server-side from array position — same "don't trust client `Order`" decision as `SaveTeamRulesCommand`).
- `Commands/DeleteSeasonPlan.cs` — `DeleteSeasonPlanCommand : IRequest, IRequireFeaturePermission`. `DELETE /api/season-plans/{id}`. Cascade-deletes children. Before deleting, sets `MicrocicloId = null` on any linked `TaskTrainingBase` rows (exercises are never deleted by this).
- `Queries/GetSeasonPlan.cs` — `GetSeasonPlanQuery : IRequest<SeasonPlanDto?>, IRequireFeaturePermission` (`RequiredPermission = "Read"`). `GET /api/season-plans?teamId=&seasonId=`. Returns `204` if none exists yet (mirrors `GetGameModel`). Each `MicrocicloDto` includes `ExerciseCount` (a `COUNT` over `TaskTrainingBases` grouped by `MicrocicloId`, `AsNoTracking`) — this single query is what powers the coverage view, no separate endpoint needed.

`CoachFeatureRoutes.SeasonPlan = "/coach/season-plan"` added to `Domain/Entities/CoachFeatureRoutes.cs` (new `FeaturePermission` row seeded like existing routes). Handlers inject `AppDbContext` directly and do the same manual `UserClubs`/`Teams` membership check `GameModel`'s handlers already do (no `IRequireTeamMembership`, consistent with that precedent for Coach-side routes).

### 3. `SeasonId` as a real FK, not a copy of `GameModel`'s free-string `Season`

`Team.SeasonId` already has a proper relation to `Domain/Entities/Seasons/Season.cs`. `GameModel.Season` is a plain string — an existing inconsistency in this codebase, not a pattern worth propagating. `SeasonPlan.SeasonId` uses the real FK. This is a deliberate deviation from `GameModel`'s shape, called out here so it doesn't read as an oversight; fixing `GameModel.Season` itself is out of scope.

### 4. `TaskTrainingBase.MicrocicloId`: nullable FK, no reverse navigation required

Add `public string? MicrocicloId { get; set; }` to `TaskTrainingBase.cs`, FK to `Microciclo` (`OnDelete: SetNull`, matching the "unlink on Microciclo delete" behavior from Decision 2), configured in `TaskTrainingBaseEntityConfiguration.cs`. Exposed in `CreateExerciseRequest`/`UpdateExerciseRequest`/`ExerciseDto` (backend) and `Exercise`/`CreateExerciseRequest`/`UpdateExerciseRequest` (`Front/src/apps/coach/types/training.ts`). No new join table, no reverse `List<TaskTrainingBase>` navigation on `Microciclo` needed on the backend — the frontend fetches exercises for a Microciclo via a small filter param on the existing `getExercises` query (`microcicloId?`) rather than nesting them into the `SeasonPlan` payload, keeping `GetSeasonPlan` cheap (count only) and `getExercises` reusable for "show me this week's exercises" if ever needed.

### 5. Seed: rerunnable importer service, migration-invoked, explicit target Team+Season

New `Infrastructure/Services/SeasonPlanImporter.cs` (mirrors the ADN markdown importer's shape): given a hardcoded in-memory representation of the Plan de Temporada content (transcribed from Appendix A into C# object initializers — the source is a `.docx`, not a re-parseable markdown file like the ADN one, so this is data-as-code, not a text parser) plus a `(teamId, seasonId)` pair, upserts the `SeasonPlan` tree by a deterministic key per node (`$"{teamId}:{seasonId}:macrociclo:{order}"` etc.), so re-running it after editing the hardcoded data updates rather than duplicates.

Unlike `TeamRulesSet`'s migration (which matched its one target team via a unique stored blob URL already in the DB), there is no existing unique marker identifying "the Cadete 2ª División team" in this codebase from planning alone. **Open question, resolved at implementation time** (task included in `tasks.md`): query the dev DB for the team this plan belongs to (name/category match) and hardcode that `TeamId`/`SeasonId` into the migration's data step, same caveat pattern as the `TeamRulesSet` migration. If no confident match is found, the importer method still ships (rerunnable, callable manually) but the migration's data step is skipped/no-op — not a blocking failure.

## Amendment (post-implementation): real ADN links on Microciclo sessions

After the first implementation pass, the user reviewed it against the source document's actual content — e.g. "Defensa organizada 1.1 + Transición defensa-ataque 1.1: evitar que el rival progrese con orden en esta zona; al robar, mantener el balón sin transición rápida ni pase largo" — and confirmed that free-text objectives alone (Decision 1, as originally written) are **not enough** to build exercises from: a coach needs to see exactly which `Subprincipio`/`SubSubPrincipio` nodes and which `Habilidad`(s) are imprescindibles for each session, not just prose. This supersedes Decision 1's "Rejected" call on structured ADN links — the dependency between `SeasonPlan` and a team's `GameModel` is now intentional, not avoided.

**New shape**, additive to the already-implemented `Microciclo` (no rename of existing fields):

- `Microciclo.ObjetivoSesionA`/`ObjetivoSesionB` (existing free text) are kept as narrative context, unchanged.
- Two new many-to-many join tables, one row per (Microciclo, Session, node):
  - `MicrocicloSubprincipioLinks`: `Id, MicrocicloId, Session ('A'|'B'), SubprincipioId` (FK → `Subprincipio`, `OnDelete: Cascade` — if the referenced `Subprincipio` is later removed from the team's `GameModel`, the link row disappears silently; the Microciclo and its free text survive).
  - `MicrocicloSubSubPrincipioLinks`: same shape, `SubSubPrincipioId` (FK → `SubSubPrincipio`, same cascade behavior).
- Two new `jsonb` columns on `Microciclo` itself (no join table — `Habilidad.Nombre`'s 14-value vocabulary is a closed catalog, not per-team entity instances, same reasoning as `TeamRulesSet.BulletPoints`'s jsonb precedent): `SesionAHabilidades: List<string>`, `SesionBHabilidades: List<string>`, each validated server-side against `Habilidad.Vocabulary`.

**Why Subprincipio *and* SubSubPrincipio, not just one level**: the source document's own numbering ("1.1") is at `Subprincipio` granularity, which is what a coach picks first; `SubSubPrincipio` (more specific "rol" nodes, e.g. within a `Zona`) is offered as optional additional precision when the team's ADN goes that deep for the relevant `Subprincipio`. Neither is required — both lists may be empty, e.g. for a team whose `GameModel` isn't populated yet.

**Dependency accepted, not hidden**: picking a `Subprincipio`/`SubSubPrincipio` for a session requires the team to already have a `GameModel` for that season with matching content — the picker is scoped to `GetGameModel(teamId, seasonId)`'s current tree. If no `GameModel` exists yet, the picker shows an empty state directing the coach to build the ADN first, rather than blocking Microciclo editing entirely (the free-text objectives and Habilidad selection remain available regardless).

**API contract additions**:
- `Create`/`UpdateSeasonPlanCommand`'s `MicrocicloRequest` gains: `SesionASubprincipioIds: List<string>`, `SesionASubSubPrincipioIds: List<string>`, `SesionAHabilidades: List<string>`, and the `SesionB` equivalents.
- `GetSeasonPlan`'s `MicrocicloDto` gains resolved, denormalized summaries per session so the frontend renders badges without extra round-trips: `SesionASubprincipios: [{ Id, Numero, Titulo, GameMomentName }]`, `SesionASubSubPrincipios: [{ Id, Numero, Rol }]`, `SesionAHabilidades: [string]`, and the `SesionB` equivalents.
- New query `GET /api/season-plans/adn-options?teamId=&seasonId=` (or reuse `GetGameModel`'s existing response client-side, flattened — **implementation decision**: reuse the existing `GET /api/game-models?teamId=&season=` response and flatten it client-side into a picker's option list, rather than adding a new backend endpoint, since `gameModelService.ts` already fetches and maps this tree for the `game-model` page).

**Risk added**: this reintroduces exactly the kind of cross-aggregate dependency Decision 1 originally avoided — editing a team's `GameModel` (removing/renumbering a `Subprincipio`) can silently drop `SeasonPlan` links that referenced it. Accepted per explicit user direction; mitigated only by the cascade-delete keeping the data model consistent (no orphaned FKs), not by any UI warning on the `GameModel` edit side (out of scope for this change).

## Risks / Trade-offs

- **[Risk] Seed migration needs a live-DB team lookup not available during design** → **Mitigation**: same accepted pattern as `TeamRulesSet`'s migration; `tasks.md` requires the `SELECT` + eyeball check before finalizing; importer is safe to no-op or re-run.
- **[Risk] Free-text session objectives (Decision 1) mean the Planificación tab can't cross-filter "show me exercises for Subprincipio 1.1"** → accepted; the user's stated acceptance criteria only ask for manual CRUD + seed + per-Microciclo coverage, not ADN-level filtering. Flagged as a possible follow-up, not blocking.
- **[Trade-off] `GameModel.Season` (string) vs. `SeasonPlan.SeasonId` (FK) inconsistency persists** → accepted per Decision 3; not fixing pre-existing `GameModel` shape in this change.
- **[Risk] Full-aggregate `PUT` allows concurrent edits to silently clobber each other** → same accepted trade-off as `UpdateGameModel`/`SaveTeamRulesCommand`, not a regression introduced here.

## Open Questions

- Exact Team+Season to target for the seed — resolved at implementation time via DB lookup (see Decision 5).
- Where exactly in `Trainings.tsx`'s tab bar "Planificación" should sit relative to "Ejercicios"/"Sesiones" (proposed: third tab, after Sesiones) — trivial, confirmed at implementation time.
- Max lengths for `Name`/`WeekLabel`/`ObjetivoSesionA`/`ObjetivoSesionB` — follow existing `ValidationConstants` sizing convention, finalized when the validator is written.

## Appendix A — Source content

Full text of `docs/game-model/Plan-de-Temporada.docx` was extracted and reviewed during the proposal conversation (macrociclo/mesociclo/microciclo calendar, all per-zone/per-week objectives for Macrociclo 1 and Macrociclo 2, cierre de temporada). It is not duplicated in full here to keep this document focused; `tasks.md` includes a task to transcribe it into the `SeasonPlanImporter`'s hardcoded data during implementation, re-reading the source `.docx`/`.pdf` directly at that time.
