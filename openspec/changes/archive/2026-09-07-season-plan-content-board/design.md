## Context

Three aggregates are involved, all under `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/`:

- **`GameModels/GameModel.cs`** — the ADN tree, read-only for this change:
  `GameModel → GamePrinciple (per GameMoment/Fase) → Subprincipio → Zona? → SubSubPrincipio →
  Habilidad`. `SubSubPrincipio.cs` enforces "exactly one of `SubprincipioId`/`ZonaId`" (never
  both), so "all Sub-subprincipios of a Subprincipio" always means
  `Subprincipio.SubSubPrincipios ∪ Subprincipio.Zonas.SelectMany(z => z.SubSubPrincipios)`.
  `Features/Coaches/GameModels/Queries/GetGameModel.cs` already returns this full tree
  (`GameModelResponse`) — the frontend's left panel is this same payload, so no new "get the ADN
  tree" endpoint is needed.
- **`Training/TrainingSession.cs`** — currently `Date: DateTime` (non-nullable),
  `StartTime: TimeSpan` (non-nullable), an optional `MicrocicloId` FK
  (`Features/Coaches/Trainings/Sessions/CreateSession.cs` lines 92-93,
  `EnsureMicrocicloBelongsToTeam` validates the Microciclo belongs to the session's team via
  `Microciclo → Mesociclo → Macrociclo → SeasonPlan.TeamId`), and `List<SessionBlock> Blocks`.
  There is precedent for making a session-shaped date/time column nullable:
  `20260829164526_MakeEventDateTimeAndStartTimeNullable` did exactly this for
  `SportEvent.StartTime`/`EveDateTime`.
- **`SeasonPlans/Microciclo.cs`** — `SubprincipiosObjetivo: List<MicrocicloSubprincipioObjetivo>`,
  built only via `ReplaceSubprincipiosObjetivo(IEnumerable<string> subprincipioIds)`. The
  frontend's `subprincipioObjetivoIds` field
  (`Front/src/apps/coach/pages/trainings/season-plan/SeasonPlanEditor.tsx` lines 42, 64-91,
  143-148) maps 1:1 onto this backend join list — it is **not** a frontend-only field, it is a
  real persisted table (`MicrocicloSubprincipioObjetivosConfiguration`, table
  `MicrocicloSubprincipiosObjetivo`, cascade-deletes on both `MicrocicloId` and `SubprincipioId`
  FKs). This change retires both the column-backed list and the picker.

The closest existing precedent for "a join row that repeats freely, cascades when its ADN target
disappears" is `ExerciseModelRelationItem` (`Domain/Aggregates/Training/TasksTraining/
ExerciseModelRelationItem.cs` + `ExerciseModelRelationItemConfiguration.cs`): a plain `BaseEntity`
join row, `HasOne<SubSubPrincipio>().WithMany().OnDelete(DeleteBehavior.Cascade)`, indexed on the
owning-side FK, no unique constraint — this change's new join entity follows that shape exactly,
just hanging off `TrainingSession` instead of `ExerciseModelRelation`.

## Goals / Non-Goals

**Goals:**
- A session can exist with no date/time ("unscheduled") and carry a list of target
  Sub-subprincipio ids, added/removed freely, repeats allowed across sessions.
- A single query (`GetAdnCoverage`) gives the frontend everything it needs to render per-node
  coverage/usage on the ADN tree without re-fetching or recomputing session-by-session.
- Assigning a date to a session automatically resolves its `MicrocicloId` by date-range
  containment — the coach never picks a Microciclo by hand for this flow (manual
  `MicrocicloId` selection via `EnsureMicrocicloBelongsToTeam` still exists for
  `CreateSession`/`UpdateSession` direct callers, e.g. if the frontend later wants to let a
  coach override it, but the content-board's own flow does not surface that control).
- `Microciclo`'s weekly objective becomes purely computed from `TrainingSession` rows dated
  inside its range — no independent input, no independent storage.
- Existing session create/edit with a fixed date keeps working unchanged (nullable fields are
  additive, not breaking for the already-common non-null case).

**Non-Goals:**
- Any change to `SessionBlock`/`SessionBlockExercise` (the exercise-planning part of a session)
  — targets are a session-level list, independent of blocks/exercises.
- Any change to `ExerciseModelRelation`/`ExerciseModelRelationItem` (an exercise's own ADN
  links) — a session-level target is a distinct concept from an exercise-level FOCO/INTEGRADO
  relation, not unified with it here.
- Frontend component structure/props in detail — the frontend section below is a shape/contract
  brief for `front-specialist` to detail further, not a finished component spec.
- Historical backfill of `MicrocicloSubprincipioObjetivo` data into session targets — dropped
  data is accepted (see Risks).

## Decisions

### 1. `TrainingSession.Date`/`StartTime` become nullable; `EndTime` stays nullable (already is)

```csharp
public DateTime? Date { get; set; }
public TimeSpan? StartTime { get; set; }
```

Same technique as `MakeEventDateTimeAndStartTimeNullable` for `SportEvent`: `AlterColumn`,
`nullable: true`, no default value needed going forward (existing rows already have real
dates). `SessionTrainingEntityConfiguration.cs` drops `.IsRequired()` on both `Date`/
`StartTime` properties (lines 22-27).

`CreateSessionCommand`/`UpdateSessionCommand`/`CreateSessionBody`/`UpdateSessionBody` and the
Minimal-API request records change `DateTime Date, TimeSpan StartTime` to
`DateTime? Date, TimeSpan? StartTime`. `SessionListItem`/`SessionDetail` follow suit.

Alternative considered: keep `Date`/`StartTime` non-nullable and use an `IsScheduled` bool +
sentinel dates. Rejected — the codebase already has the nullable-date precedent for exactly
this "not yet known" case (`SportEvent`), and a sentinel invites bugs (a `DateTime.MinValue`
session that silently sorts first everywhere `OrderBy(s => s.Date)` is used, e.g.
`GetSessions.cs` line 80).

### 2. New join entity `TrainingSessionSubSubPrincipio`, following the `ExerciseModelRelationItem` shape

```csharp
namespace RFFM.Api.Domain.Aggregates.Training
{
    /// <summary>One Sub-subprincipio targeted by a TrainingSession — repetition across
    /// sessions is explicitly allowed (progression/repetition), no unique constraint. Built
    /// only via TrainingSession.ReplaceTargets. Same cascade-on-ADN-deletion convention as
    /// ExerciseModelRelationItem.</summary>
    public class TrainingSessionSubSubPrincipio : BaseEntity
    {
        public string TrainingSessionId { get; private set; } = null!;
        public string SubSubPrincipioId { get; private set; } = null!;

