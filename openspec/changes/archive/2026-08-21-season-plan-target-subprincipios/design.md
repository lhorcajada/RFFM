# Design

## Backend

Scope: `Back/ExtractionApi/`. Builds directly on top of `session-exercise-plan-redesign`
(implemented and deployed to dev, not yet archived) — this design assumes that change's
schema (simplified `Microciclo`, `TrainingSession.MicrocicloId`, `ExerciseModelRelation`) is
already in place, since it is.

### 1. New `Microciclo` field — join table, not jsonb

**Decision: a lightweight join table `MicrocicloSubprincipioObjetivo(Id, MicrocicloId,
SubprincipioId)`, not a jsonb `List<string>` of raw ids.**

Rationale, grounded in what the codebase actually does today (checked, not assumed):

- This codebase's jsonb `List<string>` pattern (`TaskTrainingBase.Habilidades`,
  `Microciclo.SesionAHabilidades` before it was removed, `ExerciseModelRelation
  .HabilidadesImprescindibles`, `TaskTrainingBase.NivelesColumnas`) is used exclusively for
  **closed-vocabulary or free-text values with no foreign-key meaning** — a Habilidad name is
  validated against a fixed 15-value set, a palanca column name is arbitrary free text. Neither
  case needs a join, an index, or cascade cleanup.
- Every case in this codebase of **referencing another aggregate's row by id** — the very
  thing a Subprincipio-objetivo reference is — uses a real table with a foreign key:
  `ExerciseModelRelation` (→ `Subprincipio`), `ExerciseModelRelationItem` (→
  `SubSubPrincipio`), and the now-removed `MicrocicloSubprincipioLink`/
  `MicrocicloSubSubPrincipioLink` this same Microciclo used to have. All three configure
  `OnDelete(DeleteBehavior.Cascade)` on the FK to the referenced ADN node specifically so that
  "a Subprincipio is later removed from the GameModel → the reference silently disappears,
  the rest of the parent's content is unaffected" (an explicit scenario in
  `specs/exercises/spec.md`'s "Linked Subprincipio or SubSubPrincipio later removed..."
  requirement, and in the season-plan spec's own now-removed "Linked Subprincipio later
  removed from the GameModel" scenario). A jsonb list of raw ids cannot get that cleanup for
  free — an orphaned id would just sit there forever, silently wrong, which is exactly the
  failure mode the FK+cascade pattern exists to prevent.
- A jsonb list also buys nothing here: displaying a Subprincipio reference always requires
  joining back to `Subprincipios` for `Numero`/`Titulo` anyway (see `GetSeasonPlan`'s response
  below), unlike `Habilidades`/`NivelesColumnas` which are genuinely self-contained strings
  rendered as-is.

Shape (mirrors `ExerciseModelRelation`'s file/config layout, minus everything the proposal
explicitly excludes — no FOCO/INTEGRADO, no Habilidades, no SubSubPrincipio-level items):

```csharp
// Domain/Aggregates/SeasonPlans/MicrocicloSubprincipioObjetivo.cs
public class MicrocicloSubprincipioObjetivo : BaseEntity
{
    public string MicrocicloId { get; private set; } = null!;
    public string SubprincipioId { get; private set; } = null!;

    public MicrocicloSubprincipioObjetivo(string microcicloId, string subprincipioId)
    {
        if (string.IsNullOrWhiteSpace(microcicloId))
            throw new ArgumentException("MicrocicloId cannot be empty.", nameof(microcicloId));
        if (string.IsNullOrWhiteSpace(subprincipioId))
            throw new ArgumentException("SubprincipioId cannot be empty.", nameof(subprincipioId));
        MicrocicloId = microcicloId;
        SubprincipioId = subprincipioId;
    }
}
```

`Microciclo` gains:

```csharp
public List<MicrocicloSubprincipioObjetivo> SubprincipiosObjetivo { get; private set; } = new();

/// Clears and rebuilds wholesale — same "trust server-derived state" approach as
/// TaskTrainingBase.ReplaceModelRelations / the old ReplaceSubprincipioLinks.
public void ReplaceSubprincipiosObjetivo(IEnumerable<string>? subprincipioIds)
{
    SubprincipiosObjetivo.Clear();
    foreach (var id in (subprincipioIds ?? Enumerable.Empty<string>()).Distinct())
        SubprincipiosObjetivo.Add(new MicrocicloSubprincipioObjetivo(Id, id));
}
```

