# Design

## Backend

Scope: `Back/ExtractionApi/`. Covers domain model, EF Core schema/migrations, feature
modules (endpoints/commands/queries), and the seed rebuild. Naming decision up front: this
design **keeps the existing entity/table names** `TaskTrainingBase` (table
`TaskTrainingBases`, the "Ejercicio") and `TrainingSession` (table `SessionTrainings`, the
"Sesión") rather than renaming them, to minimize blast radius across the codebase (Storage
upload endpoint, permission routes, existing working features). API request/response DTOs
use the Spanish domain wording (`Objetivo`, `Niveles`, `Bloques`, etc.) regardless of the
underlying CLR type names — front coordination should key off the DTOs in §4, not the entity
class names.

### 1. Domain model changes

#### 1.1 `TaskTrainingBase` (Ejercicio) — restructured

Kept as-is: `Id`, `ClubId`/`Club` (club-owned shared library, unchanged access pattern),
`Name` (maps to "Título"), `UrlImage`, `BoardStateJson` (canvas widget, out of scope).

Renamed: `Methodology` → `Tipo`, allowed values become `Analitico | Situacional | Global`
(was `Analitico | Integrado | Global` — "Integrado" is replaced by "Situacional" per the
template; a `Tipo` value of `Analitico` covers the "Analítico (físico)" case from the
example — the "(físico)" qualifier is free text inside `Name`/`Descripcion`, not modeled).

Added:
- `Objetivo` (string, required) — the one-sentence goal.
- `ObjetivoPorRol` (string, nullable) — only when roles differ.
- `Logistica` (string, required, free text) — replaces the structured
  `PlayersNumber`/`GoalPeekersNumber`/`FieldSpace`/`Material` fields.
- `DurationMinutes` (int, nullable) — **not** in the template as a separate field (the
  template keeps time inside the `Logistica` prose), but kept as a small structured escape
  hatch so `Plantilla-Sesion`'s "Duración total: suma del Tiempo de cada ejercicio" can be
  computed by the API instead of asking the coach to add minutes by hand. Documented
  deliberate deviation — flag for frontend coordination (§ below).
- `Porteros` (string, nullable) — separate optional line.
- `Dibujo` (string, nullable, free text/placeholder, e.g. "(pendiente)" or a caption) — the
  image itself continues to use the existing `UrlImage` + `POST /api/trainings/exercises/{id}/media`
  upload flow, unchanged.
- `Descripcion` (string, required) — replaces `Description`; single long execution text,
  including what used to be bullet `ExerciseCondition` rows (folded into prose, per template:
  "como un único texto corrido, no campos separados").
- `Niveles` (jsonb, see §1.3).
- `ModelRelations: List<ExerciseModelRelation>` (see §1.2), replacing the flat
  `ModelLinks`/`Habilidades` pair.

Removed entirely (not part of the reduced template, and exercises are being deleted anyway
so no migration path is needed — see §3):
- `Types`/`TaskTrainingType`/`ExerciseType` (Physical/Technical/Tactical/Game/Cognitive/
  Psychological axis — the template has only one `Tipo` axis).
- `PlayersNumber`, `GoalPeekersNumber`, `FieldSpace`, `Material`/`MaterialsEnum` M:N
  (absorbed into `Logistica` prose).
- `Series`, `DurationSeries`, `RestSeries`, `TouchesNumber`, `WildCards`, `Points` (TPH
  leftovers not referenced by the template; fold into `Descripcion` prose where relevant).
- `Section` (`Calentamiento`/`Principal`/`VueltaALaCalma`) — superseded by free-named
  `SessionBlock.Nombre` (§1.4); an exercise is no longer tagged with a fixed section of its
  own, only through the block it's placed in.
- `MicrocicloId` direct FK — **this is the req #1/#3 change**: an exercise never links to
  the plan directly any more. It only reaches the plan transitively, by being placed inside a
  `SessionBlock` of a `TrainingSession` that itself optionally links to a `Microciclo`
  (§1.5).
- `ExerciseCondition` entity and its CRUD feature (`ExerciseConditionsCrud.cs`) — deleted.
- `ExerciseModelLink` entity — replaced by `ExerciseModelRelation`/`ExerciseModelRelationItem`
  (§1.2), which model the template's grouping (habilidades per Fase/Subprincipio block)
  instead of a flat list.

**Task for the implementer**: before deleting `Types`, `Material`, `Points`, grep the whole
solution for `TaskTrainingType`, `ExerciseType`, `MaterialsEnum`, and `TrainingPointsReport`
to confirm nothing outside the exercise feature slice depends on them (a couple of these
look like they might be shared catalog concepts — verify before dropping the DbSet/table,
not just the property). If something else depends on them, keep the table but drop only the
navigation from `TaskTrainingBase`.

#### 1.2 Relación con el modelo de juego — `ExerciseModelRelation` / `ExerciseModelRelationItem`

The template's block:

```
- Fase — Principio — Subprincipio X.Y — Título  (FOCO or normal/INTEGRADO)
  - X.Y.Z — Rol: acción                          (FOCO or INTEGRADO)
  - Habilidades imprescindibles: lista
(repeatable)
```

maps to two new entities (replacing the old flat `ExerciseModelLink`):

```csharp
public class ExerciseModelRelation : BaseEntity
{
    public string TaskTrainingBaseId { get; }
    public string SubprincipioId { get; }       // Fase+Principio+Subprincipio all resolve
                                                  // via Subprincipio -> GamePrinciple -> GameMoment
    public bool IsFoco { get; }                  // bold row = FOCO of the session
    public List<string> HabilidadesImprescindibles { get; } // jsonb, closed 15-value vocabulary
                                                              // (Habilidad.Vocabulary), same
                                                              // pattern as today's Habilidades column
    public List<ExerciseModelRelationItem> Items { get; }
}

public class ExerciseModelRelationItem : BaseEntity
{
    public string ExerciseModelRelationId { get; }
    public string SubSubPrincipioId { get; }     // the X.Y.Z node ("Rol: acción")
    public bool IsFoco { get; }                  // item-level FOCO/INTEGRADO, independent of
                                                  // the parent relation's own flag
}
```

`ExerciseModelRelation` requires a `SubprincipioId` always (per template the top-level row is
always "Subprincipio X.Y", never a bare SubSubPrincipio) — this is stricter than the old
`ExerciseModelLink`, which allowed linking a bare `SubSubPrincipio` with no parent row. Items
are optional (a relation can be a bare "INTEGRADO — preparación transversal" row with no
X.Y.Z children, as in the "Rondo con porterías" example). The whole
`ModelRelations` collection can be empty (physical-only exercise).

