## Key finding that reshapes scope

The "mark an absence with a reason" capability **already exists** end-to-end and does not need new
UI: the Coach-only "Asistencia" tab in `AttendanceTabs.tsx` (rendered from `AttendanceEvent.tsx`,
works for both trainings and matches via the `isMatch` prop) already lets a coach set, per accepted
player, `AssistanceType = "No asiste con excusa"` (id 2) + `ExcuseTypeId`, via the existing endpoint
`PUT /api/events/{eventId}/convocations/{convocationId}/assistance` →
`UpdateConvocationAssistance.cs`. This is already the correct way to record "the player was called
up but didn't attend, here's why."

The actual bug: `GetPlayerConvocationSummary`'s `lastJustifiedAbsenceMatch` reads
`Convocation.ConvocationStatusId == Justified (4)` — a status **no Coach/Player/FamilyMember UI
anywhere writes** (confirmed by repo-wide grep). So the "Última ausencia" tile is permanently empty
by construction, regardless of how many absences the coach records via the Asistencia tab. Fixing
the read-model to look at `AssistanceTypeId` instead closes the gap — **no new dialog, no new
endpoint, no domain/migration change** for the "mark absence" requirement.

## Backend — `GetPlayerConvocationSummary.cs`

File: `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Queries/GetPlayerConvocationSummary.cs`

### DTO changes

```csharp
public record PlayerConvocationSummaryDto(
    int TotalStarts,
    int TotalConvocations,
    int TotalTrainingConvocations,
    int TotalFriendlyConvocations,
    int TotalLeagueConvocations,
    PlayerAbsenceMatchDto? LastDeconvokedMatch,
    PlayerAbsenceMatchDto? LastAbsenceMatch);   // renamed from LastJustifiedAbsenceMatch

public record PlayerAbsenceMatchDto(
    string EventId,
    DateTime? MatchDate,
    string? RivalName,
    int EventTypeId,
    string EventTypeName,
    string? Reason);   // new — ExcuseType.Name when present, else null
```

`TotalConvocations` is kept as-is (count of all `Convocations` for the player, any event type) for
backward compatibility with anything else reading it; the 3 new fields are additive breakdowns.

### Handler changes

1. **Breakdown by event type** — one grouped query instead of the current single count:
   ```csharp
   var countsByEventType = await _db.Convocations
       .AsNoTracking()
       .Where(c => c.TeamPlayerId == request.TeamPlayerId)
       .GroupBy(c => c.SportEvent.EventTypeId)
       .Select(g => new { EventTypeId = g.Key, Count = g.Count() })
       .ToListAsync(cancellationToken);

   int CountFor(int eventTypeId) =>
       countsByEventType.FirstOrDefault(x => x.EventTypeId == eventTypeId)?.Count ?? 0;

   var totalConvocations = countsByEventType.Sum(x => x.Count);
   var totalTraining = CountFor(SportEventType.TrainingId);
   var totalLeague = CountFor(SportEventsConstants.MatchEventTypeId);
   var totalFriendly = CountFor(SportEventsConstants.FriendlyEventTypeId);
   ```
   Requires `using RFFM.Api.Features.Coaches.SportEvents.Queries;` for `SportEventsConstants`
   (`MatchEventTypeId = 1`, `FriendlyEventTypeId = 4`) — same constants already used by
   `GetSportEventItem`/`GetSportEvents` for `MatchCategory`. Reuses `SportEventType.TrainingId` (2),
   already used by `UpdateConvocationStatus`.

2. **`lastDeconvokedMatch`** — unchanged query (`ConvocationStatusId == Deconvoke`), but now
   `.Include(c => c.ExcuseType)` and map `Reason = convocation.ExcuseType?.Name`.

3. **`lastAbsenceMatch`** (replaces `lastJustifiedAbsenceMatch`) — new query source:
   ```csharp
   // AssistanceType exposes public static readonly instances directly (Attendance,
   // ExcusedAbsence, UnexcusedAbsence, LateArrival) — no FromName lookup needed.
   private static readonly int ExcusedAbsenceTypeId = AssistanceType.ExcusedAbsence.Id;
   private static readonly int UnexcusedAbsenceTypeId = AssistanceType.UnexcusedAbsence.Id;

   var convocation = await _db.Convocations
       .AsNoTracking()
       .Include(c => c.SportEvent).ThenInclude(se => se.Rival)
       .Include(c => c.ExcuseType)
       .Where(c => c.TeamPlayerId == teamPlayerId &&
                   (c.AssistanceTypeId == ExcusedAbsenceTypeId || c.AssistanceTypeId == UnexcusedAbsenceTypeId))
       .OrderByDescending(c => c.SportEvent.EveDateTime ?? DateTime.MinValue)
       .FirstOrDefaultAsync(cancellationToken);
   ```
   `Reason = convocation.ExcuseType?.Name` — null for `UnexcusedAbsence` (no excuse catalog value is
   ever attached to that assistance type per `UpdateConvocationAssistance.cs`), populated for
   `ExcusedAbsence`.