EF config (`MicrocicloSubprincipioObjetivoConfiguration`, new file next to the deleted
`MicrocicloSubprincipioLinkConfiguration`'s old location,
`Infrastructure/Persistence/Configuration/Aggregates/SeasonPlans/`): table
`MicrocicloSubprincipiosObjetivo`, `HasOne<Microciclo>().WithMany(m =>
m.SubprincipiosObjetivo).OnDelete(Cascade)` (parent-owned, deleting the Microciclo/plan
deletes these rows — same as before), `HasOne<Subprincipio>().WithMany()
.OnDelete(Cascade)` (silently disappears if the ADN node is removed — same as
`ExerciseModelRelationConfiguration`'s comment on this exact tradeoff). `AppDbContext` gains
`DbSet<MicrocicloSubprincipioObjetivo> MicrocicloSubprincipiosObjetivo`.

No explicit "does this Subprincipio id belong to the team's own GameModel" check in the
handler — same precedent as the exercise-side `ExerciseModelRelation` writes (`CreateExercise`/
`UpdateExercise` don't validate that either; the FK constraint is the only guard, and a
garbage id surfaces as a DB error rather than a clean 400). Out of scope to fix that broader
gap here; flagging it so it isn't mistaken for an oversight specific to this change.

### 2. `SeasonPlanImporter` — extracting the target Subprincipios per week

`SeasonPlanImporter.MicrocicloData`'s existing `ObjetivoSesionA`/`ObjetivoSesionB` prose
already names every week's target subprincipios in text (e.g. "Defensa organizada 1.1",
"Transición defensa-ataque 1.1", "Ataque organizado 1.1", "Transición ataque-defensa 1.1" —
see the class doc-comment's own description of that prose). Re-parsing that prose with regex
at import time would be fragile (qualifiers like "(continúa)", "(repaso)", "(variante de
zona...)" are mixed into the same sentence). Instead, `MicrocicloData` gains an explicit,
hand-transcribed structured field alongside the prose — same source document
(`docs/game-model/Plan-de-Temporada.docx`/`.pdf`), just captured twice in two shapes instead
of derived by parsing:

```csharp
private record MicrocicloData(
    int Order, string WeekLabel, DateOnly StartDate, DateOnly EndDate,
    string ObjetivoSesionA, string ObjetivoSesionB, int GameZoneIdSesionA, int GameZoneIdSesionB,
    List<(int GameMomentId, string Numero)> SubprincipiosObjetivo);
```

`GameMomentId` values match the fixed catalog already referenced elsewhere in this file (see
`GameMomentConfiguration`): 1 = Defensa Organizada, 2 = Ataque Organizado, 3 = Transición
Defensa-Ataque, 4 = Transición Ataque-Defensa. Each week's list holds the 2–4 `(GameMomentId,
Numero)` pairs already implied by that week's `ObjetivoSesionA`/`ObjetivoSesionB` text (e.g.
Semana 1: `(1, "1.1")`, `(3, "1.1")`, `(2, "1.1")`, `(4, "1.1")`).

Resolution at import time reuses the exact lookup already written for
`ExampleSessionSeeder.ResolveSubprincipioIdAsync` (design.md §3 of
`session-exercise-plan-redesign`) — pulled out into a small shared internal helper so it isn't
duplicated verbatim in two importers:

```csharp
// Infrastructure/Persistence/Seed/AdnLookup.cs (new, internal static)
internal static class AdnLookup
{
    public static Task<string?> ResolveSubprincipioIdAsync(
        AppDbContext db, string teamId, int gameMomentId, string numero, CancellationToken ct) => ...
    // (moved verbatim from ExampleSessionSeeder; that class now calls AdnLookup instead)
}
```

`UpsertMicrociclo` resolves each `(GameMomentId, Numero)` pair for the importer's target
`teamId` and calls `microciclo.ReplaceSubprincipiosObjetivo(resolvedIds)`. A pair that doesn't
resolve (team has no GameModel yet, or that specific node isn't in it) is **skipped, not an
error** — identical graceful-degradation already established in `ExampleSessionSeeder`, since
`SeasonPlanImporter` runs on every startup (via `SeedSeasonPlanAsync`) regardless of whether
the team's GameModel has been imported yet.

### 3. Placeholder `TrainingSession`s per Microciclo

After upserting a `Microciclo`, the importer upserts exactly two placeholder
`TrainingSession`s linked to it (`MicrocicloId` set), both with **zero `SessionBlock`s** —
intentionally empty, for the coach to fill in later (see §5 for why this doesn't conflict with
the `CreateSession` validator's non-empty-blocks rule).

Idempotency key: **`(TeamId, MicrocicloId, suffix)`**, not the full session `Name`. `Name`
embeds the human-readable `WeekLabel`, which the hardcoded data occasionally gets touched up
(typos, wording) — matching on a fixed suffix means a `WeekLabel` edit doesn't orphan the
placeholder and create a duplicate on the next re-run, unlike matching the full `Name` (which
is how `ExampleSessionSeeder` already matches its own single hardcoded session — fine there
since that Name never changes, but not robust enough for 30+ machine-generated names here).

```csharp
private const string PrincipalSuffix = " — Sesión principal";
private const string AbpSuffix = " — ABP (jueves)";

