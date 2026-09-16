## Key finding that reshapes scope

The live-match roster data already exists: `GetEventConvocations` (`Back/.../Features/Coaches/Convocations/GetEventConvocations.cs`) already returns `AssistanceTypeId`, `ExcuseTypeId` and `StatusId` per player, and the frontend already fetches it in `useConvocationManagement.ts` (`convocationService.getConvocations(mgmtEventId)` → `convs`) — but only `excuseTypeId` and `minutesReason` are extracted into state (`mgmtExcuseMap`, `mgmtMinutesReasonMap`); `assistanceTypeId` is read from `convs` for grouping (called/not-called) but never kept. **No backend change is needed for the live-match visibility part** — only a bug-shaped gap: capture `assistanceTypeId` into a new map and thread it through the existing `SquadPlayer` pipeline to `BenchPlayerCard`, which already renders per-player in all 6 call sites across `PartidoEnDirectoTab.tsx`/`SimulacionTab.tsx`.

The attendance-ratio stat, however, is a real backend gap: `GetTeamPlayerStatistics.TrainingsAttended`/`MatchesPlayed` are absolute counts (season-long convocation attendance for trainings; `MatchParticipation` row count for matches) with no "possible" denominator, and matches aren't split friendly/league.

`AssistanceType.LateArrival` has no reason today: `UpdateConvocationAssistance.cs` clears `ExcuseTypeId` for any assistance type other than `ExcusedAbsence` (id 2).

## Backend — `UpdateConvocationAssistance.cs`

File: `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Convocations/UpdateConvocationAssistance.cs`