The `GetMostRecentAbsenceMatchAsync(teamPlayerId, convocationStatusId, ...)` private helper becomes
two distinct query shapes (one filters by `ConvocationStatusId`, the other by `AssistanceTypeId`);
either keep two small private methods or generalize with a `Func<Convocation, bool>`-shaped
predicate passed as an `Expression<Func<Convocation, bool>>` — follow whichever reads cleaner, this
is a 6-line method, no need to over-abstract.

## Frontend

### `convocationService.ts`

```ts
export type PlayerAbsenceMatch = {
  eventId: string;
  matchDate: string | null;
  rivalName: string | null;
  eventTypeId: number;
  eventTypeName: string | null;
  reason: string | null;          // new
};

export type PlayerConvocationSummary = {
  totalStarts: number;
  totalConvocations: number;
  totalTrainingConvocations: number;   // new
  totalFriendlyConvocations: number;   // new
  totalLeagueConvocations: number;     // new
  lastDeconvokedMatch: PlayerAbsenceMatch | null;
  lastAbsenceMatch: PlayerAbsenceMatch | null;   // renamed from lastJustifiedAbsenceMatch
};
```

No change to `getPlayerConvocationSummary()` itself — same GET, response shape grows.

### `PlayerConvocationSummaryCard.tsx`

Replace the single "Convocatorias" tile with 3 tiles; rename the desconvocatoria tile label; pass
`reason` through to `AbsenceTile` and render it as a second line when present:

```tsx
<div className={styles.tile}>
  <span className={styles.tileValue}>{summary.totalTrainingConvocations}</span>
  <span className={styles.tileLabel}>Entrenamientos</span>
</div>
<div className={styles.tile}>
  <span className={styles.tileValue}>{summary.totalFriendlyConvocations}</span>
  <span className={styles.tileLabel}>Amistosos</span>
</div>
<div className={styles.tile}>
  <span className={styles.tileValue}>{summary.totalLeagueConvocations}</span>
  <span className={styles.tileLabel}>Liga</span>
</div>
<AbsenceTile
  label="Última desconvocatoria"
  match={summary.lastDeconvokedMatch}
  emptyLabel="Sin desconvocatorias registradas"
/>
<AbsenceTile
  label="Última ausencia"
  match={summary.lastAbsenceMatch}
  emptyLabel="Sin ausencias registradas"
/>
```

`AbsenceTile` gains a reason line:
```tsx
{match.reason && <span className={styles.absenceReason}>Motivo: {match.reason}</span>}
```
New `.absenceReason` CSS rule in `PlayerConvocationSummaryCard.module.css`, same visual weight as
`.emptyValue` (small, muted).

`Titularidades` tile stays; grid now has 6 tiles instead of 4 — existing `auto-fit, minmax(150px,
1fr)` grid and the `max-width: 480px → 1fr 1fr` rule already handle this without changes.

### No change needed

- `usePlayerConvocationSummary.ts` — passes data through unchanged.
- `AttendanceTabs.tsx` / `AttendanceEvent.tsx` / `assistanceTypeService.ts` /
  `UpdateConvocationAssistance.cs` — the absence-marking capability already works; out of scope.
- `UpdateConvocationStatus.cs` / `ConvocationDeconvokeDialog.tsx` / `useConvocationManagement.ts` —
  untouched; deconvocation flow is unaffected by this change.

## Tests to update/add

- Backend: `GetPlayerConvocationSummaryHandlerTests.cs` — rewrite the two `*Justified*` tests to
  seed `AssistanceTypeId`/`ExcuseTypeId` on the `ConvocationModel` (via `SeedConvocationAsync`,
  extended to accept optional `assistanceTypeId`/`excuseTypeId`) instead of
  `ConvocationStatusId = Justified`; add new tests for the 3-way breakdown (training/friendly/league
  counts) and for `Reason` being populated on both `LastDeconvokedMatch` and `LastAbsenceMatch`, and
  null for an `UnexcusedAbsence` without a catalog reason.
- Frontend: `PlayerConvocationSummaryCard.test.tsx` — update fixture shape (new fields), assert 3
  breakdown tiles render, assert renamed label "Última desconvocatoria", assert reason text renders
  when present and is absent when `reason: null`.