private static void UpsertPlaceholderSession(AppDbContext db, string teamId, Microciclo microciclo,
    string weekLabel, string suffix, string? objetivoGeneral, bool onThursday)
{
    var session = db.TrainingSessions.Local
        .Concat(/* already-tracked + a query by TeamId+MicrocicloId+suffix */)
        .FirstOrDefault(s => s.TeamId == teamId && s.MicrocicloId == microciclo.Id && s.Name.EndsWith(suffix));

    var date = onThursday
        ? microciclo.StartDate.AddDays(((int)DayOfWeek.Thursday - (int)microciclo.StartDate.DayOfWeek + 7) % 7)
        : microciclo.StartDate; // "sin día fijo" — StartDate is a neutral placeholder, not meaningful; the coach sets the real day.

    if (session is null)
    {
        session = new TrainingSession { Name = $"{weekLabel}{suffix}", TeamId = teamId, MicrocicloId = microciclo.Id };
        db.TrainingSessions.Add(session);
    }

    session.Date = date.ToDateTime(TimeOnly.MinValue);
    session.ObjetivoGeneral = objetivoGeneral;
    // Description/StartTime/Blocks intentionally left at their empty defaults.
}
```

Called twice per Microciclo from `UpsertMicrociclo`:

- Principal: `suffix = PrincipalSuffix`, `objetivoGeneral = null`, `onThursday = false`.
- ABP: `suffix = AbpSuffix`, `objetivoGeneral = "Sesión de Acciones a Balón Parado (ABP) de la
  semana — contenido pendiente."`, `onThursday = true`. `Name` ends up e.g. `"Semana 5 —
  generación 2 — ABP (jueves)"`, unambiguous in any session list.

The `((int)DayOfWeek.Thursday - (int)StartDate.DayOfWeek + 7) % 7` computation lands on the
Thursday of the same 7-day span regardless of which weekday `StartDate` itself falls on —
correct as long as `EndDate == StartDate.AddDays(6)`, true for every Microciclo this importer
builds.

### 4. Endpoints affected

| File | Change |
|---|---|
| `Features/Coaches/SeasonPlans/Queries/GetSeasonPlan.cs` | `MicrocicloResponse` gains `IEnumerable<SubprincipioSummary> SubprincipiosObjetivo`. Re-add `SubprincipioSummary(string Id, string Numero, string Titulo, string GameMomentName)` (same shape this file had before `session-exercise-plan-redesign` removed it) and a batch resolver (same `ToDictionaryAsync` pattern already used for `ExerciseModelRelationResolver` in the Exercises feature) joining `Subprincipio → GamePrinciple → GameMoment` for the denormalized display fields. |
| `Features/Coaches/SeasonPlans/Commands/CreateSeasonPlan.cs` | `MicrocicloRequest` gains `List<string>? SubprincipioObjetivoIds = null`. `CreateSeasonPlanHandler.BuildMicrociclo` calls `microciclo.ReplaceSubprincipiosObjetivo(mir.SubprincipioObjetivoIds)` after construction. |
| `Features/Coaches/SeasonPlans/Commands/UpdateSeasonPlan.cs` | `MicrocicloUpdateRequest` gains the same field. `UpsertMicrociclos` calls `ReplaceSubprincipiosObjetivo` on both the "existing" and "new" branches (mirrors how `ObjetivoSesionA/B` used to be threaded through both branches before that field was removed). Handler's `Include` chain gains `.ThenInclude(m => m.SubprincipiosObjetivo)` on the Microciclo level so existing rows are tracked for the clear+rebuild. |
| `Features/Coaches/SeasonPlans/Commands/DeleteSeasonPlan.cs` | Unaffected — cascade via `MicrocicloSubprincipioObjetivoConfiguration`'s parent FK handles cleanup automatically, same as `SessionBlock`s already do. |

