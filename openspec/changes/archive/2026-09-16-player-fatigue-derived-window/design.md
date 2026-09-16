## Context

- `PlayerReadinessCalculator` (`Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Services/PlayerReadinessCalculator.cs`)
  is the reference pattern: a pure, stateless function that takes lists of real events
  (`TrainingOutcome[]`, `matchMinutes[]`) already filtered to a rolling window by the caller,
  and returns a 0-100 score as a weighted combination of a training component and a match
  component. No EF/DB access, no persisted checkpoint, no explicit "rest day" concept — a gap
  in the calendar simply produces no events in the window, with no penalty and no state to
  accumulate.
- The current `Cansancio`/`Forma física` model (`PlayerConditionDayEffect` +
  `PlayerConditionRecalculationService` + `Domain/Entities/TeamPlayers/TeamPlayerCondition.cs`)
  is the opposite: a persisted checkpoint (`PhysicalFitness`, `Fatigue`,
  `LastCalculatedDate`) advanced day-by-day from the last checkpoint to today, treating every
  day without a registered training/match as "Rest" with a fixed negative delta
  (`RestFitnessDelta = -2`, `RestFatigueDelta = -4.64`), `Math.Clamp(0, 100)` each day. This is
  the root cause of the bug: see the numeric balance below.
- `GetTeamPlayerStatistics.cs` (`Features/Coaches/Players/Queries/`) is the only consumer of
  both models. It already computes, for a different purpose, an 8-week window of training
  convocations and match minutes for `PlayerReadinessCalculator`
  (`trainingConvocationsByPlayer`, `matchMinutesInWindowByPlayer`) — those cannot be reused
  directly for fatigue because the window length differs (7 days vs 8 weeks), but the query
  shape (same `Convocations`/`MatchParticipations`/`SportEvents` joins, filtered by
  `EveDateTime >= windowStart`) is identical and gets duplicated with a 7-day `windowStart`.
- `PhysicalFitness`/`Availability` have no visual consumer beyond the PDF export
  (`squadStatsPdfExport.ts`, being retired in parallel by the frontend agent) — confirmed by
  the user; both fields are removed outright rather than also converted to a derived
  calculation.
- `.\manage-migrations.ps1` (from `Back/ExtractionApi`, startup project `RFFM.Host`) generates
  EF migrations.

### Root-cause numeric balance (why the old model always converges to 0)

Real training cadence: 2 sessions/week (Tuesday/Thursday), matches not every week. Take the
best realistic case — a fully committed player who never misses a training and plays a full
70-minute match every week:

```
Weekly fatigue gain  = 2 × TrainingFatigueDelta + FullMatchFatigueDelta
                      = 2 × 5 + 10 = 20
Weekly fatigue loss  = 5 rest days × RestFatigueDelta
                      = 5 × (-4.64) = -23.2
Net weekly delta     = 20 - 23.2 = -3.2 / week
```

Even the *best possible* player loses net fatigue every week and is clamped at 0 within a few
weeks. `PhysicalFitness` has the same shape (`RestFitnessDelta = -2` vs
`TrainingFitnessDelta = 3` × 2/week = 6, `FullMatchFitnessDelta = 2` — net loss is smaller but
still frequently negative for realistic attendance). No tuning of the daily constants fixes
this without either removing the "rest day always costs" assumption or matching the constants
to the exact real cadence so precisely that any deviation (holidays, a skipped session) tips it
negative again — fundamentally the wrong model for a value that must reflect *recent load*, not
a lifetime balance.

## Goals / Non-Goals

**Goals:**
- Replace the persisted/incremental `Fatigue` with a derived, stateless calculation using the
  same architectural pattern as `PlayerReadinessCalculator`.
- Guarantee `Fatigue` reflects the last 7 days of real activity and never "gets stuck" at 0
  regardless of how long ago the player last had no activity.
- Remove `PhysicalFitness`/`Availability` entirely (no replacement) — dead weight with no
  consumer once the PDF export is retired.

**Non-Goals:**
- No replacement/derived calculation for `PhysicalFitness`/`Availability` — they are deleted,
  not migrated.
- No historical backfill — like Rodaje, `Fatigue` is always computed fresh from current data,
  there is nothing to backfill.
- No change to `PlayerReadinessCalculator`/Rodaje itself.
- No injury-risk modeling derived from high fatigue (same non-goal as the original,
  now-archived change).

## Decisions

### Decisión 1 — `PlayerFatigueCalculator` (pure, stateless, 7-day window)

New file `Features/Coaches/Players/Services/PlayerFatigueCalculator.cs`, same shape as
`PlayerReadinessCalculator`:

```csharp
public static class PlayerFatigueCalculator
{
    public const int WindowDays = 7;                 // covers one Tue/Thu training cycle + a weekend match
    public const int ReferenceTrainingsPerWindow = 2; // real cadence: trains Tuesday and Thursday
    public const int ReferenceMatchMinutes = 70;      // same reference as PlayerReadinessCalculator
    public const double TrainingWeight = 0.40;
    public const double MatchWeight = 0.60;

    public record Result(
        int Fatigue,               // 0-100, always has a value (0 when no events in window)
        double TrainingComponent,  // 0-100
        double MatchComponent,     // 0-100
        int TrainingsAttendedInWindow,
        int MatchMinutesInWindow);

    public static Result Calculate(
        int trainingsAttendedInWindow, int matchMinutesInWindow)
    {
        var trainingComponent = Math.Min(100d,
            trainingsAttendedInWindow / (double)ReferenceTrainingsPerWindow * 100d);
        var matchComponent = Math.Min(100d,
            matchMinutesInWindow / (double)ReferenceMatchMinutes * 100d);
        var fatigue = (int)Math.Round(TrainingWeight * trainingComponent + MatchWeight * matchComponent);
        return new Result(fatigue, trainingComponent, matchComponent, trainingsAttendedInWindow, matchMinutesInWindow);
    }
}
```

`trainingsAttendedInWindow` is a plain count of distinct training days with real attendance
(`AssistanceType.Attendance`/`LateArrival`, same definition as Rodaje) inside the 7-day window
— the handler computes it from the same `Convocation` shape already used for Rodaje, just
windowed to 7 days instead of 8 weeks. `matchMinutesInWindow` is the sum of `MinutesPlayed`
from finished `MatchParticipation` rows in the same 7-day window, across any match-like event
(Partido/Amistoso/Torneo) — same criterion as Rodaje's match component post-Addendum 4 (no
event-type filtering beyond "match-like").

Unlike Rodaje, `Fatigue` is **never** `int?` — it is always `int`, defaulting to 0 with no
events, because that was the pre-existing contract (`fatigue: number`, non-nullable, in
`teamPlayerStatisticsService.ts`) and the frontend is not being changed to handle a null case
here.

**7-day window example — why it doesn't get stuck at 0 like the old model:**

A player training Tuesday/Thursday and playing a full 70' match on Sunday, evaluated any day
of the week (7-day trailing window always contains exactly one full Tue/Thu pair once past
Thursday, and the most recent Sunday match once past Sunday):

```
TrainingComponent = min(100, 2/2 × 100)  = 100
MatchComponent    = min(100, 70/70 × 100) = 100
Fatigue           = round(0.40 × 100 + 0.60 × 100) = 100
```

A player who only trains (no match that week):

```
TrainingComponent = 100
MatchComponent    = 0
Fatigue           = round(0.40 × 100 + 0.60 × 0) = 40
```

Because the window is derived fresh from the last 7 days every time the query runs — no
carried-over state, no daily decay when nothing happens — a player who goes quiet for a month
and then resumes training immediately shows a normal `Fatigue` again on the very next
evaluation, instead of being pinned at 0 forever.

### Decisión 2 — Training/Match weight: 40/60, not 70/30 like Rodaje (deviation, documented)

Rodaje's 70% training / 30% match weighting exists to measure *recent familiarity/involvement
with the team* — consistent attendance matters more than a single match. `Cansancio` measures
something different: *physical load*. Per-minute, a match is materially more taxing than a
training session — the user explicitly asked to consider this rather than copy Rodaje's
weights blindly.