        private TrainingSessionSubSubPrincipio() { }

        public TrainingSessionSubSubPrincipio(string trainingSessionId, string subSubPrincipioId)
        {
            if (string.IsNullOrWhiteSpace(trainingSessionId))
                throw new ArgumentException("TrainingSessionId cannot be empty.", nameof(trainingSessionId));
            if (string.IsNullOrWhiteSpace(subSubPrincipioId))
                throw new ArgumentException("SubSubPrincipioId cannot be empty.", nameof(subSubPrincipioId));
            TrainingSessionId = trainingSessionId;
            SubSubPrincipioId = subSubPrincipioId;
        }
    }
}
```

`TrainingSession` gains `List<TrainingSessionSubSubPrincipio> Targets { get; set; } = new();`
and a `ReplaceTargets(IEnumerable<string> subSubPrincipioIds)` method (clears + rebuilds,
"trust server-derived state", same as `SessionBlock.ReplaceExercises`/
`ExerciseModelRelation.ReplaceItems`) — no dedup needed at this level since repeats *within*
one session's target list are meaningless (a `HashSet`/`Distinct()` inside `ReplaceTargets` is
still applied defensively, mirroring `Microciclo.ReplaceSubprincipiosObjetivo`'s
`.Distinct()`).

EF config `TrainingSessionSubSubPrincipioConfiguration` (new file, same directory as
`SessionTrainingEntityConfiguration.cs`):
```csharp
builder.ToTable("TrainingSessionSubSubPrincipios");
builder.HasKey(x => x.Id);
builder.HasOne<TrainingSession>().WithMany(s => s.Targets)
    .HasForeignKey(x => x.TrainingSessionId).OnDelete(DeleteBehavior.Cascade);
builder.HasOne<SubSubPrincipio>().WithMany()
    .HasForeignKey(x => x.SubSubPrincipioId).OnDelete(DeleteBehavior.Cascade);
builder.HasIndex(x => x.TrainingSessionId);
builder.HasIndex(x => x.SubSubPrincipioId);
```

Alternative considered: reuse `MicrocicloSubprincipioObjetivo`'s table, repointed at
Sub-subprincipio and session instead of Subprincipio and Microciclo. Rejected — that table's
name/shape is Microciclo-specific and is being retired (Decision 4); a fresh table keyed on
`TrainingSessionId` is clearer than repurposing a differently-named table for a different
parent.

### 3. `CreateSession`/`UpdateSession` accept `List<string> TargetSubSubPrincipioIds`

```csharp
public record CreateSessionCommand(
    string TeamId, string Name, string? Description,
    DateTime? Date, TimeSpan? StartTime, TimeSpan? EndTime,
    string? Location, string? SportEventId, string? MicrocicloId,
    string? ObjetivoGeneral, string? MapaCampoTexto,
    List<SessionBlockRequest> Blocks,
    List<string> TargetSubSubPrincipioIds
) : IRequest<string>, IRequireFeaturePermission { ... }
```

Same field on `UpdateSessionBody`/`UpdateSessionCommand`. Handlers validate every id exists and
belongs to the team's active `GameModel` (mirrors `EnsureMicrocicloBelongsToTeam`'s
team-ownership check — a coach must not be able to target another team's ADN node):

```csharp
internal static async Task EnsureTargetsBelongToTeam(AppDbContext db, IEnumerable<string> ids, string teamId, CancellationToken ct)
{
    var validIds = await db.SubSubPrincipios
        .Where(ssp => ids.Contains(ssp.Id))
        .Where(ssp =>
            (ssp.SubprincipioId != null && db.Subprincipios.Any(sp => sp.Id == ssp.SubprincipioId
                && db.GamePrinciples.Any(p => p.Id == sp.GamePrincipleId
                    && db.GameModels.Any(gm => gm.Id == p.GameModelId && gm.TeamId == teamId))))
            || (ssp.ZonaId != null /* same chain via Zona.SubprincipioId */))
        .Select(ssp => ssp.Id)
        .ToListAsync(ct);
    if (validIds.Count != ids.Distinct().Count())
        throw new DomainException("Sesiones", "Uno o más objetivos no pertenecen al modelo de juego de este equipo.", ErrorCodes.TargetNotFound);
}
```
(exact navigation chain to be confirmed against `GamePrinciple`/`Zona` FKs at implementation
time — `GamePrinciple.GameModelId` and `Zona.SubprincipioId` are assumed present per
`GetGameModel.cs`'s include chain; task 2.3 below covers writing this precisely.)

`SessionDetail`/`SessionListItem`/`GetSession`/`GetSessions` gain
`IEnumerable<SessionTargetDetail> Targets` where
```csharp
public record SessionTargetDetail(
    string SubSubPrincipioId, string Rol, string Numero,
    string SubprincipioId, string SubprincipioTitulo,
    string? ZonaId, string? ZonaLabel,
    string PrincipioId, string PrincipioTitulo,
    int GameMomentId, string GameMomentName);
