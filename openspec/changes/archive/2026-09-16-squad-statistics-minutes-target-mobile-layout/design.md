## Backend

### 1. `Domain/Aggregates/Assistances/ExcusesType.cs`
`TechnicalDecision` is `private static readonly` — make it `public static readonly` (same pattern as
`SportiveSanction`) so the new query can reference `ExcuseTypes.TechnicalDecision.Id` instead of a
magic `7`. No other change to this file.

### 2. New `Domain/Entities/Competitions/MatchDurationMinutesByCategory.cs`
Static lookup, same shape as `Category`/`AssistanceType` (private dict + public static instances),
mapping `Category.Id` → standard F11 match duration in minutes. Only the 4 F11 categories are
registered; `TryGetMinutes(int categoryId, out int minutes)` returns `false` for any other category
(Nacional/Aficionados/Benjamín/Prebenjamín/Debutante — no F7/F11 distinction exists on `Team`
today per the research, so we scope explicitly by category id, not by play type):

```csharp
public static class MatchDurationMinutesByCategory
{
    private static readonly Dictionary<int, int> Minutes = new()
    {
        [Category.Youth.Id] = 45, // Juveniles
        [Category.U14.Id] = 40,   // Cadetes
        [Category.U12.Id] = 35,   // Infantiles
        [Category.U10.Id] = 30,   // Alevines
    };

    public static bool TryGetMinutes(int categoryId, out int minutes) => Minutes.TryGetValue(categoryId, out minutes);
}
```

### 3. `Features/Coaches/Players/Queries/GetTeamPlayerStatistics.cs`
Reuse `SportEventsConstants.{MatchEventTypeId,FriendlyEventTypeId,TournamentEventTypeId}` (already
defined in `Features/Coaches/SportEvents/Queries/SportEventsConstants.cs`) as the "match-like" event
type set — same 3 ids the season-stats/live-match features already treat as match events.

**New query steps** (added to `Handler.Handle`, alongside the existing training-window logic):

1. Load `db.Teams.Where(t => t.Id == request.TeamId).Select(t => t.CategoryId).SingleAsync()` once.
   `MatchDurationMinutesByCategory.TryGetMinutes(categoryId, out var standardMinutes)` — if `false`,
   every new minutes-target field on the DTO is `null` for this team (non-F11 category).
2. Load all finished match-like `SportEvent`s for the team this season:
   `db.SportEvents.Where(se => se.TeamId == teamId && matchTypeIds.Contains(se.EventTypeId))`
   joined against `finishedParticipations` (already loaded) grouped by `EventId`.
3. Per event, `matchDurationMinutes = Math.Min(standardMinutes, participations.Max(p => p.MinutesPlayed))`
   — skip events with zero participations (nothing recorded yet, e.g. future fixtures already
   created but not played) since `MatchParticipation` rows only exist for `MatchPhase == "finished"`.
   `SeasonTotalPossibleMinutes` = sum of `matchDurationMinutes` over all such events.
4. Load all `Convocation`s for match-like events for this team (`SportEventId` in the match-like
   event id set), same projection shape as `GetTrainingAttendanceSummary` (`AssistanceTypeId`,
   `ConvocationStatusId`, `ExcuseTypeId`, `TeamPlayerId`, `SportEventId`).