No new validator rules beyond `RuleForEach(x => x.SubprincipioObjetivoIds).NotEmpty()` (guards
against a client sending blank-string entries) — existence of the referenced Subprincipio is
enforced only by the DB FK, per §1's noted precedent.

### 5. Placeholder sessions vs. the "non-empty blocks" rule — not a conflict

`session-exercise-plan-redesign`'s `CreateSessionValidator`/`UpdateSessionValidator` reject a
`Blocks` list that's empty — but that's **FluentValidation on the `CreateSession`/
`UpdateSession` Mediator commands**, which only runs when a request goes through
`IMediator.Send`. `SeasonPlanImporter` builds `TrainingSession`/`SessionBlock` entities
directly and calls `SaveChangesAsync` on the `AppDbContext` — it never goes through the
command pipeline, so that validator never runs against it. There's no domain-level invariant
on `TrainingSession`/`SessionBlock` forcing non-empty blocks (checked: neither entity's
constructor enforces it), so this is legal today without any change to those entities. This is
a deliberate tooling/bootstrap exception, not a loophole — flagging it explicitly here rather
than leaving it implicit. (`specs/sessions/spec.md` from the prior change hasn't been archived
into `openspec/specs/` yet, so there is no currently-published global requirement this
contradicts; if/when that change is archived, its "non-empty list of SessionBlocks"
requirement should be read as scoped to coach-authored sessions saved via the API, not to
importer-seeded placeholders — worth a one-line clarification in that spec whenever it's
archived, not blocking this change.)

### 6. Migration

One additive migration, e.g. `AddMicrocicloSubprincipioObjetivo` — creates
`MicrocicloSubprincipiosObjetivo` (FK to `Microciclos` cascade, FK to `Subprincipios`
cascade). No column drops, no data loss; safe to apply directly to the dev DB that already has
`RestructureExerciseSchema` applied.

### 7. Frontend coordination notes