Both `HabilidadesImprescindibles` (on the relation) use the existing jsonb `List<string>`
conversion pattern already used for `TaskTrainingBase.Habilidades` and
`Microciclo.SesionAHabilidades` (`System.Text.Json` + `HasColumnType("jsonb")` + a
`ValueComparer`) — see `TaskTrainingBaseEntityConfiguration.ConfigureHabilidadesColumn`.
Copy that helper into the new `ExerciseModelRelationConfiguration`.

#### 1.3 Niveles — jsonb document, not an EAV table

**Decision: model `Niveles` as a single jsonb column holding a small typed document, not a
relational EAV schema (`ExerciseLevelColumn`/`ExerciseLevelValue` tables).**

Rationale:
- The data is inherently a small nested document (2–5 rows × 1–5 free-named columns) that is
  always read and written as a whole per exercise — nothing in the requirements needs to
  filter/sort/aggregate across exercises by a specific palanca column, which is the only
  scenario where an EAV table earns its extra join complexity.
- The codebase already has an established, reviewed pattern for exactly this shape (a
  `List<T>`/document column serialized to jsonb with a converter + `ValueComparer`) used
  three times already (`TaskTrainingBase.Habilidades`, `Microciclo.SesionAHabilidades`,
  `Microciclo.SesionBHabilidades`). Reusing it is the path of least surprise for anyone
  reading the DbContext config.
- Column names/values are genuinely free text per exercise ("no hay un esquema fijo de
  columnas") — an EAV table would still need a `Value` as free text per cell anyway, so it
  buys type safety on nothing while adding two extra tables, two extra configurations, and
  N+1-shaped queries for what is otherwise a single-row read.

Shape:

```csharp
public sealed record ExerciseLevelRow(int Nivel, Dictionary<string, string> Valores);

public class TaskTrainingBase : BaseEntity
{
    // ...
    public List<string> NivelesColumnas { get; private set; } = new();   // ordered palanca names
    public List<ExerciseLevelRow> Niveles { get; private set; } = new(); // 2-5 rows
}
```

Both `NivelesColumnas` (`List<string>`) and `Niveles` (`List<ExerciseLevelRow>`) are jsonb
columns via the same `HasConversion`/`ValueComparer` pattern (the row type needs its own
`JsonSerializer.Serialize`/`Deserialize<List<ExerciseLevelRow>>` — straightforward since
`ExerciseLevelRow` is a plain serializable record).

Domain invariants enforced in `TaskTrainingBase.UpdateNiveles(columnas, niveles)`:
- `niveles.Count` between 2 and 5.
- `niveles.Select(n => n.Nivel)` must be `1..niveles.Count` with no gaps/duplicates.
- Every row's `Valores.Keys` must be a subset of `columnas` (no orphan cells) — extra
  validation happens in the FluentValidation validator too (400 vs domain invariant is
  belt-and-braces, matching the existing `Habilidad.Vocabulary` double-check pattern in
  `TaskTrainingBase.UpdateHabilidades` + `CreateExerciseValidator`).

#### 1.4 Sesión — `TrainingSession` gains Blocks, drops flat Tasks

Kept as-is: `Id`, `Name`, `Date`, `StartTime`, `EndTime`, `Location`, `SportEventId`,
`TeamId`/`Team`, `UrlImage` (reused for "Mapa de campo general" image), `Description`
(kept, low-risk free text already present — not part of the template but harmless to leave).

Added:
- `MicrocicloId` (string, nullable FK) — **the req #2/#3 change**: optional, explicit
  association to a plan week. Same unidirectional-FK-on-the-child shape as the old
  `TaskTrainingBase.MicrocicloId` (`HasOne<Microciclo>().WithMany().OnDelete(SetNull)`), so a
  microciclo's linked sessions are queried (`_db.TrainingSessions.Where(s => s.MicrocicloId
  == id)`), not stored as a collection on `Microciclo` — consistent with the existing
  convention in this codebase.
- `ObjetivoGeneral` (string, nullable) — promoted out of the "only when part of the plan"
  block in `Plantilla-Sesion.md`, because a standalone session (no plan) can still usefully
  state its objective; only the Macrociclo/Mesociclo/Microciclo/Zona/"Sesión Nº" framing is
  plan-dependent, not the objective itself.
- `MapaCampoTexto` (string, nullable) — text placeholder/caption for "Mapa de campo general"
  when there's no image yet (mirrors `TaskTrainingBase.Dibujo`).
- `Blocks: List<SessionBlock>` — replaces `Tasks: List<TaskTraining>`.

New entities:

```csharp
public class SessionBlock : BaseEntity
{
    public string TrainingSessionId { get; }
    public int Order { get; }
    public string Nombre { get; }                     // "Bloque 1 — Calentamiento"
    public string ComoConectaConAnterior { get; }      // required even for block 1
                                                        // ("primer bloque de la sesión — ...")
    public string? RotacionEntreEjercicios { get; }    // only meaningful when >1 exercise
    public List<SessionBlockExercise> Exercises { get; }
}