Reasoning for 40/60 (training/match): a typical youth training session runs ~90 minutes, so the
reference "full training week" (2 sessions) represents ~180 minutes of low-to-moderate
intensity activity, reaching 100% of `TrainingComponent`. The reference match is 70 minutes at
much higher intensity, reaching 100% of `MatchComponent`. Per-minute, the match's contribution
to its own component is ~2.5× training's (100/70 ≈ 1.43 pts/min vs 100/180 ≈ 0.56 pts/min).
Weighting the match component higher (60% vs Rodaje's 30%) reflects that a single full match
should move `Fatigue` more than reaching the training baseline alone — confirmed against the
worked examples above (full week with match → 100; full week without match → 40, a
meaningfully lower "tired" reading that still shows real training load, not 0).

This is a judgment call, not a value confirmed numerically by the user beyond "un partido cansa
más por minuto que un entreno" — flagged here explicitly in case product wants to tune it
later. `TrainingWeight`/`MatchWeight` are named constants precisely so this is a one-line change
if revisited.

### Decisión 3 — No same-day match+training de-duplication needed

`PlayerConditionRecalculationService` had to resolve "a day with both a match and a training"
by making the match win (a single `DayEvent` per day, since the model advances *per day*).
`PlayerFatigueCalculator` has no such conflict: `TrainingsAttendedInWindow` and
`MatchMinutesInWindow` are independent sums over the whole window (not a per-day exclusive
state), so a day with both a training convocation and a match participation simply contributes
to both components — no special case needed. This is evaluated and confirmed safe, not ported
from the old service.

### Decisión 4 — Handler wiring: separate 7-day window queries, remove `PlayerConditionRecalculationService`

`GetTeamPlayerStatistics.Handler` currently injects `PlayerConditionRecalculationService` (DB
service, called once per player in the per-player loop — an N+1 query pattern already, since
`RecalculateAsync` does its own `SportEvents`/`Convocations`/`MatchParticipations` queries per
call). This is removed entirely. In its place, mirroring the existing 8-week windowed queries
for Rodaje (`trainingEventsInWindow`, `trainingConvocationsInWindow`,
`matchEventIdsInWindow`/`participationsInWindow`), the handler adds a second, independent set of
queries scoped to a 7-day `fatigueWindowStart = DateTime.UtcNow.AddDays(-PlayerFatigueCalculator.WindowDays)`,
producing per-player `trainingsAttendedInFatigueWindow` (distinct training days with real
attendance) and `matchMinutesInFatigueWindow` dictionaries, computed once for all players
up-front (not per-player DB calls). `PhysicalFitness`/`Availability` and their handler lines
(`conditionService.RecalculateAsync(...)`, `availability = Math.Max(...)`) are deleted.

### Decisión 5 — `TeamPlayerCondition` and friends: deleted, not deprecated

Per the user's explicit product decision: delete `Domain/Entities/TeamPlayers/TeamPlayerCondition.cs`,
`Infrastructure/Persistence/Configuration/Entities/TeamPlayerConditionEntityConfiguration.cs`,
`Features/Coaches/Players/Services/PlayerConditionDayEffect.cs`,
`Features/Coaches/Players/Services/PlayerConditionRecalculationService.cs`, the `DbSet` in
`AppDbContext`, and generate an EF migration (`RemoveTeamPlayerCondition`) dropping the
`TeamPlayerConditions` table. The persisted history is not trustworthy (pinned at 0), so there
is no real data loss.

## Risks / Trade-offs

- [Risk] The 7-day window means a player who trained Tuesday but is evaluated Wednesday before
  Thursday's session only has 1/2 trainings in-window → `Fatigue` looks artificially low
  mid-week even for a fully compliant player. → Mitigation: same characteristic already exists
  in Rodaje (windowed metrics are inherently a snapshot, not a running average); acceptable and
  expected — `Fatigue` is meant to read as "current load", which legitimately dips between
  sessions.
- [Risk] 40/60 weighting is a reasoned judgment call, not a user-confirmed exact ratio. →
  Mitigation: documented here explicitly (Decisión 2) as a decision the user can revisit; named
  constants make retuning trivial.
- [Risk] Dropping `TeamPlayerConditions` is irreversible for any historical row (all pinned at
  0/100 anyway). → Mitigation: confirmed acceptable by the user — no value in that data.
- [Risk] Removing `PhysicalFitness`/`Availability` from the backend DTO before the frontend
  change lands would break the frontend build (`PlayerCromo.tsx`, `IdealLineup.tsx` reference
  them as optional props already, but `teamPlayerStatisticsService.ts` declares them
  non-optional). → Mitigation: explicitly out of scope for this backend-only change per the
  user's instructions; coordinated in parallel with a separate frontend agent job. This design
  does not touch `Front/`.

## Migration Plan

1. TDD: write `PlayerFatigueCalculatorTests.cs` (Red), implement `PlayerFatigueCalculator.cs`
   (Green).
2. Update `GetTeamPlayerStatistics.cs`: add 7-day fatigue window queries, replace
   `PlayerConditionRecalculationService` usage with `PlayerFatigueCalculator.Calculate(...)`,
   remove `PhysicalFitness`/`Availability` from `PlayerStatisticsDto` and its construction.
3. Delete `TeamPlayerCondition.cs`, `TeamPlayerConditionEntityConfiguration.cs`,
   `PlayerConditionDayEffect.cs`, `PlayerConditionRecalculationService.cs`, and the `DbSet` in
   `AppDbContext`.
4. Delete/rewrite obsolete tests (`PlayerConditionDayEffectTests.cs`,
   `PlayerConditionRecalculationServiceTests.cs`, `TeamPlayerConditionTests.cs`); update
   `GetTeamPlayerStatisticsHandlerTests.cs` to drop `PhysicalFitness`/`Availability` assertions.
5. Generate EF migration `RemoveTeamPlayerCondition` via `.\manage-migrations.ps1` (drops
   `TeamPlayerConditions` table).
6. `dotnet build` + `dotnet test` green.
7. No rollback path needed beyond reverting the commit + a compensating migration if ever
   required — acceptable given the data has no value (see Risks).

## Open Questions

- Should the 40/60 training/match weighting for `Fatigue` be confirmed numerically with the
  user before shipping, or is the documented reasoning in Decisión 2 sufficient? (Proceeding
  with 40/60 per the reasoning above; easy to retune via the named constants if the user
  disagrees after seeing it in the app.)
