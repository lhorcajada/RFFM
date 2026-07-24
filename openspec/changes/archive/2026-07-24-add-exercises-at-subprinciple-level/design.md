## Backend (`Back/ExtractionApi`)

### Domain — `Domain/Aggregates/Training/TasksTraining/TaskTrainingBase.cs`

Add a nullable FK mirroring `SubSubPrincipleId`, plus its navigation:

```csharp
/// <summary>Optional: the sub-sub-principle this exercise targets.</summary>
public string? SubSubPrincipleId { get; set; }

/// <summary>Optional: the sub-principle this exercise targets (mutually exclusive with SubSubPrincipleId).</summary>
public string? SubPrincipleId { get; set; }
...
public SubSubPrinciple? SubSubPrinciple { get; set; }
public SubPrinciple? SubPrinciple { get; set; }
```

### EF Configuration — `Infrastructure/Persistence/Configuration/Aggregates/Trainings/TaskTrainingBaseEntityConfiguration.cs`

Mirror the existing `SubSubPrincipleId` block:

```csharp
builder.Property(tb => tb.SubPrincipleId)
    .IsRequired(false)
    .HasMaxLength(36);

builder.HasOne(tb => tb.SubPrinciple)
    .WithMany()
    .HasForeignKey(tb => tb.SubPrincipleId)
    .IsRequired(false)
    .OnDelete(DeleteBehavior.SetNull);
```

### Migration

Run `.\manage-migrations.ps1` (or `dotnet ef migrations add AddSubPrincipleIdToTaskTrainingBase --project src/RFFM.Api --startup-project ../RFFM.Host`) to add the nullable `SubPrincipleId` column + FK. No data backfill needed (defaults to `NULL`).

### `Features/Coaches/Trainings/Exercises/CreateExercise.cs`

- `CreateExerciseCommand` gains `string? SubPrincipleId`.
- Handler sets `exercise.SubPrincipleId = request.SubPrincipleId;` alongside the existing `SubSubPrincipleId` assignment.
- `CreateExerciseValidator` gets a mutual-exclusion rule:

```csharp
RuleFor(x => x)
    .Must(x => !(string.IsNullOrEmpty(x.SubSubPrincipleId) && string.IsNullOrEmpty(x.SubPrincipleId))
             && !(!string.IsNullOrEmpty(x.SubSubPrincipleId) && !string.IsNullOrEmpty(x.SubPrincipleId)))
    .WithMessage("Exactly one of SubSubPrincipleId or SubPrincipleId must be provided.");
```

### `Features/Coaches/Trainings/Exercises/UpdateExercise.cs`

Today the handler only overwrites `SubSubPrincipleId` "if provided" (comment: *never clear an existing link*) — that guard blocks reassignment between levels. Since the frontend form will now always send both fields explicitly (one populated, one `null`), switch to direct assignment so reassignment (habilidad → subprincipio and back) works:

```csharp
exercise.SubSubPrincipleId = request.SubSubPrincipleId;
exercise.SubPrincipleId = request.SubPrincipleId;
```

`UpdateExerciseCommand` gains `string? SubPrincipleId`. `UpdateExerciseValidator` gets the same mutual-exclusion rule as `CreateExerciseValidator`.

### `Features/Coaches/Trainings/Exercises/GetExercises.cs`

- Route/query gains optional `subPrincipleId`: `GET /api/trainings/exercises?clubId=&subSubPrincipleId=&subPrincipleId=`.
- `GetExercisesQuery` gains `string? SubPrincipleId`.
- Handler adds `.Include(tb => tb.SubPrinciple)` and:

```csharp
if (!string.IsNullOrEmpty(request.SubPrincipleId))
    query = query.Where(tb => tb.SubPrincipleId == request.SubPrincipleId);
```

- `ExerciseListItem` gains `string? SubPrincipleId, string? SubPrincipleName` (projected from `tb.SubPrincipleId` / `tb.SubPrinciple?.Name`).

### `Features/Coaches/Trainings/Exercises/GetExerciseById.cs`