```
— the full breadcrumb inline, so the frontend never needs a second lookup against
`GetGameModel` to render a target chip's "Fase › Principio › Subprincipio › Zona › Rol" text.

### 3.1 `Blocks` `NotEmpty` becomes conditional on `Date != null` (content-first sessions)

Resolved (was an Open Question): a session with no date ("unscheduled", content-first) must be
creatable/saveable with only `TargetSubSubPrincipioIds` — no blocks/exercises required. The
`Blocks` `NotEmpty` rule keeps applying, but only once the session actually has a `Date`
(i.e. it is being scheduled/put on the calendar), since a scheduled session is expected to be
calendar-ready.

`CreateSessionValidator` (`Features/Coaches/Trainings/Sessions/CreateSession.cs`) and
`UpdateSessionValidator` (`Features/Coaches/Trainings/Sessions/UpdateSession.cs`) both change
from:

```csharp
RuleFor(x => x.Blocks).NotEmpty()
    .WithMessage("Una sesión debe tener al menos un bloque.");
```

to a `When`-scoped rule:

```csharp
When(x => x.Date is not null, () =>
{
    RuleFor(x => x.Blocks).NotEmpty()
        .WithMessage("Una sesión debe tener al menos un bloque.");
});
```

(FluentValidation v12's `When(predicate, action)` overload — no new package/behavior needed.)
`RuleForEach(x => x.Blocks).SetValidator(new SessionBlockRequestValidator())` stays
unconditional and outside the `When` block: if blocks *are* present (scheduled or not), each
one is still validated the same way — the `When` only gates the "must have at least one"
requirement, not per-block shape validation. No rule is added requiring
`TargetSubSubPrincipioIds` to be non-empty for an unscheduled session — a coach may save an
empty-content unscheduled session as a placeholder (e.g. "Tuesday's session" created before
deciding its focus), consistent with "planificar contenido antes que fechas" not forcing any
particular field to be filled first.

Alternative considered: require *either* `Blocks` non-empty *or* `TargetSubSubPrincipioIds`
non-empty regardless of `Date` (i.e., a session must always have *some* content). Rejected —
this reintroduces exactly the friction the content-board flow is designed to remove (a coach
should be able to create a bare unscheduled session immediately and drag targets onto it over
time, potentially starting from zero); gating strictly on `Date` is simpler to reason about and
matches the design's core framing that a session becomes "must be complete" only when it's
being scheduled.

### 4. Retire `Microciclo.SubprincipiosObjetivo`/`MicrocicloSubprincipioObjetivo`; weekly objective becomes a query projection

`Microciclo.SubprincipiosObjetivo`, `ReplaceSubprincipiosObjetivo`, the
`MicrocicloSubprincipioObjetivo` entity, its EF config, and the
`MicrocicloSubprincipiosObjetivo` table are all removed (migration drops the table). The
existing `Features/Coaches/SeasonPlans/{Commands,Queries}` for Microciclo/Mesociclo/Macrociclo
no longer accept or return `subprincipioObjetivoIds` as input; `GetSeasonPlan.cs`'s Microciclo
projection instead computes the weekly objective inline:

```csharp
// per Microciclo, sessions dated inside [StartDate, EndDate], union their Targets
var objetivo = await _db.TrainingSessions
    .Where(s => s.TeamId == teamId && s.Date != null
        && s.Date.Value >= microciclo.StartDate.ToDateTime(TimeOnly.MinValue)
        && s.Date.Value <= microciclo.EndDate.ToDateTime(TimeOnly.MaxValue))
    .SelectMany(s => s.Targets)
    .Select(t => t.SubSubPrincipioId)
    .Distinct()
    .ToListAsync(ct);
```
returned as `IEnumerable<SessionTargetDetail>` (Decision 3's shape) grouped by Subprincipio, so
`SeasonPlanEditor.tsx`'s read-only view can render "Subprincipio X.Y — 3 de 3 sub-subprincipios
trabajados" directly. Note this makes the weekly objective derive from *dated* sessions only
(an unscheduled session with targets does not attach to any specific week — by design, it isn't
scheduled yet) — distinct from `GetAdnCoverage`'s notion of "covered", which counts scheduled
*and* unscheduled sessions (Decision 5).

Alternative considered: keep the join table and have the coach's board write to it directly
(effectively duplicating the session-target list into the Microciclo). Rejected per the
proposal's explicit acceptance criterion 9 — the weekly objective must be *derived*, not a
second independently-editable copy that can drift from what the sessions actually contain.

### 5. `GetAdnCoverage(teamId, season)` — one query for coverage + usage badges

New file `Features/Coaches/GameModels/Queries/GetAdnCoverage.cs`, `IQueryApp`-style read (no
mutation), `GET /api/game-models/adn-coverage?teamId=&season=`:

```csharp
public record AdnCoverageResponse(
    IEnumerable<SubSubPrincipioCoverage> SubSubPrincipios,
    IEnumerable<SubprincipioCoverage> Subprincipios,
    IEnumerable<PrincipioCoverage> Principios);

public record SubSubPrincipioCoverage(
    string SubSubPrincipioId, bool IsUsed, IEnumerable<SessionUsage> Sessions);

public record SessionUsage(string SessionId, string SessionName, DateTime? Date);