public class SessionBlockExercise : BaseEntity
{
    public string SessionBlockId { get; }
    public string TaskTrainingBaseId { get; }          // FK to the Ejercicio
    public int Position { get; }                       // order within the block; >1 exercise
                                                          // at the same block = "en paralelo"
}
```

`TaskTraining`/`TasksTraining` (the old flat Session↔Exercise join with `Order`+`Section`) is
**removed**; `SessionBlockExercise` replaces it. Deleting an exercise still referenced by a
`SessionBlockExercise` is blocked (see §4 `DeleteExercise`), matching the existing
`DomainException`/`ErrorCodes` pattern rather than silently cascading.

`SessionBlockExercise → TaskTrainingBase` FK uses `DeleteBehavior.Restrict` (an exercise
can't be hard-deleted from under a session; must be removed from the block first, or the
session/block deleted first). `SessionBlock → TrainingSession` and `SessionBlockExercise →
SessionBlock` both cascade on delete (deleting a session/block does not touch the
`TaskTrainingBase` rows themselves — exercises keep their own club-library lifetime).

#### 1.5 Microciclo — simplified

Removed: `ObjetivoSesionA`/`ObjetivoSesionB`, `GameZoneIdSesionA`/`GameZoneIdSesionB`,
`SesionAHabilidades`/`SesionBHabilidades`, `SubprincipioLinks`/`SubSubPrincipioLinks` and
their backing entities `MicrocicloSubprincipioLink`/`MicrocicloSubSubPrincipioLink`, the
`SessionA`/`SessionB` string-constant duality, and every method built around it
(`UpdateObjectives`, `UpdateZones`, `UpdateSesionAHabilidades`/`UpdateSesionBHabilidades`,
`ReplaceSubprincipioLinks`/`ReplaceSubSubPrincipioLinks`).

Kept: `Id`, `MesocicloId`, `Order`, `WeekLabel`, `StartDate`, `EndDate`.

A Microciclo no longer hard-codes "exactly two sessions (A/B)" — it now optionally has **any
number** of linked `TrainingSession` rows (0, 1, 2, or more), each fully self-describing
(own `Name`, `ObjetivoGeneral`, `Blocks`). This is the direct enabler of req #3 ("el plan
pasa a asociar sesiones") and removes the previous duplication where the same
subprincipio/habilidad/zone data had to be entered once on the Microciclo (for planning) and
conceptually again wherever the actual exercises lived.

`Mesociclo.GameZoneId` (one zone for the whole Mesociclo) is **kept unchanged** — it's a
separate, still-used field, not part of what's being removed.

### 2. Migration plan (EF Core, `AppDbContext`)

Sequence of migrations (run via `.\manage-migrations.ps1 -Action create -MigrationName <Name>`
from `Back/ExtractionApi`, `-Context AppDbContext`):

1. **`DeleteDevelopmentExercisesAndSessions`** — data-only migration. `Up()` issues raw SQL
   `DELETE FROM "TasksTraining"; DELETE FROM "ExerciseConditions"; DELETE FROM
   "ExerciseModelLinks"; DELETE FROM "TaskTrainingBases";` (children before parents, respecting
   existing FKs) against the **development** database only — this migration is a one-way data
   wipe per req #5, not reversible in `Down()` (leave `Down()` empty with a comment
   explaining why, same as any other irreversible data migration). Do **not** touch
   `SessionTrainings` rows themselves (existing sessions, even though about to be
   restructured, are not explicitly required to be wiped — but since every session's `Tasks`
   just got deleted, and the shape changes in the next migrations anyway, see the task list
   in `tasks.md` for the explicit decision point the implementer must confirm with the user
   before running this against any non-empty dev DB).
2. **`RestructureExerciseSchema`** — schema migration: drop `Section`, `Methodology`→rename
   column to `Tipo` (or drop+recreate — either is fine since data is empty),
   `PlayersNumber`/`GoalPeekersNumber`/`FieldSpace`/`Series`/`DurationSeries`/`RestSeries`/
   `TouchesNumber`/`WildCards`/`Points`/`MicrocicloId` columns; drop `TaskTrainingTypes`,
   `ExerciseTypes`, `ExerciseConditions`, `ExerciseModelLinks`,
   `TaskTrainingBases_Materials`(or equivalent M:N table) tables; add `Objetivo`,
   `ObjetivoPorRol`, `Logistica`, `DurationMinutes`, `Porteros`, `Dibujo`, `Descripcion`
   (renamed from `Description`), `NivelesColumnas` (jsonb), `Niveles` (jsonb) columns; create
   `ExerciseModelRelations` and `ExerciseModelRelationItems` tables.
3. **`RestructureSessionSchema`** — drop `TasksTraining` table; create `SessionBlocks` and
   `SessionBlockExercises` tables; add `TrainingSessions.MicrocicloId` (nullable FK, `SetNull`
   on delete), `ObjetivoGeneral`, `MapaCampoTexto` columns.
4. **`SimplifyMicrociclo`** — drop `Microciclos.ObjetivoSesionA`/`ObjetivoSesionB`/
   `GameZoneIdSesionA`/`GameZoneIdSesionB`/`SesionAHabilidades`/`SesionBHabilidades` columns;
   drop `MicrocicloSubprincipioLinks`/`MicrocicloSubSubPrincipioLinks` tables.

Splitting into four migrations (rather than one mega-migration) keeps each one reviewable and
independently revertible up to the point of the irreversible data wipe in step 1 — follow
`.claude/rules/dotnet.md` §13.3 naming convention (`{Name}` descriptive PascalCase).

`AppDbContextModelSnapshot.cs` regenerates automatically when the migrations are added; no
manual edits.

### 3. Seed: rebuild the example plan from `Ejemplo-Sesion.md`

New `ExampleSessionSeeder` (`Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Seed/ExampleSessionSeeder.cs`),
following the same shape as `GameModelSeeder`/`SeasonPlanImporter`: a static
`SeedAsync(AppDbContext db, string teamId, string seasonId, CancellationToken ct)`, invoked
explicitly (not on every app startup — same rationale as `GameModelSeeder`'s doc-comment: a
one-off operator/tooling action, re-runnable and idempotent by upserting on a stable key,
e.g. `(TeamId, MicrocicloId, Session.Name)` for the session and `(ClubId, Name)` for each
exercise).

It hardcodes, from `docs/game-model/Ejemplo-Sesion.md`:
- One `Microciclo` ("Sesión 1 — Defensa organizada 1.1...") under a Mesociclo/Macrociclo —
  reuse whatever `SeasonPlan` the target team/season already has (create the
  Macrociclo/Mesociclo/Microciclo row if missing, matching `SeasonPlanImporter`'s upsert-by-
  `Order` approach).
- One `TrainingSession` linked to that Microciclo (`MicrocicloId` set), with
  `ObjetivoGeneral` copied from "Objetivo general de la sesión" and `MapaCampoTexto` from the
  "(dibujo de referencia: ejercicio1_mapa_campo.png...)" line.
- Four `SessionBlock`s (Calentamiento / Ejercicio principal 1 / Ejercicio principal 2 /
  Vuelta a la calma) with their `ComoConectaConAnterior`/`RotacionEntreEjercicios` text
  copied verbatim.
- Five `TaskTrainingBase` exercises (Rondo con porterías centrales; Defensa organizada,
  bloque medio; Circuito físico preseason; Transición defensa-ataque: balón atrás y
  presión/repliegue; Reto de toques y cierre), each with its `Niveles`/`NivelesColumnas`,
  `ModelRelations` (resolved against the team's already-imported `GameModel` ADN hierarchy
  via `Subprincipio`/`SubSubPrincipio` `Numero` lookup — same resolution style
  `SeasonPlanImporter` already uses for its Subprincipio/SubSubPrincipio links), `Logistica`,
  `Porteros`, `Descripcion` transcribed from the markdown.
- `SessionBlockExercise` rows wiring exercises 2 and 3 (bloque medio + circuito físico) as
  parallel entries (`Position` 1 and 2) inside Bloque 2, matching the "rotación cada 6 min"
  narrative.

Given the volume of prose, the implementer transcribes the markdown content directly into
the seeder's hardcoded C# data (same style as `SeasonPlanImporter`'s big doc-commented
literal blocks) — this design doc fixes the *shape*, not the exact transcribed strings.

### 4. Feature modules (endpoints)

All under `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/`. One file per feature,
`IFeatureModule` + `ICommand`/`IQueryApp` + handler + `AbstractValidator` in the same file,
per repo convention.

#### Trainings/Exercises

| File | Route | Change |
|---|---|---|
| `CreateExercise.cs` | `POST /api/trainings/exercises` | Rewritten request: `ClubId, Name, Tipo, Objetivo, ObjetivoPorRol?, Logistica, DurationMinutes?, Porteros?, Dibujo?, Descripcion, NivelesColumnas, Niveles, ModelRelations: List<ExerciseModelRelationRequest>`. `ExerciseModelRelationRequest(SubprincipioId, IsFoco, HabilidadesImprescindibles, Items: List<ExerciseModelRelationItemRequest>)`, `ExerciseModelRelationItemRequest(SubSubPrincipioId, IsFoco)`. Drops `Types`, `PlayersNumber`, `GoalPeekersNumber`, `FieldSpace`, `Series`, `DurationSeries`, `RestSeries`, `TouchesNumber`, `WildCards`, `Section`, `Methodology`, `MicrocicloId`. |
| `UpdateExercise.cs` | `PUT /api/trainings/exercises/{id}` | Mirrors `CreateExercise`'s new shape. |
| `GetExercises.cs` | `GET /api/trainings/exercises?clubId=` | Drops `methodology`/`microcicloId` query params (both gone). `ExerciseListItem` gains `bool IsAssociatedToGameModel` (`ModelRelations.Count > 0`) — req #4. |
| `GetExerciseById.cs` | `GET /api/trainings/exercises/{id}` | Full detail incl. `Niveles`, `ModelRelations` (with resolved Subprincipio/SubSubPrincipio display fields, same `ExerciseModelLinkResolver`-style batch resolution, renamed `ExerciseModelRelationResolver`). |
| `DeleteExercise.cs` | `DELETE /api/trainings/exercises/{id}` | Add guard: if referenced by any `SessionBlockExercise`, throw `DomainException` with new `ErrorCodes.ExerciseInUseBySession` (409-mapped, matching existing `ProblemDetails` conventions) instead of deleting. |
| `ExerciseConditionsCrud.cs` | — | **Deleted** (entity removed). |
| `UploadExerciseMedia.cs` | `POST /api/trainings/exercises/{id}/media` | Unchanged — still targets `UrlImage`. |

#### Trainings/Sessions

| File | Route | Change |
|---|---|---|
| `CreateSession.cs` | `POST /api/trainings/sessions` | Rewritten request: `TeamId, Name, Description?, Date, StartTime, EndTime?, Location?, SportEventId?, MicrocicloId?, ObjetivoGeneral?, MapaCampoTexto?, Blocks: List<SessionBlockRequest>`. `SessionBlockRequest(Order, Nombre, ComoConectaConAnterior, RotacionEntreEjercicios?, Exercises: List<SessionBlockExerciseRequest>)`, `SessionBlockExerciseRequest(ExerciseId, Position)`. If `MicrocicloId` is set, handler validates it belongs to a `SeasonPlan` for the same `TeamId` (join `Microciclo → Mesociclo → Macrociclo → SeasonPlan.TeamId`) — new `ErrorCodes.MicrocicloTeamMismatch`. |
| `UpdateSession.cs` | `PUT /api/trainings/sessions/{id}` | Mirrors `CreateSession`'s new shape; replacing `Blocks` wholesale (clear+rebuild), same "trust server-derived state" approach already used by `TaskTrainingBase.ReplaceModelLinks`/`Microciclo.ReplaceSubprincipioLinks`. |
| `GetSessions.cs` | `GET /api/trainings/sessions?teamId=` | `SessionListItem` gains `bool IsAssociatedToPlan` (`MicrocicloId != null`), `string? MicrocicloId`, `string? MicrocicloWeekLabel` (denormalized for a breadcrumb), and `ExerciseCount` now counts distinct `TaskTrainingBaseId`s across all blocks (was `Tasks.Count`) — req #4. |
| `GetSession.cs` | `GET /api/trainings/sessions/{id}` | Full detail: `Blocks` ordered, each with its `Exercises` ordered by `Position`, each exercise as a summary DTO (`Id, Name, Tipo, Objetivo, DurationMinutes, UrlImage`) — full exercise detail is a separate `GetExerciseById` call, avoiding duplicating the whole `Niveles`/`ModelRelations` payload per block. |
| `DeleteSession.cs` | `DELETE /api/trainings/sessions/{id}` | Unchanged mechanically; cascade removes `SessionBlocks`/`SessionBlockExercises` only, never `TaskTrainingBase` rows (per §1.4 FK behavior). |

#### SeasonPlans

| File | Change |
|---|---|
| `GetSeasonPlan.cs` | `MicrocicloResponse` drops `ObjetivoSesionA/B`, `SesionA/BSubprincipios`, `SesionA/BSubSubPrincipios`, `SesionA/BHabilidades`, `ExerciseCount`; gains `IEnumerable<SessionSummary> Sessions` where `SessionSummary(Id, Name, ObjetivoGeneral, Date, ExerciseCount)` — sourced from `_db.TrainingSessions.Where(s => s.MicrocicloId == microcicloId)`. |
| `CreateSeasonPlan.cs` | `MicrocicloRequest` drops `ObjetivoSesionA/B`, `SesionA/BSubprincipioIds`, `SesionA/BSubSubPrincipioIds`, `SesionA/BHabilidades` — becomes just `(Order, WeekLabel, StartDate, EndDate)`. `CreateSeasonPlanHandler.BuildMicrociclo`/`ApplySesionAdnLinks` simplified accordingly (the latter is deleted entirely). |
| `UpdateSeasonPlan.cs` | Same simplification, mirrored — inspect this file during implementation (not read in this pass) but it follows the same `MicrocicloRequest` shape as `CreateSeasonPlan`, so the diff is symmetric. |
| `DeleteSeasonPlan.cs` | Unaffected — no read of the removed fields. |

New shared error codes to add to `Domain/ErrorCodes.cs`:
```csharp
// Exercises
public const string ExerciseInUseBySession = "ExerciseInUseBySession";
// Training Sessions
public const string MicrocicloTeamMismatch = "MicrocicloTeamMismatch";
public const string MicrocicloNotFound = "MicrocicloNotFound";
```

### 5. Frontend coordination notes

- `DurationMinutes` on `TaskTrainingBase` is an addition beyond the reduced template (kept
  optional) specifically so the frontend can sum it for "Duración total" on the session view
  without parsing free-text `Logistica` — flag this so the exercise form can surface it as an
  optional "minutos" input rather than requiring the coach to always fill it.
- `IsAssociatedToGameModel` (exercises) and `IsAssociatedToPlan`/`MicrocicloId` (sessions) are
  the fields backing req #4's list-distinction UI.
- `SessionBlockExercise.Position` is the only signal for "en paralelo" — two exercises share
  a block, and the frontend renders them side by side; there's no separate "lane" concept on
  the backend.
- Exercise `Dibujo`/Session `MapaCampoTexto` are plain text placeholders; actual images still
  go through the existing `UrlImage` + upload-media flow (`UploadExerciseMedia.cs` for
  exercises; sessions would need an equivalent upload endpoint if the frontend wants image
  upload for "Mapa de campo general" — **not included in this design**, only the text
  placeholder field; flag if the frontend needs it, it's a small additive feature to append
  later, not a blocker for this change).

## Frontend

Scope: `Front/src/apps/coach/`. Covers types, services, the rebuilt exercise form, the new
session-with-blocks form, list-view distinction chips, and the "Planificación" tab reorder.
All new/changed UI stays inside the existing `pages/trainings/` tree - no new top-level route
outside `/coach/trainings/*`. Follows `.claude/rules/react.md` and
`.claude/rules/frontend-architecture.md` throughout: CSS Modules co-located, no `styled()`/
inline styles, `*Service.ts` for all API calls, no barrel `index.ts`, `React.lazy()` pages,
Coach dark/orange theme only (no Federation changes).

### 1. Types - `Front/src/apps/coach/types/training.ts` (full rewrite)

Drop entirely: `ExerciseType`, `ExerciseSection`, `ExerciseCondition`, `ExerciseModelLink`,
`ExerciseModelLinkRequest`, `SessionExerciseEntry`, `SessionExerciseItem`. Rename
`ExerciseMethodology` to `ExerciseTipo = "Analitico" | "Situacional" | "Global"`.

```ts
export interface ExerciseLevelRow {
  nivel: number;
  valores: Record<string, string>;   // key = palanca column name, value = free text
}

export interface ExerciseModelRelationItem {
  id: string;                        // read-side only; requests omit it
  subSubPrincipioId: string;
  subSubPrincipioNumero?: string;    // denormalized, read-side only
  subSubPrincipioRol?: string;       // denormalized, read-side only
  isFoco: boolean;
}
export type ExerciseModelRelationItemRequest = Pick<ExerciseModelRelationItem, "subSubPrincipioId" | "isFoco">;

export interface ExerciseModelRelation {
  id: string;                        // read-side only; requests omit it
  subprincipioId: string;
  subprincipioNumero?: string;       // denormalized, read-side only
  subprincipioTitulo?: string;       // denormalized, read-side only
  isFoco: boolean;
  habilidadesImprescindibles: string[];   // closed vocabulary - HABILIDAD_VOCABULARY
  items: ExerciseModelRelationItem[];
}
export interface ExerciseModelRelationRequest {
  subprincipioId: string;
  isFoco: boolean;
  habilidadesImprescindibles: string[];
  items: ExerciseModelRelationItemRequest[];
}

export interface Exercise {
  id: string;
  name: string;                      // "Titulo"
  tipo: ExerciseTipo;
  objetivo: string;
  objetivoPorRol?: string | null;
  modelRelations: ExerciseModelRelation[];
  nivelesColumnas: string[];
  niveles: ExerciseLevelRow[];
  logistica: string;
  durationMinutes?: number | null;
  porteros?: string | null;
  dibujo?: string | null;
  descripcion: string;
  urlImage?: string | null;
  boardStateJson?: string | null;
  /** True when `modelRelations.length > 0` - backing req #4's list badge (also sent
   * directly by GetExercises/GetExerciseById so the list doesn't need to recompute it). */
  isAssociatedToGameModel: boolean;
}