- `GetSeasonPlan`'s `MicrocicloResponse.SubprincipiosObjetivo` is `(Id, Numero, Titulo,
  GameMomentName)` per entry — render as chips per Microciclo card, same visual slot the old
  (pre-redesign) Sesión A/B Subprincipio chips used to occupy.
- `CreateSeasonPlan`/`UpdateSeasonPlan`'s `MicrocicloRequest`/`MicrocicloUpdateRequest` both
  gain an optional `subprincipioObjetivoIds: string[]` — the Microciclo editor's Subprincipio
  picker (removed in the prior redesign) needs to come back, scoped to this one field only (no
  FOCO/INTEGRADO toggle, no Habilidades, no SubSubPrincipio picker — those stay exercise-only).
- The two placeholder sessions the importer creates are ordinary `TrainingSession`s — they
  show up in `GetSessions`/`GetSeasonPlan`'s existing `Sessions` list exactly like any
  coach-created session, distinguishable only by their `Name` suffix (`" — Sesión principal"` /
  `" — ABP (jueves)"`) and `ExerciseCount == 0` until filled in. No new field/flag was added to
  mark them as "placeholder" — this design deliberately treats them as regular sessions from
  the moment they're upserted, since the proposal's whole point is that the coach edits them
  like any other session, not through some special placeholder-only flow.

## Frontend

Scope: `Front/src/apps/coach/`. Small, additive on top of `session-exercise-plan-redesign`'s
already-implemented Planificación tab (Microciclo cards with linked-sessions chips, tab order
Planificación/Ejercicios/Sesiones). Follows `.claude/rules/react.md`/
`.claude/rules/frontend-architecture.md`: CSS Modules co-located, no `styled()`/inline
styles, `seasonPlanService.ts` for the API call, no barrel `index.ts`, TypeScript strict, no
`any`.

### 1. Types — `types/seasonPlan.ts`

No new type needed for the display shape: the backend's `SubprincipioSummary(Id, Numero,
Titulo, GameMomentName)` is field-for-field identical to the existing `AdnSubprincipioSummary`
already defined in this file (used today by `ModelRelationSection`'s picker options and,
before the prior redesign, by the old Sesión A/B chips) — reuse it rather than adding a
duplicate `SubprincipioObjetivoSummary` alias.

`Microciclo` gains a read/write pair, mirroring the exact pattern the old (now-removed)
`sesionASubprincipios`/`sesionASubprincipioIds` pair used:

```ts
export interface Microciclo {
  // ...existing fields (id, apiId, order, weekLabel, startDate, endDate, sessions)...
  /** Denormalized target-Subprincipio summaries — read side, populated from GetSeasonPlan. */
  subprincipiosObjetivo: AdnSubprincipioSummary[];
  /** Selected Subprincipio ids — write side, sent on create/update (replace-wholesale). */
  subprincipioObjetivoIds: string[];
}
```

### 2. Service — `seasonPlanService.ts`

- Re-add an `ApiAdnSubprincipioSummary` interface (`id, numero, titulo, gameMomentName`) —
  removed by the prior redesign along with the old Sesión A/B fields, now needed again for the
  wire shape of `ApiMicrociclo.subprincipiosObjetivo`.
- `ApiMicrociclo` gains `subprincipiosObjetivo: ApiAdnSubprincipioSummary[]`.
- `mapMicrociclo`: `subprincipiosObjetivo: m.subprincipiosObjetivo ?? []`,
  `subprincipioObjetivoIds: (m.subprincipiosObjetivo ?? []).map((s) => s.id)` — same
  derive-ids-from-the-read-response approach the old `sesionASubprincipioIds` mapping used.
- `mapMicrocicloCreateRequest`/`mapMicrocicloUpdateRequest` gain
  `subprincipioObjetivoIds: m.subprincipioObjetivoIds`.
- `getAdnOptions(teamId, season)` is unchanged (already delegates to
  `gameModelService.getAdnOptions`) — reused as-is to source the picker's options (§3).

### 3. `SeasonPlanEditor.tsx` — Subprincipio picker back, scoped to this one field

`SeasonPlanEditorProps` regains an `adnOptions: AdnOptions` prop (removed by the prior
redesign along with the old Sesión A/B pickers) — **not** the full old `SessionAdnPickers`
component (that also drove SubSubPrincipio + Habilidad selection, both out of scope here per
the proposal). New, smaller `MicrocicloSubprincipioObjetivoPicker`:

```tsx
function MicrocicloSubprincipioObjetivoPicker({
  subprincipioObjetivoIds,
  adnOptions,
  hasGameModel,
  onChange,
}: {
  subprincipioObjetivoIds: string[];
  adnOptions: AdnOptions;
  hasGameModel: boolean;
  onChange: (ids: string[]) => void;
}) {
  return (
    <Autocomplete<AdnSubprincipioOption, true>
      multiple
      size="small"
      disabled={!hasGameModel}
      options={adnOptions.subprincipios}
      value={adnOptions.subprincipios.filter((o) => subprincipioObjetivoIds.includes(o.id))}
      getOptionLabel={(o) => `${o.numero} · ${o.titulo}`}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      onChange={(_, value) => onChange(value.map((v) => v.id))}
      renderInput={(params) => <TextField {...params} label="Subprincipios objetivo de la semana" />}
    />
  );
}
```

Rendered inside `MicrocicloEditor` (same file/component that already holds
Semana/Inicio/Fin), right below those three fields and above the "Eliminar microciclo"
button; `hasGameModel = adnOptions.subprincipios.length > 0`, and when false a one-line hint
("Añade primero el Modelo ADN del equipo…") is shown next to the disabled picker — same
pattern already used by `ModelRelationSection`'s own `noGameModelHint`, per spec's "Team with
no GameModel yet" scenario (picker disabled, rest of the Microciclo's fields stay editable —
already true today since nothing else in `MicrocicloEditor` depends on `adnOptions`).
`adnOptions` threads down `SeasonPlanEditor` → `MacrocicloEditor` → `MesocicloEditor` →
`MicrocicloEditor`, same prop-drilling shape the removed pickers used to follow (no new
context — a 4-level prop is not deep enough to justify one, matching this codebase's existing
threshold elsewhere).

`EMPTY_MICROCICLO(order)` gains `subprincipiosObjetivo: [], subprincipioObjetivoIds: []`.

### 4. `Trainings.tsx` — reinstate the `adnOptions` fetch for the Planificación tab

The prior redesign deleted `Trainings.tsx`'s `adnOptions` state/effect entirely (it was only
consumed by the now-removed Sesión A/B pickers). Bring back a minimal version: an
`adnOptions` state + an effect that calls `seasonPlanService.getAdnOptions(teamId,
seasonName)` when the Planificación tab is active and `seasonName` is known — same effect
shape/dependencies the pre-redesign code used, scoped only to feeding `SeasonPlanEditor`
(not re-adding anything to `SeasonPlanView`, which doesn't need `adnOptions` — it only
renders the already-resolved `subprincipiosObjetivo` summaries, see §5). Pass `adnOptions` to
`<SeasonPlanEditor .../>`'s new prop.

### 5. `SeasonPlanView.tsx` — target-Subprincipio chips per Microciclo

`MicrocicloRow` (already rendering `microciclo.weekLabel`/dates/coverage chip/sessions list
from the prior redesign) gains a chips row for `microciclo.subprincipiosObjetivo`, rendered
**only when non-empty** (no empty-state placeholder needed — the spec's scenario only
describes the non-empty case, and an empty target list isn't itself a problem worth flagging
the way "no sessions" is), positioned between the header row (label/dates/coverage chip +
"Crear sesión" button) and the sessions list, so it reads as "what this week is *for*" before
"what's *scheduled*". New chip style class (`targetSubprincipioChip` in
`SeasonPlanView.module.css`), visually distinct from both the existing `coverageChip` and the
session rows' own styling (a different accent color — reuse the same violet/purple accent
`ModelRelationSection`'s FOCO chips use elsewhere in this app for ADN-reference chips, kept
consistent rather than inventing a new hue) — satisfies the spec's "distinct from the
session-linked chips" requirement.

```tsx
{microciclo.subprincipiosObjetivo.length > 0 && (
  <Box className={styles.targetSubprincipiosRow}>
    {microciclo.subprincipiosObjetivo.map((s) => (
      <Chip key={s.id} label={`${s.numero} · ${s.titulo}`} size="small" className={styles.targetSubprincipioChip} />
    ))}
  </Box>
)}
```

### 6. Placeholder sessions — no new frontend work, confirmed

The importer's two placeholder `TrainingSession`s per Microciclo (design.md's Backend §3) are
ordinary sessions with `MicrocicloId` set and `ExerciseCount == 0` — they already surface
through the exact code paths `session-exercise-plan-redesign` built: `Trainings.tsx`'s
Sesiones tab list (via `GetSessions`, showing the "Independiente"/plan-linked chip pair based
on `isAssociatedToPlan`) and `SeasonPlanView.tsx`'s per-Microciclo sessions list (via
`GetSeasonPlan`'s `Sessions` summaries, §5's existing `SessionRow`). Their `Name` suffix
(`" — Sesión principal"` / `" — ABP (jueves)"`) is plain text within the existing
`SessionRow`/session-card name field — no dedicated badge/icon is being added to call out
"this is a placeholder", per the proposal's explicit "no UI distinction needed" stance (§1's
task list item #4) and the backend design's §7 note that they're deliberately indistinguishable
from coach-created sessions beyond their name. Confirmed: zero new files/props for this item.

### 7. Test coverage plan (Vitest + Testing Library)

- `seasonPlanService.test.ts` — extend: `mapMicrociclo` maps `subprincipiosObjetivo` and
  derives `subprincipioObjetivoIds`; `create`/`update` request payloads include
  `subprincipioObjetivoIds`.
- `SeasonPlanEditor.test.tsx` — extend: picker renders `adnOptions.subprincipios` as
  multi-select options; selecting/deselecting updates `subprincipioObjetivoIds` and is
  included in the `onSave` payload; picker disabled + hint shown when `adnOptions.subprincipios`
  is empty, while Semana/Inicio/Fin stay editable.
- `SeasonPlanView.test.tsx` — extend: renders a chip per `subprincipiosObjetivo` entry
  (`Numero · Titulo`); renders no chips row when the list is empty; chip class differs from
  `coverageChip`/session-row classes (distinctness check).

Verify with `npm run test` after each file, `npm run build` after the full set.