public record SubprincipioCoverage(string SubprincipioId, bool IsCovered);
public record PrincipioCoverage(string PrincipioId, bool IsCovered);
```

Handler: load the team's `GameModel` (same shape as `GetGameModel.cs`'s include chain, but only
the id columns needed for grouping — `AsNoTracking`, no `Habilidades`/`Notas` includes since
this query never renders them), load every `TrainingSession` for the team joined to
`Targets` (`Include(s => s.Targets)`), then in memory:
- `SubSubPrincipioCoverage.IsUsed = Sessions.Any()`.
- `SubprincipioCoverage.IsCovered = <all Sub-subprincipios (direct + via Zonas) IsUsed>`.
- `PrincipioCoverage.IsCovered = <all Subprincipios IsCovered>`.

This mirrors the "compute in C# after one shaped EF query" style `GetGameModel.cs` already uses
(local `MapSsp`/`MapZona`/`MapSubprincipio`/`MapPrincipio` functions) rather than a raw SQL
aggregate — consistent with the rest of the GameModels feature, and the per-team dataset size
(one GameModel's ADN tree, one team's sessions) is small enough that in-memory grouping is not a
performance concern.

Alternative considered: fold coverage into `GetGameModel`'s existing response instead of a new
endpoint. Rejected — `GetGameModel` is cached (`ICacheRequest`, per team+season, unrelated to
any specific session state) while coverage must reflect live session data; conflating them
would either break the cache or force `GetGameModel` to skip caching entirely. A separate,
uncached (or short-TTL) query keeps the ADN-tree cache intact.

### 6. Automatic Microciclo resolution on session date assignment

`CreateSessionHandler`/`UpdateSessionHandler`: when `request.Date is not null` **and**
`request.MicrocicloId is null` (coach didn't explicitly pick one), resolve it server-side:

```csharp
if (request.Date is not null && request.MicrocicloId is null)
{
    var dateOnly = DateOnly.FromDateTime(request.Date.Value);
    session.MicrocicloId = await _db.Microciclos
        .Where(m => m.StartDate <= dateOnly && m.EndDate >= dateOnly)
        .Join(_db.Mesociclos, m => m.MesocicloId, mes => mes.Id, (m, mes) => new { m, mes })
        .Join(_db.Macrociclos, x => x.mes.MacrocicloId, mac => mac.Id, (x, mac) => new { x.m, mac })
        .Join(_db.SeasonPlans, x => x.mac.SeasonPlanId, sp => sp.Id, (x, sp) => new { x.m, sp })
        .Where(x => x.sp.TeamId == request.TeamId)
        .Select(x => x.m.Id)
        .FirstOrDefaultAsync(ct);
}
```
No match (no SeasonPlan covers that date, or no plan exists yet) leaves `MicrocicloId` null —
same as today's "session with no plan association", not an error; scheduling a session must
never be blocked by planning being incomplete. An explicit `request.MicrocicloId` (a coach
overriding it, or the existing direct-session-creation flow) is still honored as-is and still
goes through `EnsureMicrocicloBelongsToTeam`.

Alternative considered: resolve the Microciclo purely client-side (frontend already has the
Microciclo date ranges loaded via `GetSeasonPlan`) and send it as `MicrocicloId`. Rejected —
the backend already validates `MicrocicloId` membership on write, so it must know how to
resolve it anyway for the "coach didn't pick one" case (e.g. any caller of the API, not just
this one screen); keeping resolution server-side is a single source of truth and avoids the
frontend duplicating date-range-containment logic that already exists as a join in
`EnsureMicrocicloBelongsToTeam`.

## Frontend contract (for front-specialist — shape only, not component design)

- **Left panel data source**: existing `GET /api/game-models?teamId=&season=`
  (`GameModelResponse`), unchanged — reuse verbatim, no new tree endpoint. Overlay per-node
  coverage/usage from the new `GET /api/game-models/adn-coverage?teamId=&season=`
  (`AdnCoverageResponse`, Decision 5) by joining on `SubSubPrincipioId`/`SubprincipioId`/
  `PrincipioId`.
- **Board data source**: `GET /api/trainings/sessions?teamId=` (`SessionListItem`, extended
  with `Targets: SessionTargetDetail[]` and nullable `Date`/`StartTime` per Decision 3/1) —
  unscheduled sessions are simply the subset with `Date === null`; no separate endpoint for
  "the board" vs. "the session list" elsewhere in the app.
- **Drag-drop write path**: adding/removing a target from a session is a full
  `PUT /api/trainings/sessions/{id}` with the session's complete `TargetSubSubPrincipioIds`
  (same "replace wholesale" contract `Blocks` already uses) — no separate
  add-one-target/remove-one-target endpoint. Creating a brand-new unscheduled session is
  `POST /api/trainings/sessions` with `Date: null, StartTime: null` and whatever
  `Blocks`/`TargetSubSubPrincipioIds` the coach has assembled so far. Per Decision 3.1 below,
  an unscheduled session (`Date == null`) may be created/saved with only
  `TargetSubSubPrincipioIds` — no placeholder block required; `Blocks` `NotEmpty` only applies
  once the session is given a `Date`.
- **Component reuse**: `Front/src/apps/coach/pages/game-model/components/GameModelTree.tsx`'s
  existing Fase/Principio/Subprincipio/Zona/SubSubPrincipio rendering hierarchy is the base for
  the left panel (extended with drag handles + coverage/usage badges, not rebuilt). Drag-and-drop
  reuses `@dnd-kit/core`'s `DndContext`/`useDraggable`/`useDroppable` +
  `@dnd-kit/utilities`'s `CSS` helper exactly as already used in
  `Front/src/apps/coach/pages/squad/components/IdealLineup.tsx` — no new DnD library.
  `SeasonPlanEditor.tsx` drops `MicrocicloSubprincipioObjetivoPicker` (lines 64-91, 143-148) and
  its `subprincipioObjetivoIds` field entirely, replacing that block with a read-only rendering
  of the new weekly-objective projection (Decision 4).
- **New page location**: a new route/page under
  `Front/src/apps/coach/pages/trainings/season-plan/` (sibling to `SeasonPlanEditor.tsx`/
  `SeasonPlanView.tsx`), left as a naming/routing decision for `front-specialist`.

## Frontend design (detailed — supersedes "Frontend contract" section's routing/component placeholders)

This section details component structure, state, drag-and-drop mechanics, and routing for
`Front/`. It builds on, and does not contradict, the "Frontend contract" section above (API
shapes, reuse of `GameModelTree.tsx`/`@dnd-kit`, replace-wholesale PUT contract).

### F1. New route, entered from the existing Planificación tab

New page `Front/src/apps/coach/pages/trainings/season-plan/ContentBoardPage.tsx` (+
`ContentBoardPage.module.css`), registered as a **new top-level route**
`trainings/content-board` in `Front/src/apps/coach/routes.tsx` (sibling to the existing
`trainings/new-session` route, same guard):

```tsx
const ContentBoardPage = lazy(() => import("./pages/trainings/season-plan/ContentBoardPage"));
...
<Route
  path="trainings/content-board"
  element={
    <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.Trainings}>
      <ContentBoardPage />
    </RequireFeaturePermission>
  }