5. Per player, `attributableAbsences` = convocations where:
   `AssistanceTypeId is ExcusedAbsence or UnexcusedAbsence` **OR**
   `(AssistanceTypeId == null AND ConvocationStatusId is Justified or Deconvoke AND ExcuseTypeId != ExcuseTypes.TechnicalDecision.Id)`.
   (No `Convocation` row at all ⇒ never called up ⇒ not counted, matches existing
   `GetTrainingAttendanceSummary` denominator semantics. `ExcuseTypeId == TechnicalDecision.Id` ⇒
   coach's call ⇒ not counted.)
   `MatchesAbsentAttributableToPlayer` = count of these. `AttributableAbsentMinutes` = sum of
   `matchDurationMinutes` (from step 3) for the specific events in this set.
6. Per player (only when `standardMinutes` was resolved in step 1):
   `MinutesPlayedPercentOfSeasonTotal = SeasonTotalPossibleMinutes == 0 ? null : Math.Round(100.0 * minutesPlayed / SeasonTotalPossibleMinutes, 1)`
   `AttributableAbsentMinutesPercentOfSeasonTotal = SeasonTotalPossibleMinutes == 0 ? null : Math.Round(100.0 * AttributableAbsentMinutes / SeasonTotalPossibleMinutes, 1)`

**`PlayerStatisticsDto` additions** (append at the end, keep existing positional params intact —
this is a `record` used positionally on the frontend TS type, not by name, so appending is safe):

```csharp
int MatchesAbsentAttributableToPlayer,
double? MinutesPlayedPercentOfSeasonTotal,        // null when team category isn't F11
double? AttributableAbsentMinutesPercentOfSeasonTotal, // null when team category isn't F11
const int SeasonMinutesTargetPercent = 30;         // exposed as a constant, not per-DTO field — see below
```

`SeasonMinutesTargetPercent` is a fixed constant (30), not data — expose it as a literal in the
frontend instead of a backend field (matches how `PlayerReadinessCalculator.BaselineTrainings` etc.
are backend-only constants already surfaced via `ReadinessBreakdownDto`, but this one has no
per-player variance so no DTO field is needed).

### 4. xUnit tests
New `GetTeamPlayerStatistics` test cases (existing test file, if any, else new
`Features/Coaches/Players/Queries/GetTeamPlayerStatisticsTests.cs` following the functional-test
pattern in `.claude/rules/testing.md` §4): F11 team with a finished official match + a shorter
finished friendly (duration capped by `MAX(MinutesPlayed)`), a player never convoked (excluded), a
player deconvoked by `TechnicalDecision` (excluded), a player deconvoked by `Injury` (included), a
player convoked who no-showed (`UnexcusedAbsence`, included); non-F11 team asserts all 3 new
percent/absence-minutes fields are `null` while `MatchesAbsentAttributableToPlayer` is still
computed (it doesn't depend on category).

## Frontend

### 1. `teamPlayerStatisticsService.ts`
Add to `PlayerStatistics` type: `matchesAbsentAttributableToPlayer: number`,
`minutesPlayedPercentOfSeasonTotal: number | null`,
`attributableAbsentMinutesPercentOfSeasonTotal: number | null`. Add local constant
`SEASON_MINUTES_TARGET_PERCENT = 30` (co-located, since it's the counterpart of the backend
constant and has no reason to round-trip through the API).

### 2. `SquadStatistics.tsx`
- Default sort: `useState<SortKey>("ef")` (was `"readiness"`).
- New card block after `.statsRow` (or folded into it): "Ausencias" stat item showing
  `matchesAbsentAttributableToPlayer` next to the existing "Partidos" stat.
- New minutes-progress block, rendered only when `minutesPlayedPercentOfSeasonTotal != null`
  (F11 team): a thin progress indicator showing `minutesPlayedPercentOfSeasonTotal` against the
  30% target line, plus a caption `"De ese hueco, X% (N partidos) por ausencia propia"` using
  `attributableAbsentMinutesPercentOfSeasonTotal` and `matchesAbsentAttributableToPlayer`. Reuse the
  existing `.progressBar` CSS class pattern (already used by `readinessBar`) rather than inventing a
  new bar component.

### 3. `SquadStatistics.module.css` — mobile fixes
- `.sortControl` at `≤600px`: wrap the `ToggleButtonGroup` in a horizontally-scrollable strip
  (`overflow-x: auto`, `-webkit-overflow-scrolling: touch`) instead of relying on `flex-wrap`,
  since `ToggleButtonGroup` renders its buttons as a single non-wrapping row internally — wrapping
  the *container* only wraps the label/icon-button siblings, not the button group's own children,
  which is the actual overflow source today.
- `.positionFilter` at `≤600px`: change `min-width: 0` → `min-width: 120px` (keeps the label
  "Posición" and a couple of characters of the selected value legible) and let it share the row via
  `flex: 1 1 120px` on `.toolbarRight` children instead of shrinking to intrinsic content width.

### 4. `squadStatsPdfExport.ts`
Add two columns — "Forma" (`physicalFitness`, `${Math.round(v)}%`) and "Cansancio" (`fatigue`,
`${Math.round(v)}%`) — after "Rodaje". Switch `orientation` from `"portrait"` to `"landscape"` (A4
landscape `CW` ≈ 782pt vs current 545pt) so the existing 8 columns keep their widths and the 2 new
ones fit without cramping "Jugador"/"Posición". Recompute `cols` widths to sum to the new `CW`.

### 5. Vitest tests
- `SquadStatistics.sortAndFilter.test.tsx`: update default-sort assertion to `"ef"`.
- New assertions in a stats-card test (existing `SquadStatistics.trainingsMatchesInjury.test.tsx`
  or a new co-located file) for the "Ausencias" stat and the minutes-progress block, including the
  "block hidden when percent fields are null" case (non-F11 team).
- `squadStatsPdfExport.test.ts`: assert "Forma"/"Cansancio" column headers and values appear;
  landscape orientation.

## Non-goals
- No change to `F11 vs F7` modeling on `Team`/`PlayType` — categories are hardcoded by id per the
  research finding that `PlayType` is unwired today; wiring it up is out of scope.
- No change to the training-side attendance ratio (already covered by the existing
  `player-attendance-ratio-and-live-match-status` change).