export type CreateExerciseRequest = Omit<Exercise, "id" | "isAssociatedToGameModel" | "modelRelations"> & {
  clubId: string;
  modelRelations: ExerciseModelRelationRequest[];
};
export type UpdateExerciseRequest = Omit<CreateExerciseRequest, "clubId">;

export interface SessionBlockExercise {
  id: string;                        // read-side only
  exerciseId: string;
  position: number;
  // Summary fields for read-side rendering (GetSession's per-block exercise summary DTO):
  exerciseName?: string;
  exerciseTipo?: ExerciseTipo;
  exerciseObjetivo?: string;
  exerciseDurationMinutes?: number | null;
  exerciseUrlImage?: string | null;
}
export type SessionBlockExerciseRequest = Pick<SessionBlockExercise, "exerciseId" | "position">;

export interface SessionBlock {
  id: string;                        // read-side only
  order: number;
  nombre: string;
  comoConectaConAnterior: string;
  rotacionEntreEjercicios?: string | null;
  exercises: SessionBlockExercise[];
}
export type SessionBlockRequest = Omit<SessionBlock, "id" | "exercises"> & {
  exercises: SessionBlockExerciseRequest[];
};

export interface TrainingSession {
  id: string;
  name: string;
  description: string;
  date: string;
  startTime: string;
  endTime?: string | null;
  location?: string | null;
  sportEventId?: string | null;
  sportEventName?: string | null;
  microcicloId?: string | null;
  microcicloWeekLabel?: string | null;
  /** True when `microcicloId != null` - req #4's list badge. */
  isAssociatedToPlan: boolean;
  exerciseCount: number;
}