/>
```

**Why a route, not a fourth `Tabs` entry inside `Trainings.tsx`** (`Trainings.tsx` lines 389-397
currently has `Planificación`/`Ejercicios`/`Sesiones`): the two-panel drag-and-drop board needs
full viewport height/width to be usable (a tree panel + a session board, both internally
scrollable) — MUI `Tabs`' content area in `Trainings.tsx` is nested inside `ContentLayout`
alongside the page header/toolbar `Stack`, which would squeeze the board and doesn't have a
matching internal layout for a second scroll region. `Trainings.tsx` already carries four
concerns (exercise catalog, session list, season-plan tree, delete-plan dialog); adding a
five-hundred-line drag-and-drop board as a fifth inline tab would break "single responsibility
per page" (`.claude/rules/react.md` §3.3). A dedicated route keeps `Trainings.tsx` unchanged
except for one new entry point button.

Entry point: in `Trainings.tsx`'s Planificación tab toolbar (lines 360-384, the `Stack` that
already renders "Nueva planificación"/"Editar planificación"/"Eliminar planificación"), add one
more `Button`:

```tsx
<Button
  size="small"
  startIcon={<AddIcon />}
  variant="outlined"
  onClick={() => navigate(`/coach/trainings/content-board?clubId=${clubId}&teamId=${teamId}`)}
  disabled={!teamId}
>
  Planificar contenido
</Button>
```
mirroring the existing `goToSessionPage`-style query-string construction already used elsewhere
in this file for `new-session` navigation.

### F2. Component tree (co-located under the season-plan page, not `shared/`)

Per `.claude/rules/react.md` §3.2 ("específico de una página → junto a la página"), everything
here is specific to the content-board screen and lives under
`Front/src/apps/coach/pages/trainings/season-plan/`, alongside the existing
`SeasonPlanEditor.tsx`/`SeasonPlanView.tsx`:

```
pages/trainings/season-plan/
  ContentBoardPage.tsx              — route target: data loading via hooks, DndContext, 2-panel layout
  ContentBoardPage.module.css
  components/
    AdnDraggableTree.tsx            — left panel: Fase→Principio→Subprincipio→Zona?→SubSubPrincipio,
                                       draggable Subprincipio/SubSubPrincipio nodes, coverage checks,
                                       usage badges
    AdnDraggableTree.module.css
    SessionBoardPanel.tsx           — right panel: "+ Nueva sesión" + list of SessionCard
    SessionBoardPanel.module.css
    SessionCard.tsx                 — one droppable card: name, target chips, "Asignar fecha", delete
    SessionCard.module.css
    TargetChip.tsx                  — one removable breadcrumb chip (wraps MUI Chip)
    TargetChip.module.css
    UsageBadge.tsx                  — small count badge + Tooltip listing session usages
    UsageBadge.module.css
  hooks/
    useContentBoardData.ts          — loads GameModel + AdnCoverage + Sessions, exposes refetch
    useSessionDrop.ts               — drag payload → optimistic target add/remove + PUT, with rollback
  __tests__/
    ContentBoardPage.test.tsx
    AdnDraggableTree.dragdrop.test.tsx
    AdnDraggableTree.coverage.test.tsx
    SessionBoardPanel.test.tsx
    SessionCard.test.tsx
    useSessionDrop.test.ts
```

`GameModelTree.tsx` itself (`pages/game-model/components/GameModelTree.tsx`) is **not modified** —
it stays the read-only tree used by the Game Model page and its print view. `AdnDraggableTree.tsx`
is a sibling component that mirrors its rendering hierarchy (same `sortByNumero`/`zonaHeading`
helpers, imported from `../../game-model/components/gameModelOrder` where they're already a
standalone module, or duplicated if entangled — confirm at implementation time) but adds drag
handles + coverage/usage overlays that `GameModelTree.tsx`'s existing consumers don't need. This
avoids a `print`/`draggable` prop-branching mess inside one component that serves two
unrelated call sites.

### F3. Data loading — `useContentBoardData`

```ts
function useContentBoardData(teamId: string, season: string) {
  // parallel-loads:
  //   gameModelService.getByTeamIdAndSeason(teamId, season)   → GameModel | null
  //   gameModelService.getAdnCoverage(teamId, season)          → AdnCoverage (new method, F6)
  //   trainingService.getSessions(teamId)                      → TrainingSession[] (now carries
  //                                                               `targets`/nullable `date`)
  // exposes { gameModel, coverage, sessions, loading, error, refetchSessions, refetchCoverage }
}
```

- The right panel renders `sessions.filter(s => s.date === null)` — per the Frontend contract's
  "Board data source" bullet, unscheduled sessions are simply the subset with `date === null`;
  no separate endpoint.
- Coverage is joined into the tree by building three lookup maps once per fetch:
  `Map<subSubPrincipioId, SubSubPrincipioCoverage>`, `Map<subprincipioId, boolean>`,
  `Map<principioId, boolean>`, memoized with `useMemo` keyed on `coverage`.
- `refetchSessions`/`refetchCoverage` are called after any successful target write (F5) so a
  target added from one session's drop also updates that Sub-subprincipio's usage badge
  elsewhere in the tree without a full page reload — but see F5 for why the *sessions* list
  itself is updated optimistically first, then reconciled, while *coverage* is simply refetched
  (coverage is a cheap read with no optimistic-update value — the badge count changing a beat
  after the chip appears is an acceptable, standard "eventually consistent secondary
  indicator" trade-off, unlike the target chip itself which must feel instant).

### F4. Drag-and-drop mechanics (`@dnd-kit/core`, `IdealLineup.tsx`'s exact pattern)

One `<DndContext>` wraps the whole `ContentBoardPage` body (both panels), same sensors as
`IdealLineup.tsx` (`squad/components/IdealLineup.tsx` lines 264-268):

```tsx
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
);
```

**Draggable ids and payload** — `AdnDraggableTree.tsx` calls `useDraggable` on every
Subprincipio heading and every SubSubPrincipio leaf:

```ts
useDraggable({
  id: `subprincipio:${sp.apiId}`,
  data: { kind: "subprincipio", targets: flattenSubprincipioTargets(sp, breadcrumbCtx) },
});
useDraggable({
  id: `subsubprincipio:${ssp.apiId}`,
  data: { kind: "subsubprincipio", targets: [toTargetDetail(ssp, breadcrumbCtx)] },
});
```

`data` is `@dnd-kit`'s built-in per-draggable metadata bag, read back via
`active.data.current` in `onDragEnd` — this is how the drop handler learns *what* was dragged
without re-deriving it from the id string. `targets: SessionTargetDetail[]` (F7's shape) is
built **client-side, at drag time**, from the `GameModel` tree data `AdnDraggableTree` is
already rendering (it has the full Fase/Principio/Subprincipio/Zona/Rol context in scope while
walking the tree) — this is what makes optimistic rendering possible without a second lookup.

`flattenSubprincipioTargets(sp, ctx)` — a small pure helper (unit-testable in isolation,
`AdnDraggableTree.dragdrop.test.tsx`) implementing exactly the proposal's "dragging a
Subprincipio adds all its Sub-subprincipios (via its Zonas if it has them, or direct)" rule:

```ts
function flattenSubprincipioTargets(sp: Subprincipio, ctx: BreadcrumbCtx): SessionTargetDetail[] {
  const ssps = sp.zonas.length > 0 ? sp.zonas.flatMap((z) => z.subSubPrincipios.map((ssp) => ({ ssp, zona: z }))) 
                                    : sp.subSubPrincipios.map((ssp) => ({ ssp, zona: null }));
  return ssps.map(({ ssp, zona }) => toTargetDetail(ssp, { ...ctx, sp, zona }));
}
```
Note this mirrors, but is distinct from, `gameModelService.ts`'s private
`flattenGameModelToAdnOptions` (lines 223-250 of that file) — that helper produces a flat
*option-list* shape (`AdnSubSubPrincipioOption`, no Fase/Zona breadcrumb, used by pickers) while
this one produces the full-breadcrumb `SessionTargetDetail` shape the board's chips need to
render without a second lookup. They are not unified because their output shapes and call
sites are unrelated (one feeds `Autocomplete` options elsewhere, one feeds drop payloads here).

**Droppable ids** — each `SessionCard` calls `useDroppable({ id: `session-drop-${session.id}` })`,
same string-prefix convention as `IdealLineup.tsx`'s `field-slot-${index}` ids.

**Handlers on `ContentBoardPage`**:

```ts
function handleDragStart({ active }: DragStartEvent) {
  setActivePayload(active.data.current as DragPayload);
}