Currently (~line 65-77):
```csharp
// ExcuseTypeId only applies when "No asiste con excusa" (id=2)
if (request.AssistanceTypeId == AssistanceType.ExcusedAbsence.Id)
{
    if (request.ExcuseTypeId.HasValue)
    {
        var excuse = ExcuseTypes.FromId(request.ExcuseTypeId.Value)
            ?? throw new ArgumentException($"Invalid excuse type id: {request.ExcuseTypeId}");
    }
    conv.SetExcuseTypeId(request.ExcuseTypeId);
}
else
{
    conv.SetExcuseTypeId(null);
}
```
Change the condition to also allow `LateArrival`:
```csharp
var excuseAllowed = request.AssistanceTypeId == AssistanceType.ExcusedAbsence.Id
    || request.AssistanceTypeId == AssistanceType.LateArrival.Id;

if (excuseAllowed)
{
    if (request.ExcuseTypeId.HasValue)
    {
        var excuse = ExcuseTypes.FromId(request.ExcuseTypeId.Value)
            ?? throw new ArgumentException($"Invalid excuse type id: {request.ExcuseTypeId}");
    }
    conv.SetExcuseTypeId(request.ExcuseTypeId);
}
else
{
    conv.SetExcuseTypeId(null);
}
```
`ExcuseTypeId` stays optional for `LateArrival` (a coach may mark "llegó tarde" without a catalog reason, same as today's optional-reason UX for absences without one). No domain/migration change — reuses the existing `Convocation.ExcuseTypeId` column.

Frontend counterpart: wherever the Asistencia tab UI (`AttendanceTabs.tsx`/`AttendanceEvent.tsx`) currently disables/hides the excuse-type selector for anything but `ExcusedAbsence`, extend that condition to also show it for `LateArrival` — same selector, same `excuseTypeService` catalog.

## Backend — `GetTeamPlayerStatistics.cs` (attendance ratio)

File: `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Queries/GetTeamPlayerStatistics.cs`

### DTO changes

Replace the two bare ints with a shared ratio shape, one per event type:
```csharp
public record AttendanceRatioDto(int Attended, int Possible);

public record PlayerStatisticsDto(
    string TeamPlayerId,
    string DisplayName,
    string? Position,
    int? Dorsal,
    int Goals,
    int YellowCards,
    int RedCards,
    int MinutesPlayed,
    AttendanceRatioDto Trainings,     // replaces TrainingsAttended
    AttendanceRatioDto Friendlies,    // new — was folded into MatchesPlayed
    AttendanceRatioDto League,        // replaces MatchesPlayed
    int? DaysSinceLastInjury,
    int? LastInjuryDurationDays,
    double PhysicalFitness,
    double Fatigue,
    double Availability,
    int? Readiness,
    ReadinessBreakdownDto? ReadinessBreakdown);
```
No other DTO changes. `MinutesPlayed`/`Goals`/cards stay sourced from `MatchParticipation` exactly as today (unaffected — they aggregate both friendly and league participations, which is already the desired "physical load" semantics, distinct from the new attendance ratio).

### Handler changes

1. Add the two other event-type ids next to the existing `trainingEventTypeId` (needs
   `using RFFM.Api.Features.Coaches.SportEvents.Queries;` for `SportEventsConstants`):
   ```csharp
   var trainingEventTypeId = SportEventType.FromName("Entrenamiento").Id;
   var leagueEventTypeId = SportEventsConstants.MatchEventTypeId;    // 1
   var friendlyEventTypeId = SportEventsConstants.FriendlyEventTypeId; // 4
   ```
2. Add `JoinedDate`/`LeftDate` to `TeamPlayerProjection` (both already exist on `TeamPlayer`):
   ```csharp
   private record TeamPlayerProjection(
       string Id, string? Alias, string Name, string? LastName, int? Dorsal,
       int ActivePositionId, DateTime JoinedDate, DateTime? LeftDate);
   ```
   and select them in the initial `teamPlayers` query.
3. Replace the training-only "season totals" block (current lines ~153-169) with one query
   covering all 3 event types, "finished" meaning `EveDateTime < DateTime.UtcNow`:
   ```csharp
   var finishedEvents = await db.SportEvents
       .AsNoTracking()
       .Where(se => se.TeamId == request.TeamId
                    && se.EveDateTime != null && se.EveDateTime < DateTime.UtcNow
                    && (se.EventTypeId == trainingEventTypeId
                        || se.EventTypeId == leagueEventTypeId
                        || se.EventTypeId == friendlyEventTypeId))
       .Select(se => new { se.Id, se.EventTypeId, se.EveDateTime })
       .ToListAsync(cancellationToken);

   var finishedEventIds = finishedEvents.Select(e => e.Id).ToList();
   var finishedEventById = finishedEvents.ToDictionary(e => e.Id, e => e);

   var convocationsForFinishedEvents = await db.Convocations
       .AsNoTracking()
       .Where(c => finishedEventIds.Contains(c.SportEventId))
       .Select(c => new { c.TeamPlayerId, c.SportEventId, c.AssistanceTypeId })
       .ToListAsync(cancellationToken);

   var attendedByPlayerAndType = convocationsForFinishedEvents
       .Where(c => c.AssistanceTypeId == AssistanceType.Attendance.Id
                   || c.AssistanceTypeId == AssistanceType.LateArrival.Id)
       .GroupBy(c => (c.TeamPlayerId, finishedEventById[c.SportEventId].EventTypeId))
       .ToDictionary(g => g.Key, g => g.Count());
   ```
4. Per player, compute "possible" as finished events of that type within `[JoinedDate, LeftDate ?? MaxValue]`:
   ```csharp
   int PossibleFor(int eventTypeId) => finishedEvents.Count(e =>
       e.EventTypeId == eventTypeId
       && e.EveDateTime >= player.JoinedDate
       && (player.LeftDate == null || e.EveDateTime <= player.LeftDate));

   int AttendedFor(int eventTypeId) =>
       attendedByPlayerAndType.TryGetValue((player.Id, eventTypeId), out var c) ? c : 0;

   var trainings = new AttendanceRatioDto(AttendedFor(trainingEventTypeId), PossibleFor(trainingEventTypeId));
   var friendlies = new AttendanceRatioDto(AttendedFor(friendlyEventTypeId), PossibleFor(friendlyEventTypeId));
   var league = new AttendanceRatioDto(AttendedFor(leagueEventTypeId), PossibleFor(leagueEventTypeId));
   ```
   This runs inside the existing per-player `foreach` loop (replace the old
   `trainingsAttendedByPlayer`/`matchesPlayed` lookups).
5. The 8-week windowed blocks (`trainingConvocationsInWindow`, `matchMinutesInWindowByPlayer`, used
   by `PlayerReadinessCalculator`) are untouched — separate concept ("Rodaje"), already event-type-scoped
   to trainings/any-match correctly.
6. Remove the now-dead `allTrainingEventIds`/`allTrainingConvocations`/`trainingsAttendedByPlayer`
   blocks (superseded by step 3-4) and the old `matchesPlayed = playerParticipations.Count` line.

## Frontend — stats display

### `teamPlayerStatisticsService.ts`
```ts
export type AttendanceRatio = { attended: number; possible: number };

export type PlayerStatistics = {
  // ...unchanged fields...
  trainings: AttendanceRatio;   // replaces trainingsAttended: number
  friendlies: AttendanceRatio;  // new
  league: AttendanceRatio;      // replaces matchesPlayed: number
};
```

### `SquadStatistics.tsx` (~line 229-238)
Replace the two bare-count tiles with three "X de Y" tiles:
```tsx
<div className={styles.statTile}>
  <span className={styles.statValue}>{player.trainings.attended} de {player.trainings.possible}</span>
  <span className={styles.statLabel}>Entrenamientos</span>
</div>
<div className={styles.statTile}>
  <span className={styles.statValue}>{player.friendlies.attended} de {player.friendlies.possible}</span>
  <span className={styles.statLabel}>Amistosos</span>
</div>
<div className={styles.statTile}>
  <span className={styles.statValue}>{player.league.attended} de {player.league.possible}</span>
  <span className={styles.statLabel}>Liga</span>
</div>
```
No CSS changes needed — same tile classes as the tiles being replaced.

## Frontend — live-match attendance/lateness visibility

### `useConvocationManagement.ts`
Alongside the existing `excuseInit`/`minutesReasonInit` construction (~line 259-266), add an
`assistanceInit` map and a new piece of state/return value `mgmtAssistanceMap: Record<string, number | null>`:
```ts
const assistanceInit: Record<string, number | null> = {};
for (const conv of convs) {
  const pid = conv.player.id ?? "";
  if (!pid) continue;
  assistanceInit[pid] = conv.assistanceTypeId ?? null;
}
// ...
setMgmtAssistanceMap(assistanceInit);
```
Add `mgmtAssistanceMap` to the hook's return object (next to `mgmtExcuseMap`).

### `SquadPlayer` type (`Front/src/apps/coach/pages/squad/components/IdealLineup.tsx`)
Add three optional fields:
```ts
assistanceTypeId?: number | null;
excuseTypeId?: number | null;
excuseReasonName?: string | null; // resolved name, not just the id
```
(`convocationStatusId` is not needed for this view — only accepted players reach `lineupPlayers`.)

### `useConvocationPlayerViews.ts`
Add `assistanceMap`, `excuseMap`, `excuseTypesById` to `ConvocationPlayersInput`, and set the three
new fields on every mapped player in `lineupPlayers` (bench + on-field players are both sourced from
here — `notCalledPlayers`/`pendingPlayers` don't need it, they already show their own status):
```ts
assistanceTypeId: assistanceMap?.[p.id] ?? null,
excuseTypeId: excuseMap?.[p.id] ?? null,
excuseReasonName: excuseMap?.[p.id] != null ? excuseTypesById?.get(excuseMap[p.id]!)?.name ?? null : null,
```
`ConvocationMatchDetail.tsx` passes `convocation.mgmtAssistanceMap`, `convocation.mgmtExcuseMap`,
`convocation.excuseTypesById` (build a `Map` from `convocation.excuseTypes` once with `useMemo`, same
pattern as `matchAttendanceState.ts`'s `excuseTypesById`) into the `useConvocationPlayerViews` call.

### `BenchPlayerCard.tsx`
Replace the bare `—` (line ~110) with a status-aware badge. Reuse `AssistanceType` ids as plain
numbers (2 = ExcusedAbsence, 3 = UnexcusedAbsence, 4 = LateArrival — mirror the backend SmartEnum ids,
no import needed, same convention as existing `NOT_CALLED_STATUS_ID` numeric constants in
`useConvocationManagement.ts`):
```tsx
{!isLeaving ? (
  hasPlayed ? (
    <span className={styles.benchMinTag}>{minutesPlayed}&apos;</span>
  ) : player.assistanceTypeId === 2 || player.assistanceTypeId === 3 ? (
    <span
      className={styles.benchAbsentTag}
      title={player.excuseReasonName ?? undefined}
    >
      {player.assistanceTypeId === 2 ? "No asistió (justificado)" : "No asistió"}
      {player.excuseReasonName ? ` · ${player.excuseReasonName}` : ""}
    </span>
  ) : player.assistanceTypeId === 4 ? (
    <span className={styles.benchLateTag} title={player.excuseReasonName ?? undefined}>
      Llegó tarde{player.excuseReasonName ? ` · ${player.excuseReasonName}` : ""}
    </span>
  ) : (
    <span className={styles.benchNoPlayTag}>—</span>
  )
) : (
  <span className={styles.benchCardSaleBadge}>SALE</span>
)}
```
New CSS rules `.benchAbsentTag`/`.benchLateTag` in `SimulacionTab.module.css`, same visual weight as
`.benchMinTag` (small pill), distinct colors (e.g. muted red for absent, amber for late — reuse
`MATCH_STATE_RGB`-style palette already established in `matchAttendanceState.ts`, don't invent new
hexes without checking the theme first per `react.md` §5).

This single change to `BenchPlayerCard.tsx` covers all 6 render sites in `PartidoEnDirectoTab.tsx`
and `SimulacionTab.tsx` — no changes needed in either tab file besides passing the new fields through
already-existing `SquadPlayer` objects (which they already receive whole from the views hook).

## Tests to add/update

- Backend: `GetTeamPlayerStatisticsHandlerTests.cs` (or new file if none exists) — seed finished/future
  events of all 3 types, a player who joined mid-season (possible excludes pre-join events), attendance
  via `Attendance`/`LateArrival` counted, `ExcusedAbsence`/`UnexcusedAbsence`/no-convocation not counted;
  assert `Trainings`/`Friendlies`/`League` ratios independently.
- Backend: `UpdateConvocationAssistanceHandlerTests.cs` — new case: `LateArrival` + `ExcuseTypeId` set
  persists the excuse; `LateArrival` without `ExcuseTypeId` leaves it null (no regression).
- Frontend: `SquadStatistics.test.tsx` — assert "X de Y" rendering for all three tiles.
- Frontend: `BenchPlayerCard.test.tsx` (new or extended) — assert absent/late badges render with reason
  text when `assistanceTypeId`/`excuseReasonName` are set, and the existing `—`/minutes behavior is
  unchanged when they're not.
- Frontend: `useConvocationPlayerViews.test.tsx` — assert the new fields flow from `assistanceMap`/
  `excuseMap` into `lineupPlayers`.