Same `.Include(tb => tb.SubPrinciple)` and DTO fields as above (shares `ExerciseListItem`).

### Cache invalidation

`GetExercises`/`GetExerciseById` are cached (`ICacheRequest` behavior per `CLAUDE.md`); `CreateExercise`/`UpdateExercise` already invalidate by the exercises cache prefix — no prefix changes needed since the cache key already varies by `clubId`/`subSubPrincipleId`/(new) `subPrincipleId` query args.

---

## Frontend (`Front/src`)

### `apps/coach/types/training.ts`

```ts
export interface Exercise {
  ...
  subSubPrincipleId?: string | null;
  subSubPrincipleName?: string | null;
  subPrincipleId?: string | null;
  subPrincipleName?: string | null;
  ...
}

export interface CreateExerciseRequest {
  ...
  subSubPrincipleId?: string | null;
  subPrincipleId?: string | null;
  ...
}
```

### `apps/coach/services/trainingService.ts`

```ts
async getExercises(clubId: string, opts?: { subSubPrincipleId?: string | null; subPrincipleId?: string | null }): Promise<Exercise[]> {
  const params: Record<string, string> = { clubId };
  if (opts?.subSubPrincipleId) params.subSubPrincipleId = opts.subSubPrincipleId;
  if (opts?.subPrincipleId) params.subPrincipleId = opts.subPrincipleId;
  const res = await client.get<Exercise[]>("/api/trainings/exercises", { params });
  return res.data;
},
```

`getExercises` currently takes `subSubPrincipleId` as a positional second arg (used by `SubSubPrincipleCard.tsx:69` and `SessionsFromSubPrinciple.tsx:405`) — switching to an options object requires updating both call sites in the same change.

### New shared component: `apps/coach/pages/game-model/components/PrincipleExercisesSection.tsx` (+ `.module.css`)

`SubSubPrincipleCard.tsx:192-373` currently inlines the entire "Ejercicios de entrenamiento" block (header + add button, exercise grid, delete-confirm dialog) tied to `subSubPrincipleId`. Extract it into a standalone component so `SubPrincipleDetailView` can reuse it instead of duplicating ~180 lines of JSX:

```tsx
interface PrincipleExercisesSectionProps {
  clubId: string;
  teamId: string;
  levelKind: "subSubPrinciple" | "subPrinciple";
  levelApiId: string; // sspApiId or sp.apiId
  levelName: string;  // for the "new exercise" nav params (sspName / spName) and empty-state text
  active: boolean;    // when false, skips fetching (mirrors today's lazy-load-on-expand behavior)
  onCountChange?: (count: number) => void; // lets the parent header show "N ej." without re-fetching
}
```

Internally: same `loadExercises`/`deleteExId`/`exGrid` logic as today's `SubSubPrincipleCard`, but the query param it sets is `subSubPrincipleId` or `subPrincipleId` depending on `levelKind` (via `trainingService.getExercises(clubId, { [levelKind === "subSubPrinciple" ? "subSubPrincipleId" : "subPrincipleId"]: levelApiId })`), and `goToExercisePage`/`duplicateExercise` build `URLSearchParams` with the matching key (`subSubPrincipleId`+`sspName` or `subPrincipleId`+`spName`).