function handleDragEnd({ over }: DragEndEvent) {
  setActivePayload(null);
  const overId = over?.id?.toString() ?? null;
  if (!overId?.startsWith("session-drop-")) return; // dropped outside — no-op, nothing to undo
  const sessionId = overId.replace("session-drop-", "");
  if (activePayload) sessionDrop.addTargets(sessionId, activePayload.targets);
}
```
(`activePayload` captured in `handleDragStart` rather than re-read in `handleDragEnd`, since
`onDragEnd`'s own `active.data.current` is equally available there too — either read point
works with `@dnd-kit`; using the `handleDragStart`-captured value only matters for feeding
`DragOverlay`, which needs it live during the drag, not just at drop time.)

**`DragOverlay`** renders a compact preview: the breadcrumb text of a single target, or
`"${targets.length} sub-subprincipios de ${sp.numero}"` when dragging a whole Subprincipio —
same role as `IdealLineup.tsx`'s `OverlayItem`.

### F5. `useSessionDrop` — optimistic write with rollback, not wait-then-render

```ts
function useSessionDrop(sessions: TrainingSession[], setSessions: Updater, refetchCoverage: () => void) {
  async function addTargets(sessionId: string, incoming: SessionTargetDetail[]) {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const before = session.targets;
    const merged = dedupeById([...before, ...incoming]); // within-session dedup only
    setSessions(replaceTargets(sessionId, merged));       // optimistic render — chips appear instantly

    try {
      await trainingService.updateSession(sessionId, {
        ...toUpdateRequest(session),
        targetSubSubPrincipioIds: merged.map((t) => t.subSubPrincipioId),
      });
      refetchCoverage();
    } catch {
      setSessions(replaceTargets(sessionId, before));     // rollback
      window.dispatchEvent(new CustomEvent("rffm.show_snackbar", {
        detail: { message: "Error al asignar el objetivo a la sesión", severity: "error" },
      }));
    }
  }

  async function removeTarget(sessionId: string, subSubPrincipioId: string) { /* same shape, minus one id */ }

  return { addTargets, removeTarget };
}
```

This is the same optimistic-then-rollback shape as `IdealLineup.tsx`'s `handleSave` catch block
(lines 403-409) reused for a per-drop granularity instead of one page-level save button — the
"instant" requirement here (a coach dragging repeatedly should see immediate feedback, not wait
on a network round-trip per drop) justifies optimistic updates where `IdealLineup`'s single
explicit "Guardar" button did not need them.

**Open item for the FE/BE handshake** (flag for back-specialist coordination, not blocking this
document): whether `PUT /api/trainings/sessions/{id}` returns the updated `SessionDetail` body
(so the optimistic client-built `SessionTargetDetail` list can be replaced with the
server-confirmed one) or `204 No Content` (current `trainingService.updateSession(): Promise<void>`
signature implies the latter). If it stays `204`, `addTargets`/`removeTarget` keep the
client-built optimistic list as final (acceptable — the client already has every field
`SessionTargetDetail` needs from the `GameModel` tree, so there's nothing the server response
would correct in practice) rather than issuing a follow-up `getSessionById` fetch per drop.

**Creating a new unscheduled session** (`SessionBoardPanel`'s "+ Nueva sesión" button): calls
`trainingService.createSession({ teamId, name: "Nueva sesión", description: "", date: null,
startTime: null, endTime: null, location: null, sportEventId: null, microcicloId: null,
objetivoGeneral: null, mapaCampoTexto: null, blocks: [], targetSubSubPrincipioIds: [] })`
directly (no dialog/form — a bare placeholder session the coach immediately sees on the board
and either renames inline or drags targets onto), then appends the created session (with the id
from the response) to local state. Deleting one calls `trainingService.deleteSession(id)` with
a confirm step (reuse the same `Dialog`/`DialogActions` confirm pattern already in
`Trainings.tsx` for "Eliminar planificación", not a new confirm component).

**Renaming a session inline**: `SessionCard`'s name renders as an editable `TextField` (blur or
Enter commits) that calls `updateSession` with just the changed `name`, same wholesale-PUT
shape carrying the session's current `targetSubSubPrincipioIds` unchanged.

### F6. Service additions

`gameModelService.ts` gains one method (new file section, same style as `getByTeamIdAndSeason`):

```ts
async getAdnCoverage(teamId: string, season: string): Promise<AdnCoverage> {
  const res = await client.get<ApiAdnCoverage>("/api/game-models/adn-coverage", { params: { teamId, season } });
  return mapApiToAdnCoverage(res.data); // camelCase pass-through mapper, same style as mapApiToGameModel
}
```

`trainingService.ts`'s existing `getSessions`/`getSessionById`/`createSession`/`updateSession`
need no new methods — only their request/response **types** change (F7), since the write
contract stays "replace-wholesale PUT" per the Frontend contract section.

### F7. Type changes

`types/training.ts`:
```ts
export interface SessionTargetDetail {
  subSubPrincipioId: string;
  rol: string;
  numero: string;
  subprincipioId: string;
  subprincipioTitulo: string;
  zonaId?: string | null;
  zonaLabel?: string | null;
  principioId: string;
  principioTitulo: string;
  gameMomentId: number;
  gameMomentName: string;
}
```
`TrainingSession`/`TrainingSessionDetail`: `date: string | null`, `startTime: string | null`
(both were non-nullable `string`), add `targets: SessionTargetDetail[]`.
`CreateSessionRequest`/`UpdateSessionRequest`: `date: string | null`, `startTime: string | null`,
add `targetSubSubPrincipioIds: string[]`.

New file `types/adnCoverage.ts` (a new concern, not folded into `types/seasonPlan.ts`'s existing
`AdnOptions` — coverage is a read-only usage/coverage report, not a picker-options list):
```ts
export interface SessionUsage { sessionId: string; sessionName: string; date: string | null; }
export interface SubSubPrincipioCoverage { subSubPrincipioId: string; isUsed: boolean; sessions: SessionUsage[]; }
export interface SubprincipioCoverage { subprincipioId: string; isCovered: boolean; }
export interface PrincipioCoverage { principioId: string; isCovered: boolean; }
export interface AdnCoverage {
  subSubPrincipios: SubSubPrincipioCoverage[];
  subprincipios: SubprincipioCoverage[];
  principios: PrincipioCoverage[];
}
```

`types/seasonPlan.ts`'s `Microciclo`: remove `subprincipiosObjetivo: AdnSubprincipioSummary[]`
and `subprincipioObjetivoIds: string[]` (both retired per Decision 4/backend task 7), replace
with a single read-only field:
```ts
export interface WeeklyObjectiveSubprincipio {
  subprincipioId: string;
  numero: string;
  titulo: string;
  gameMomentName: string;
  subSubPrincipios: { id: string; numero: string; rol: string }[];
}
export interface Microciclo {
  ...
  /** Read-only, derived server-side from dated sessions' targets (Decision 4). No write side. */
  weeklyObjective: WeeklyObjectiveSubprincipio[];
}
```
(exact shape to be reconciled against `GetSeasonPlan`'s actual response once backend task 7.1
lands — flagged as an open item, same as design.md's existing Open Questions entry.)

### F8. `SeasonPlanEditor.tsx` changes

Remove entirely: the `MicrocicloSubprincipioObjetivoPicker` function (lines 64-94), the
`subprincipioObjetivoIds: []` field from `EMPTY_MICROCICLO` (line 42), and the
`<MicrocicloSubprincipioObjetivoPicker .../>` usage + its "no game model" hint block (lines
134-148) from `MicrocicloEditor`. The `adnOptions`/`hasGameModel` props threaded through
`SeasonPlanEditor` → `MacrocicloEditor` → `MesocicloEditor` → `MicrocicloEditor` (props on all
four component interfaces) exist *only* to feed that picker — grep confirms no other use inside
this file — so `adnOptions` is dropped from all four `Props` interfaces and their call sites,
and from `Trainings.tsx`'s `<SeasonPlanEditor adnOptions={adnOptions} .../>` call (verify at
implementation time whether `Trainings.tsx`'s own `adnOptions` state/load is still needed for
anything else in that file before deleting the load itself, not just the prop).

The read-only weekly-objective view does **not** move into `SeasonPlanEditor.tsx` — since it's
no longer editable, it has no place in an edit form at all. It already has a home:
`SeasonPlanView.tsx`'s `MicrocicloRow` (lines 80-91) already renders
`microciclo.subprincipiosObjetivo` as a chip row in the read-only tree view; that block is
updated in place to read `microciclo.weeklyObjective` instead (F7's new shape), same `Chip`
rendering, label `` `${numero} · ${titulo} (${subSubPrincipios.length})` ``.

### F9. `NewSessionPage.tsx` / `useSessionForm.ts` changes (assign-date flow)

`SessionCard`'s "Asignar fecha" button navigates to the existing edit-session-by-id flow
unchanged in shape:
```ts
navigate(`/coach/trainings/new-session?clubId=${clubId}&teamId=${teamId}&sessionId=${session.id}`,
  { state: { returnTo: `/coach/trainings/content-board?clubId=${clubId}&teamId=${teamId}` } });