export interface TrainingSessionDetail extends Omit<TrainingSession, "exerciseCount"> {
  objetivoGeneral?: string | null;
  mapaCampoTexto?: string | null;
  urlImage?: string | null;
  blocks: SessionBlock[];
}

export interface CreateSessionRequest {
  teamId: string;
  name: string;
  description: string;
  date: string;
  startTime: string;
  endTime?: string | null;
  location?: string | null;
  sportEventId?: string | null;
  microcicloId?: string | null;
  objetivoGeneral?: string | null;
  mapaCampoTexto?: string | null;
  blocks: SessionBlockRequest[];
}
export type UpdateSessionRequest = Omit<CreateSessionRequest, "teamId">;
```

`ExerciseTipo`'s three values map 1:1 to the backend `Tipo` enum wire values
(`Analitico|Situacional|Global`) - no frontend-only relabeling needed beyond the display
label map in `exerciseTypeLabels.ts` (renamed content, same file).

### 2. `types/seasonPlan.ts` - drop Sesion A/B, add `sessions`

`Microciclo` loses `objetivoSesionA/B`, `exerciseCount`, `sesionA/BSubprincipioIds`,
`sesionA/BSubSubPrincipioIds`, `sesionA/BHabilidades`, `sesionA/BSubprincipios`,
`sesionA/BSubSubPrincipios`. Gains:

```ts
export interface SessionSummary {
  id: string;
  name: string;
  objetivoGeneral?: string | null;
  date: string;
  exerciseCount: number;
}
// on Microciclo:
sessions: SessionSummary[];
```

`AdnSubprincipioSummary`/`AdnSubSubPrincipioSummary`/`AdnOptions`/`AdnSubprincipioOption`/
`AdnSubSubPrincipioOption` (including the existing `subprincipioId` narrowing field on the
SubSubPrincipio option) are **kept unchanged** - they're reused as-is by the rebuilt
`ModelRelationSection` (SS5) and the session's Microciclo picker.

### 3. Services

**`trainingService.ts`** (full method rewrite, same file/shape):
- `getExercises(clubId, opts?: { tipo?, teamId? })` - drop `methodology`/`microcicloId`
  params (both gone backend-side).
- `createExercise`/`updateExercise`/`getExerciseById`/`deleteExercise` - payload/response per
  SS1's types. `deleteExercise` now can reject with a 409 `ProblemDetails` whose `code` is
  `ExerciseInUseBySession` - callers (Trainings.tsx's delete-confirm dialog) surface that as
  a specific error message ("No se puede eliminar: esta en uso en una sesion") instead of the
  generic failure text, mirroring how `isNotFound` is already special-cased in
  `seasonPlanService.ts`.
- Drop `createCondition`/`updateCondition`/`deleteCondition` entirely (`ExerciseConditionsCrud`
  is deleted backend-side).
- `getSessions(teamId)` -> `TrainingSession[]` per SS1 (now carries `isAssociatedToPlan`,
  `microcicloId`, `microcicloWeekLabel`).
- `getSessionById(id)` -> `TrainingSessionDetail` (same method name, new shape - `Blocks`
  nested, ordered).
- `createSession`/`updateSession` - payload per SS1's `CreateSessionRequest`/
  `UpdateSessionRequest` (`Blocks` sent as a whole, clear+rebuild, mirroring the backend's
  "trust server-derived state" approach - no incremental block diffing on the frontend).

**`seasonPlanService.ts`**: `mapMicrociclo`/`mapMicrocicloCreateRequest`/
`mapMicrocicloUpdateRequest` drop every `sesionA/B*` field; `mapMicrociclo` gains
`sessions: (m.sessions ?? []).map(mapSessionSummary)` reading the new `Sessions` array from
`GetSeasonPlan`. `getAdnOptions` delegation to `gameModelService` is unchanged.

### 4. Exercise form - widened panel, new fields (`pages/trainings/new/`)

**Panel width**: `NewExercisePage.module.css`'s `.formPanel` grows from
`width: min(430px, 38vw)` to `width: min(720px, 55vw)` (and the `@media (max-width: 980px)`
override's `min(460px, 86vw)` -> `min(680px, 92vw)`), and `.panelBody` switches from a single
stacked column to a responsive two-column grid (`display: grid; grid-template-columns: 1fr 1fr;
gap: 12px 16px;` with `grid-column: 1 / -1` on full-width rows: name, objetivo, niveles table,
model-relation section, descripcion) - this is the concrete fix for "formulario muy estrecho".
Below `768px` (already-established breakpoint pattern in this file), collapse to one column.

**`useExerciseForm.ts`** - rewritten `CreateExerciseRequest`-shaped state
(`emptyExercise` in `pages/trainings/new/constants.ts` updated to match); drop
`isPhysical`/`isTechTac` derived flags and all condition handlers (`handleAddCondition` etc.)
and their `conditions`/`conditionInput`/`editingCondition`/`savingCondition` state; drop the
`microcicloId` param/prefill entirely (exercises no longer link to a Microciclo - only
sessions do, per design.md SS1.4/SS1.1 in the Backend section above). Validation in
`handleSave` mirrors the backend invariants client-side (name, tipo, objetivo required;
`niveles.length` between 2 and 5 with no gaps before submit - reuses a small pure helper, see
SS4.1) so the coach gets an inline error instead of a 400 round-trip for the common cases.

**`ExerciseFormPanel.tsx`** - rebuilt field set, same component, in this order: Nombre
(Titulo), Tipo (`Select`, 3 values), Objetivo (multiline), Objetivo por rol (multiline,
optional - labelled "opcional"), `ModelRelationSection` (SS5), `NivelesEditor` (SS4.1),
Logistica (multiline free text, replaces the Jugadores/Porteros/Espacio/Series/etc. numeric
fields), Duracion (min) (`type="number"`, optional - the backend design's SS5 escape hatch),
Porteros (single-line, optional), Dibujo (single-line/placeholder text, optional),
Descripcion (multiline, `minRows={4}`, replaces the old short "Descripcion" + Condiciones
section - condition bullets fold into this prose per the template, so the whole Condiciones
UI block is deleted), then the existing Imagen/Video upload section (unchanged - still
targets `UrlImage` via `uploadExerciseMedia`).

**`NewExercisePage.tsx`** - remove the `microcicloContext` banner effect and its
`SessionAdnContext`/`microcicloId` query-param reads entirely (dead once exercises can't link
to a Microciclo); the top bar (Cancelar/Guardar) and tactical board workspace stay unchanged.

#### 4.1 `NivelesEditor.tsx` - new component

New file `pages/trainings/new/components/NivelesEditor.tsx` +
`NivelesEditor.module.css`. Props:

```ts
interface NivelesEditorProps {
  columnas: string[];
  niveles: ExerciseLevelRow[];
  onChange: (columnas: string[], niveles: ExerciseLevelRow[]) => void;
}
```

Renders an editable table: header row is `columnas` (each an inline-editable `TextField`
with a delete icon; "+ columna" button appends `"Palanca N"` placeholder text the coach
renames); body rows are `niveles` sorted by `nivel`, each a `TextField` per column bound to
`row.valores[columna]`, plus a delete-row icon; "+ nivel" button appends a row with the next
sequential `nivel` number, disabled once `niveles.length === 5`; the delete-row button is
disabled once `niveles.length === 2` (enforces the 2-5 backend invariant client-side, mirrors
the Backend section's SS1.3 rule). Deleting a column strips that key from every row's
`valores` (no orphan cells, matching the backend invariant). A pure helper
`renumberNiveles(rows: ExerciseLevelRow[]): ExerciseLevelRow[]` (co-located in the same file,
exported for the unit test) keeps `nivel` 1..N contiguous after any row add/remove, since the
UI never lets the coach reorder or gap numbers - this is what feeds the client-side
validation in SS4's `useExerciseForm`.

### 5. `ModelRelationSection.tsx` - rewritten for the grouped Subprincipio/Items shape

Same file path, new internal shape (was a flat list of "Subprincipio OR SubSubPrincipio"
rows with exercise-level Habilidades; becomes a list of `ExerciseModelRelationRequest`, each
owning its own Habilidades and a nested repeatable Items list):

```ts
interface ModelRelationSectionProps {
  modelRelations: ExerciseModelRelationRequest[];
  onChange: (relations: ExerciseModelRelationRequest[]) => void;
  teamId?: string;
}
```

Per relation card: Subprincipio `Autocomplete` (required - `adnOptions.subprincipios`, same
`useAdnOptions(teamId)` hook, kept as-is), FOCO/INTEGRADO `ToggleButtonGroup` (relation-level,
same visual pattern as today), Habilidades `Autocomplete` multi (`HABILIDAD_VOCABULARY`,
**moved here from the old exercise-level field** - this is the one behavioral difference from
today's UI beyond the nesting), then a nested "Items" list: each item is a SubSubPrincipio
`Autocomplete` **narrowed to `adnOptions.subSubPrincipios.filter(s => s.subprincipioId ===
relation.subprincipioId)`** (using the field that already exists on `AdnSubSubPrincipioOption`
but was unused by the old flat picker) + its own FOCO/INTEGRADO toggle + a delete-item icon;
"+ accion (X.Y.Z)" button adds an item, disabled until a Subprincipio is chosen for that
relation. "+ Anadir vinculo" (top-level, unchanged label) appends a new empty relation
(`subprincipioId: ""`, forcing the coach to pick one before it's valid - empty
`subprincipioId` blocks save, mirrored in `useExerciseForm`'s validation per SS4). The
"no hasGameModel" hint link to `/coach/game-model` is unchanged.

### 6. Session form - new page replacing the dialog (`pages/trainings/new-session/`)

`SessionDialog.tsx`/`SessionDialog.module.css` (`pages/trainings/components/`) are **deleted**
- a modal dialog can't reasonably host N blocks x M parallel exercises with per-block prose
fields. New full-page editor mirrors `NewExercisePage.tsx`'s pattern:

- `pages/trainings/new-session/NewSessionPage.tsx` + `.module.css` - top bar
  (Cancelar/Guardar), then a scrollable form body (no tactical-pitch workspace this time -
  session doesn't need one): Nombre, Ubicacion en el plan (an optional Microciclo picker,
  inlined directly in this page - the old `useMicrocicloOptions` hook from
  `ExerciseFormPanel.tsx` is deleted there since exercises no longer link to a Microciclo, and
  its flattened-list logic is recreated as a small inline hook here since this is now its only
  consumer), Fecha/Inicio/Fin/Lugar/Evento deportivo (same fields as today's `SessionDialog`),
  Objetivo general (multiline, optional), Mapa de campo (Mapa de campo texto - single/
  multiline text placeholder, optional, mirrors Exercise's Dibujo field), then the Bloques
  editor (SS6.1).
- `pages/trainings/new-session/hooks/useSessionForm.ts` - `CreateSessionRequest`-shaped
  state; `handleSave` posts via `trainingService.createSession`/`updateSession`; `handleCancel`
  navigates back to `returnTo` (same `NavState`/`location.state.returnTo` convention as
  `NewExercisePage`).
- Route `trainings/new-session` added to `routes.tsx` (lazy), guarded by the same
  `COACH_FEATURE_ROUTES.Trainings` permission as `new-exercise`.

#### 6.1 `SessionBlockEditor.tsx` - blocks with parallel exercises

New file `pages/trainings/new-session/components/SessionBlockEditor.tsx` +
`.module.css`. Renders `blocks: SessionBlockRequest[]` as a vertical stack of block cards, in
`order`; each card: Nombre (text), Como conecta con el anterior (multiline, required - even
block 1 needs a sentence per the template's "primer bloque de la sesion..." convention, so
this field is never hidden/defaulted), Rotacion entre ejercicios (multiline, optional, only
rendered once the block has >=2 exercises), then an **exercise picker row** per exercise slot
(the block's `exercises: SessionBlockExerciseRequest[]` ordered by `position`) with two ways
to add one:
  - **Existing exercise**: `Autocomplete<ExerciseOption>` sourced from
    `trainingService.getExercises(clubId)` (same list already used by the old
    `SessionDialog`), appends `{ exerciseId, position: nextPosition }`.
  - **Create inline**: a "+ Crear ejercicio nuevo" button that navigates to
    `/coach/trainings/new-exercise` with `state: { returnTo: "/coach/trainings/new-session" }`
    plus a `sessionDraftKey` query param; before navigating, the current in-progress session
    draft (`CreateSessionRequest` state) is written to
    `sessionStorage.setItem(sessionDraftKey, JSON.stringify(draft))` together with which block
    index requested the new exercise (`pendingBlockIndex`). On mount, `NewSessionPage`
    checks for a `sessionDraftKey` param; if present, it restores the draft from
    `sessionStorage` instead of starting empty, and if the page was reached via
    `NewExercisePage`'s own "Guardar" (which, when it detects it was opened with a
    `sessionDraftKey` state, passes the newly created exercise id back via
    `navigate(returnTo, { state: { returnTo, createdExerciseId } })`), the restored draft's
    `pendingBlockIndex` block gets that exercise id appended automatically. This is the same
    "round-trip via sessionStorage + navigation state" shape already established by
    `NewExercisePage`'s `returnTo`/`NavState` convention - no new state-management library
    introduced (per `.claude/rules/react.md` SS9 prohibition on new state stores). Block
    add/remove/reorder ("+ Anadir bloque" at the bottom, delete icon per block, `Order`
    renumbered on delete - same "no gaps" pattern as `NivelesEditor`'s row numbering) rounds
    out the component.

Two exercises sharing a block's `exercises` list (`position` 1 and 2, etc.) render **side by
side** (CSS grid, two columns above a `700px` breakpoint, stacked below) as the visual
representation of "en paralelo" - per the backend note in its SS5, `Position` is the only
signal for that, so the frontend's job is purely presentational here.

### 7. List views - plan/model-association badges (req #5)

**`ExerciseCromo.tsx`** (`pages/trainings/components/`): the old `Section`/`Methodology`
badges are removed (`Section` no longer exists; `Methodology` is renamed `Tipo` - the badge
stays, relabeled from `METHODOLOGY_LABELS` to `TIPO_LABELS` in `exerciseTypeLabels.ts`, same
3-badge-color CSS pattern, new value `Situacional` replacing `Integrado`). New: an
"Asociado al modelo" `Chip` (only rendered when `exercise.isAssociatedToGameModel`, using the
same `styles.modelLinkChipFoco`-style accent already defined in `ExerciseCromo.module.css`)
next to the Tipo badge. The `modelChipsRow` (per-relation subprincipio/habilidad chips) keeps
rendering from `exercise.modelRelations`, flattening `relation.items` for the SubSubPrincipio
chips (was flat `modelLinks`, now nested - a small `.flatMap` at render time, no new
component). Stats row drops `playersNumber`/`goalPeekersNumber` (both gone) and gains
`durationMinutes` (nullable - render only when set, since it's optional per the backend
design's SS5 notes).

**Sessions tab in `Trainings.tsx`**: each session row gains, next to the existing
`exerciseCount` chip, a conditional chip: `session.isAssociatedToPlan` -> a chip labelled
`session.microcicloWeekLabel` (plan-linked, styled like the existing `sspChip`), else a
neutral "Independiente" chip - this is the visual distinction req #5 asks for on the Sesiones
list. `ExerciseCromo`'s "Asociado al modelo"/no-chip pair is the equivalent distinction for
Ejercicios.

### 8. "Planificacion" becomes the first tab (req #4)

`Trainings.tsx`: the `<Tabs>` order changes from `Ejercicios(0) / Sesiones(1) /
Planificacion(2)` to **`Planificacion(0) / Ejercicios(1) / Sesiones(2)`**. Every
index-based conditional in the file that currently reads `tab === 2` for the plan
(`useEffect` loading `seasonPlan`/`zones`/`adnOptions`, the action-bar `tab === 2` block) moves
to `tab === 0`; the old `tab === 0` (Ejercicios action bar/content) and `tab === 1` (Sesiones)
blocks shift to `tab === 1` and `tab === 2` respectively. `useState(0)` default is unchanged
(0 now correctly means "Planificacion" on first load, which is the desired new default landing
tab - no extra code needed for that part). `SeasonPlanView.tsx`'s `onCreateExercise` prop is
renamed `onCreateSession: (microcicloId: string) => void`, wired to
`navigate("/coach/trainings/new-session?...&microcicloId=...")` (mirrors the existing
`goToExercisePage` pattern already used for exercises).

**`SeasonPlanView.tsx`**: `SessionBlock`/`SessionAdnChips` components (the old Sesion A/B
objective+chips rendering) are deleted; `MicrocicloRow` instead lists
`microciclo.sessions: SessionSummary[]` - each rendered as a small row (name, date,
`ExerciseCount` chip, objetivoGeneral truncated) with a click-through to
`/coach/trainings/new-session?...&sessionId=...` for editing; "Crear sesion" button (renamed
from "Crear ejercicio") shown once per Microciclo card, calling the new `onCreateSession`
prop. The "Sin ejercicios"/"N ejercicios" coverage chip becomes "Sin sesiones"/"N sesiones"
based on `microciclo.sessions.length`.

**`SeasonPlanEditor.tsx`**: `EMPTY_MICROCICLO` and the Microciclo row editor drop every
`sesionA/B*` field/picker (`SessionAdnPickersProps` and its rendering block are deleted
entirely) - the Microciclo editor becomes just `Order`/`WeekLabel`/`StartDate`/`EndDate`,
matching the simplified `MicrocicloRequest` from the Backend section's SS4. `Mesociclo`'s
`GameZoneId` picker is unchanged (that field survives, per Backend SS1.5).

### 9. Test coverage plan (Vitest + Testing Library, per `.claude/rules/frontend-testing.md`)

- `NivelesEditor.test.tsx` - add/remove column (orphan-cell stripping), add/remove row
  (2-5 clamp, renumbering), controlled value round-trip.
- `ModelRelationSection.test.tsx` (rewrite existing) - relation requires Subprincipio before
  an item can be added; FOCO/INTEGRADO toggle at both relation and item level; Habilidades
  now scoped per relation, not global.
- `useExerciseForm.test.ts` (rewrite existing) - new field set default state, save validation
  (niveles 2-5, required Objetivo/Tipo/relation Subprincipio), no more
  condition/microciclo handlers exist.
- `ExerciseFormPanel.test.tsx` (rewrite existing) - renders all new fields; Condiciones
  section is gone.
- `useSessionForm.test.ts` (new) - save validation (Nombre/Fecha required, block's
  `ComoConectaConAnterior` required even for the first block), MicrocicloId optional.
- `SessionBlockEditor.test.tsx` (new) - add/remove block (order renumbering), add exercise
  from existing list, "crear ejercicio nuevo" writes the sessionStorage draft and navigates
  with the right `state`/query param, two exercises in one block render side by side.
- `ExerciseCromo.test.tsx` (extend existing) - `isAssociatedToGameModel` chip presence/absence,
  new Tipo badge labels, no more Section strip.
- `SeasonPlanView.test.tsx` (rewrite existing) - renders `sessions` per Microciclo instead of
  Sesion A/B; "Crear sesion" wiring; coverage chip text.
- `seasonPlanService.test.ts` (extend existing) - mapper drops sesionA/B fields, maps
  `sessions`.

Verify with `npm run test` after each file, `npm run build` after the full set (TypeScript
strict will surface any leftover reference to a deleted type/field immediately).