- `SubSubPrincipleCard.tsx`: replace the inline block with `<PrincipleExercisesSection clubId={clubId} teamId={teamId} levelKind="subSubPrinciple" levelApiId={sspApiId} levelName={subSubPrinciple.name} active={expanded} onCountChange={setExCount} />`; the `totalExercises` chip in the header (`SubSubPrincipleCard.tsx:145-152`) reads `exCount` (new local state) instead of the current `exLoaded ? exercises.length : ...` computation.
- `SubPrincipleDetailView` (`ScenarioAccordion.tsx:29-119`): add the same section right after the tactical-principles row, always `active` (no collapse to lazy-load behind), plus a `Chip` next to "Nueva sesión"/"Ver sesiones" showing the exercise count (mirrors `SubSubPrincipleCard`'s `exerciseChip`).

### `apps/coach/pages/trainings/new/NewExercisePage.tsx`

Read both context ids from the URL:

```ts
const subSubPrincipleId = params.get("subSubPrincipleId");
const subSubPrincipleName = params.get("sspName");
const subPrincipleId = params.get("subPrincipleId");
const subPrincipleName = params.get("spName");
```

Both are passed into `useExerciseForm` and `ExerciseFormPanel`. Whichever one is present when the page opens from a card determines the initial `form.subSubPrincipleId`/`form.subPrincipleId`.

### `apps/coach/pages/trainings/new/hooks/useExerciseForm.ts`

- `UseExerciseFormParams` gains `subPrincipleId: string | null`.
- `form` state carries both `subSubPrincipleId` and `subPrincipleId` (always one populated, one `null`) instead of just `subSubPrincipleId`.
- New `setLevel(kind: "subSubPrinciple" | "subPrinciple")` helper that swaps which field is populated, for the reassignment toggle — clearing the other:

```ts
const setLevel = (kind: "subSubPrinciple" | "subPrinciple") => {
  setForm((prev) => ({
    ...prev,
    subSubPrincipleId: kind === "subSubPrinciple" ? (subSubPrincipleId ?? prev.subSubPrincipleId ?? null) : null,
    subPrincipleId: kind === "subPrinciple" ? (subPrincipleId ?? prev.subPrincipleId ?? null) : null,
  }));
};
```

- `applyExercise` (loading an existing/duplicated exercise) sets both fields from `exercise.subSubPrincipleId`/`exercise.subPrincipleId` (falling back to the URL context ids only when the loaded exercise has neither, e.g. a brand-new exercise created from this context).
- Skills (`gameModelService.getSubSubPrincipleSkills`) only apply at the habilidad (sub-subprincipio) level — the effect that loads `skills` stays keyed off `resolvedSubSubPrincipleId`; when the form is switched to `subPrincipleId`, skills are cleared (`essentialSkillIds: []`) since a subprincipio has no direct essential-skills list.

### `apps/coach/pages/trainings/new/components/ExerciseFormPanel.tsx`

Reassignment control (only rendered when the page has *both* a `subSubPrincipleId` and a `subPrincipleId` context available — i.e. we know the sub-subprincipio's parent subprincipio):

```tsx
{subSubPrincipleId && subPrincipleId && (
  <FormControl size="small" className={styles.field}>
    <InputLabel>Vinculado a</InputLabel>
    <Select
      value={formData.subPrincipleId ? "subPrinciple" : "subSubPrinciple"}
      label="Vinculado a"
      onChange={(e) => form.setLevel(e.target.value as "subSubPrinciple" | "subPrinciple")}
    >
      <MenuItem value="subSubPrinciple">Habilidad: {subSubPrincipleName}</MenuItem>
      <MenuItem value="subPrinciple">Subprincipio: {subPrincipleName}</MenuItem>
    </Select>
  </FormControl>
)}
```

When only one context id is available (e.g. opened directly from `SubPrincipleDetailView`'s "Añadir ejercicio", with no sub-subprincipio in scope), the selector is hidden and the exercise is created/saved at that single level — matching today's behavior for habilidad-only creation.

### Passing the parent subprincipio id down to `SubSubPrincipleCard`

`SubSubPrincipleCard` (`ScenarioAccordion.tsx:112-114`) is instantiated from `SubPrincipleDetailView`, which already has `sp.apiId` in scope. Add `subPrincipleApiId={sp.apiId}` and `subPrincipleName={sp.name}` props to `SubSubPrincipleCard`, threaded into `buildExerciseParams`/`goToExercisePage`/`duplicateExercise` (`SubSubPrincipleCard.tsx:96-125`) as the extra `subPrincipleId`/`spName` query params — this is what makes the reassignment selector appear when creating/editing from the habilidad level.

---

## Non-Goals (unchanged from proposal)

- No arbitrary cross-subprincipio reassignment — only toggling between a sub-subprincipio and its own parent subprincipio, since that's the only relationship the UI has in scope at exercise-edit time.
- `TrainingSession.SubPrincipleId` (session-level filter, unrelated table) is untouched.