```
No new route/prop on `NewSessionPage.tsx` itself — `sessionId` query param + `returnTo` state
already exist and already trigger `trainingService.getSessionById` + `sessionForm.loadSession`
(`NewSessionPage.tsx` lines 121-131). Two changes inside `useSessionForm.ts` make this actually
preserve targets and honor the relaxed validation:

1. `emptySession()` (lines 13-28) and `loadSession()` (lines 39-61) both gain
   `targetSubSubPrincipioIds`/`targets` passthrough so a session's existing drag-and-drop
   targets survive being loaded into, and saved from, this form (`loadSession` maps
   `session.targets.map(t => t.subSubPrincipioId)` into `form.targetSubSubPrincipioIds`, exactly
   as it already does for `blocks`).
2. `validate()` (lines 65-75): remove `if (!form.date) return "La fecha es obligatoria.";`
   (date is optional now — this form must also be usable to save a still-unscheduled session,
   not just to assign one); change the unconditional blocks-required check to mirror backend
   Decision 3.1 exactly:
   ```ts
   if (form.date && form.blocks.length === 0) return "Una sesión debe tener al menos un bloque.";
   ```
   The two per-block rules below it (`comoConectaConAnterior`, `exercises.length === 0`) stay
   unconditional — same "if blocks exist, validate their shape regardless of date" split as the
   backend validator.

`NewSessionPage.tsx` itself needs no new fields in its JSX for targets — the content board is
the only place targets are assigned/removed by design (`Front/src/apps/coach/pages/trainings/
season-plan/` owns that UX); `NewSessionPage.tsx` only needs to *not lose* them across a save,
which the `useSessionForm.ts` passthrough above guarantees.

### F10. Testing strategy (TDD, `.claude/rules/frontend-testing.md`)

Precedent check: `IdealLineup.test.tsx` (the existing `@dnd-kit` component in this codebase)
does **not** simulate actual pointer-drag sequences through `DndContext` — it tests
`DraggableListItem`/`OverlayItem` as plain presentational components in isolation, and there is
no test exercising `handleDragEnd` via synthetic drag events. Content-board tests follow the
same approach, plus unit-test the *pure logic* extracted out of the DnD handlers so that logic
is verified without needing to simulate `@dnd-kit`'s pointer machinery at all:

- `flattenSubprincipioTargets(sp, ctx)`, `dedupeById`, `toTargetDetail` — plain pure functions,
  tested directly with constructed `Subprincipio`/`Zona` fixtures (`AdnDraggableTree.dragdrop.test.tsx`).
- `useSessionDrop`'s `addTargets`/`removeTarget` — tested by calling the hook (via
  `renderHook` or a tiny host component) with a mocked `trainingService.updateSession`
  (`vi.mock`, per `.claude/rules/frontend-testing.md` §2.2) resolving/rejecting, asserting the
  optimistic state change happens synchronously and the rollback happens on rejection
  (`useSessionDrop.test.ts`).
- `AdnDraggableTree.coverage.test.tsx` — given a `GameModel` + `AdnCoverage` fixture, assert the
  check icon appears only on covered Subprincipio/Principio nodes, and `UsageBadge` shows the
  right count + tooltip text (session name + formatted date, or "Sin programar" for null date).
- `SessionCard.test.tsx` — renders target chips with the exact breadcrumb text (including the
  no-Zona case, omitting that segment); clicking a chip's delete calls `onRemoveTarget` with the
  right id; "Asignar fecha" calls `navigate` with the expected URL/state.
- `SessionBoardPanel.test.tsx` — only sessions with `date === null` render; create/delete wiring.
- `ContentBoardPage.test.tsx` — loading state; "no GameModel yet" hint (reusing the
  `RouterLink to="/coach/game-model"` hint pattern already in `SeasonPlanEditor.tsx`); both
  panels render given fixture data.
- `SeasonPlanEditor.test.tsx` (existing file, extended): assert
  `MicrocicloSubprincipioObjetivoPicker`/the Autocomplete no longer renders anywhere in the
  editor — a regression guard for the removal in F8.
- `SeasonPlanView.test.tsx` (existing file, extended): assert the weekly-objective chip row now
  reads from `microciclo.weeklyObjective` (F7).
- `useSessionForm.test.ts` (existing file, extended): add cases — an unscheduled session
  (`date: null`, empty `blocks`) passes `validate()`; the same form with `date` set and empty
  `blocks` fails; `loadSession`/`emptySession` carry `targetSubSubPrincipioIds` through
  unchanged.

## Risks / Trade-offs

- [Dropping `MicrocicloSubprincipioObjetivo` data on migration] → Accepted. No stated
  requirement to migrate any existing weekly-objective picks into session targets (they were
  reference-only intent, never tied to actual session content); the migration simply drops the
  table. If the user later wants a one-time backfill script, it can be added as a follow-up
  data migration, not blocking this change.
- [`GetAdnCoverage` is uncached while `GetGameModel` is cached] → Accepted per Decision 5; if
  this query becomes a hot path, a short-TTL cache keyed on `teamId+season` invalidated by
  `CreateSession`/`UpdateSession`/`DeleteSession` (`InvalidateCachingBehavior`, prefix-based)
  can be added later without changing the response shape.
- [Automatic Microciclo resolution can silently pick "no Microciclo" if no SeasonPlan covers
  the date] → Accepted, matches today's already-optional `MicrocicloId` semantics; not a
  regression, just the new default path hitting the same "no plan yet" case explicit selection
  already tolerated.
- [Session-target team-ownership check (Decision 3) adds a query chain on every
  `CreateSession`/`UpdateSession`] → Accepted, same cost class as the existing
  `EnsureMicrocicloBelongsToTeam` chain already paid on every write that sets a `MicrocicloId`.

## Open Questions

- ~~Whether an unscheduled session must satisfy the existing "at least one block" validator...~~
  Resolved — see Decision 3.1: `Blocks` `NotEmpty` is now conditional on `Date != null`; an
  unscheduled ("content-first") session may be saved with only `TargetSubSubPrincipioIds`.
- Exact EF navigation properties needed to walk `SubSubPrincipio → (Subprincipio | Zona →
  Subprincipio) → GamePrinciple → GameModel.TeamId` for Decision 3's team-ownership check —
  `GamePrinciple`/`Zona`/`GameModel` entities were read far enough to confirm the hierarchy
  shape but not every FK property name; task 2.3 (tasks.md) covers finalizing this against the
  real entity code at implementation time.
