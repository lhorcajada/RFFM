## Context

`SportEvent` (`Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Assistances/SportEvent.cs`) is a flat `BaseEntity` with no notion of a series. `CreateSportEvent.cs` is a minimal-API vertical slice that does **not** use Mediator/`ICommand` today — the endpoint delegate builds the entity and saves directly against `AppDbContext`. This is the nearest sibling pattern and this change keeps that shape rather than introducing Mediator here as a drive-by refactor (out of scope; would bloat the diff for an unrelated concern). `CreateSportEventRequest`/`CreateSportEventValidator`/`SportEventSaveResponse` all live in the same file per the vertical-slice rule — the recurrence fields are added to that same file, not a new one.

## Goals / Non-Goals

**Goals**
- Model master + instances so a later change can implement per-instance vs per-series edit/delete without another migration.
- Validate the 52-instance cap with a clear FluentValidation error before touching the database.
- Ship an EF Core migration against `AppDbContext` (`CatalogConnection`).

**Non-Goals**
- Mediator/CQRS conversion of `CreateSportEvent` (stays a minimal-API delegate, consistent with the existing file).
- Any instance-level edit/delete endpoint.
- Frontend changes.

## Decisions

### 1. Data model: `EventRecurrence` aggregate + `SportEvent.RecurrenceId`

New entity, new file `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Assistances/EventRecurrence.cs`:

```csharp
public class EventRecurrence : BaseEntity
{
    public int FrequencyId { get; private set; }          // RecurrenceFrequency.Id
    public DateTime EndDate { get; private set; }          // date-only, UTC midnight
    public string MasterEventId { get; private set; } = null!;
    public int InstanceCount { get; private set; }         // total SportEvents generated, incl. master

    public SportEvent MasterEvent { get; set; } = null!;
    public List<SportEvent> Events { get; set; } = null!;  // master + instances, via SportEvent.RecurrenceId

    private EventRecurrence() { }

    public static EventRecurrence Create(RecurrenceFrequency frequency, DateTime endDate, string masterEventId, int instanceCount)
    {
        if (endDate == default) throw new ArgumentException("La fecha final de la recurrencia no puede estar vacía");
        if (string.IsNullOrEmpty(masterEventId)) throw new ArgumentException("El evento maestro no puede estar vacío");
        if (instanceCount is < 1 or > RecurrenceConstants.MaxInstances)
            throw new ArgumentException($"Una serie recurrente no puede generar más de {RecurrenceConstants.MaxInstances} eventos");

        return new EventRecurrence
        {
            FrequencyId = frequency.Id,
            EndDate = endDate,
            MasterEventId = masterEventId,
            InstanceCount = instanceCount,
        };
    }
}

public static class RecurrenceConstants
{
    public const int MaxInstances = 52;
}
```

`SportEvent` gains two nullable-by-default members (both new columns, additive migration):

```csharp
public string? RecurrenceId { get; set; }
public bool IsRecurrenceMaster { get; set; }
public EventRecurrence? Recurrence { get; set; }
```

- `RecurrenceId == null` → a normal, non-recurring event (today's behavior, unaffected).
- `RecurrenceId != null && IsRecurrenceMaster == true` → the first event of the series (`EventRecurrence.MasterEventId` points back at it).
- `RecurrenceId != null && IsRecurrenceMaster == false` → a generated instance.

This "master is just an event with a flag" shape (rather than a separate master-only table) matches how `SportEvent` is already queried as a flat list in `GetSportEvents`/`GetSportEventItem` — every instance, including the master, shows up in the coach's calendar the same way, no query changes needed there. A future "delete whole series" endpoint filters `SportEvents.Where(e => e.RecurrenceId == recurrenceId)`; "delete this instance only" targets a single `Id` — both are straightforward with this shape, satisfying the proposal's forward-compatibility requirement without adding it now.

**Alternative considered**: a self-referencing `SportEvent.ParentEventId` with no separate `EventRecurrence` table. Rejected because frequency + end-date are properties of the *series*, not of any one event; storing them on the master row works but leaves no natural place for series-level metadata (e.g. a future "series name" or cancellation timestamp) without repurposing event columns.

### 2. `RecurrenceFrequency` enum: hand-rolled, mirrors `SportEventType`

The repo's own convention doc says "never raw `int` enums, use `Ardalis.SmartEnum`," but the *actual* nearest sibling (`SportEventType.cs`) is a hand-rolled static-instance class, not an `Ardalis.SmartEnum<T>` subclass — no `SmartEnum<T>` type exists anywhere in this codebase today (`SmartEnum.EFCore`'s `ConfigureSmartEnum()` is called in `AppDbContext` but has nothing registered to configure). Per the "mirror the nearest sibling" instruction, `RecurrenceFrequency` copies `SportEventType`'s exact shape for consistency with the code it sits next to, rather than introducing the first real `Ardalis.SmartEnum<T>` in the codebase as a drive-by:

```csharp
// Domain/Aggregates/Assistances/RecurrenceFrequency.cs
public class RecurrenceFrequency
{
    private static readonly RecurrenceFrequency Daily = new(1, "Diaria");
    private static readonly RecurrenceFrequency Weekly = new(2, "Semanal");
    private static readonly RecurrenceFrequency Monthly = new(3, "Mensual");

    public int Id { get; }
    public string Name { get; }
    private RecurrenceFrequency(int id, string name) { Id = id; Name = name; }

    public static IEnumerable<RecurrenceFrequency> List() => new[] { Daily, Weekly, Monthly };
    public static RecurrenceFrequency From(int id) => List().SingleOrDefault(f => f.Id == id)
        ?? throw new ArgumentException($"Possible values for RecurrenceFrequency: {string.Join(",", List().Select(f => f.Name))}");
    public static RecurrenceFrequency FromCode(string code) => code?.ToLowerInvariant() switch
    {
        "daily" => Daily,
        "weekly" => Weekly,
        "monthly" => Monthly,
        _ => throw new ArgumentException("Possible values for Recurrence.Frequency: daily, weekly, monthly"),
    };

    public DateTime Next(DateTime from) => Id switch
    {
        1 => from.AddDays(1),
        2 => from.AddDays(7),
        3 => from.AddMonths(1),
        _ => throw new InvalidOperationException(),
    };
}
```

The wire format uses the lowercase string codes (`"daily" | "weekly" | "monthly"`) rather than raw ints, so the frontend never has to hardcode magic numbers — consistent with how `EventTypeId` is an int today but is always resolved via a `GET .../event-types` catalog endpoint on the frontend (`SportEventTypesConstants`/`SportEventTypes.cs`); recurrence gets the string-code treatment instead since there's no separate catalog endpoint planned for just 3 fixed values.

### 3. API contract — extending `POST /api/sport-events`

`CreateSportEventRequest` (same file, `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/SportEvents/Commands/CreateSportEvent.cs`) gains one new optional field:

```csharp
public record CreateSportEventRequest(
    string Name,
    DateTime EveDateTime,
    DateTime? StartTime,
    DateTime? EndTime,
    DateTime? ArrivalDate,
    string? Location,
    string? Description,
    int EventTypeId,
    string TeamId,
    string? RivalId,
    bool? IsHomeMatch,
    string? CodActa,
    RecurrenceRequest? Recurrence   // NEW
);

public record RecurrenceRequest(
    string Frequency,   // "daily" | "weekly" | "monthly"
    DateTime EndDate     // date-only; time-of-day ignored, master's time is reused for every instance
);
```

Request body, recurring example:

```json
{
  "name": "Entrenamiento semanal",
  "eveDateTime": "2026-08-03T18:00:00Z",
  "startTime": "2026-08-03T18:00:00Z",
  "eventTypeId": 2,
  "teamId": "team-123",
  "recurrence": { "frequency": "weekly", "endDate": "2026-12-15" }
}
```

Response (`SportEventSaveResponse`) gains three fields describing the series, so the frontend can show "se crearon 20 eventos" without a follow-up query:

```csharp
public record SportEventSaveResponse(
    string Id, string Name, DateTime EveDateTime, DateTime StartTime, DateTime? EndTime,
    DateTime? ArrivalDate, string? Location, string? Description, int EventTypeId,
    string TeamId, string? RivalId, bool IsHomeMatch, string? CodActa,
    string? RecurrenceId,          // NEW — null if not recurring
    bool IsRecurrenceMaster,       // NEW
    int? RecurrenceInstanceCount   // NEW — total events generated (incl. master), null if not recurring
);
```

The endpoint continues to return only the **master** event's data (HTTP 200/`Results.Ok`) — instances are persisted but not individually echoed back; the frontend picks them up through the existing `GET /api/sport-events/{teamId}` calendar query, which needs no changes since instances are ordinary `SportEvent` rows.

### 4. Handler logic

Inside the existing `app.MapPost("/api/sport-events", ...)` delegate, after the master `SportEvent` is constructed (unchanged) and before `SaveChangesAsync`:

```csharp
SportEvent[] instances = Array.Empty<SportEvent>();
EventRecurrence? recurrence = null;

if (req.Recurrence is not null)
{
    var frequency = RecurrenceFrequency.FromCode(req.Recurrence.Frequency);
    var dates = new List<DateTime>();
    var cursor = ev.EveDateTime;
    while (cursor <= DateTime.SpecifyKind(req.Recurrence.EndDate, DateTimeKind.Utc))
    {
        dates.Add(cursor);
        cursor = frequency.Next(cursor);
    }
    // dates[0] is the master's own date; validator already rejected dates.Count > 52
    recurrence = EventRecurrence.Create(frequency, req.Recurrence.EndDate, ev.Id, dates.Count);
    ev.RecurrenceId = recurrence.Id;
    ev.IsRecurrenceMaster = true;

    instances = dates.Skip(1)
        .Select(d => SportEvent.CreateNew(
            ev.Name, d, d.Add(ev.StartTime - ev.EveDateTime),
            ev.EndTime.HasValue ? d.Add(ev.EndTime.Value - ev.EveDateTime) : null,
            ev.ArrivalDate.HasValue ? d.Add(ev.ArrivalDate.Value - ev.EveDateTime) : null,
            ev.Location, ev.Description, ev.EventTypeId, ev.TeamId, ev.RivalId,
            ev.IsHomeMatch, null /* codActa is per-match, not copied */))
        .ToArray();
    foreach (var i in instances) { i.RecurrenceId = recurrence.Id; }
}

db.SportEvents.Add(ev);
if (recurrence is not null) db.EventRecurrences.Add(recurrence);
db.SportEvents.AddRange(instances);
await db.SaveChangesAsync(cancellationToken);
```

Note: the recurrence-count validation (see §5) runs in the `CreateSportEventValidator` **before** this handler code executes, using the same date-stepping logic — that logic should live in a small pure static helper (e.g. `RecurrenceFrequency`-adjacent `RecurrenceScheduler.GenerateDates(startUtc, frequency, endUtc)`) shared by both the validator and the handler, to avoid duplicating/drifting the counting rule.

### 5. Validation — 52-instance cap, rejected not truncated

`CreateSportEventValidator` (same file) gets:

```csharp
RuleFor(x => x.Recurrence!.Frequency)
    .Must(f => new[] { "daily", "weekly", "monthly" }.Contains(f?.ToLowerInvariant()))
    .WithMessage("La frecuencia debe ser 'daily', 'weekly' o 'monthly'")
    .When(x => x.Recurrence is not null);

RuleFor(x => x.Recurrence!.EndDate)
    .GreaterThan(x => x.EveDateTime)
    .WithMessage("La fecha final de la recurrencia debe ser posterior a la fecha del evento")
    .When(x => x.Recurrence is not null);

RuleFor(x => x)
    .Must(x => RecurrenceScheduler.GenerateDates(x.EveDateTime, RecurrenceFrequency.FromCode(x.Recurrence!.Frequency), x.Recurrence.EndDate).Count <= RecurrenceConstants.MaxInstances)
    .WithMessage($"Una serie recurrente no puede generar más de {RecurrenceConstants.MaxInstances} eventos; acorta la fecha final o cambia la frecuencia")
    .When(x => x.Recurrence is not null && new[] { "daily", "weekly", "monthly" }.Contains(x.Recurrence.Frequency?.ToLowerInvariant()));
```

**Decision: reject, don't truncate.** Every other validator in this codebase (`CreateSportEventValidator.EventTypeId`, membership-quota checks in `coach-club-quota-permission`, etc.) rejects out-of-bounds input with a clear error rather than silently coercing it to the nearest valid value — truncating to 52 would silently drop events the coach explicitly asked for (e.g. picked the wrong end date by one week), which is a worse UX than a clear "shorten your end date" `ProblemDetails` error the frontend can surface next to the end-date field. This is also cheaper: no need to compute "what would the truncated end date have been" for the response.

### 6. Persistence — migration

New migration on `AppDbContext` (schema `app`, via `.\manage-migrations.ps1 -Action create -MigrationName AddEventRecurrence -Context AppDbContext`):
- New table `EventRecurrences` (`Id` PK, `FrequencyId` int, `EndDate` timestamp, `MasterEventId` FK → `SportEvents.Id`, `InstanceCount` int).
- New nullable columns on `SportEvents`: `RecurrenceId` (FK → `EventRecurrences.Id`, nullable, `ON DELETE SET NULL` — deleting a recurrence definition should not cascade-delete the events themselves in this change's scope) and `IsRecurrenceMaster` (bool, default `false`).

`EventRecurrenceEntityConfiguration.cs` (new file, same folder as `SportEventEntityConfiguration.cs`) configures the table, FK to `MasterEvent`, and the `HasMany(Events)`/`WithOne(Recurrence)` relationship on `SportEvent.RecurrenceId`. `SportEventEntityConfiguration.cs` is extended with `builder.Property(se => se.IsRecurrenceMaster).IsRequired().HasDefaultValue(false);` and `builder.Property(se => se.RecurrenceId).IsRequired(false);` plus the `HasOne(se => se.Recurrence).WithMany(r => r.Events).HasForeignKey(se => se.RecurrenceId)` relationship.

## Risks / Trade-offs

- **No Mediator/CQRS for this endpoint**: keeps the diff small and consistent with the existing file, but means recurrence generation logic lives in a minimal-API delegate rather than a testable `IRequestHandler`. Mitigated by extracting the date-generation into a standalone static `RecurrenceScheduler` class that xUnit tests hit directly without needing the endpoint.
- **Instances are not individually returned**: acceptable per the proposal (frontend re-fetches via the calendar list), but if a future requirement needs "show me exactly which 20 dates were created" in the same response, `SportEventSaveResponse` will need a `List<SportEventSaveResponse> Instances` field — deliberately deferred since it's not requested.
- **`CodActa` is not copied to instances**: match-report codes are inherently per-occurrence; copying the master's would be wrong. Explicitly called out in code comment.

## Migration Plan

Additive only — new table, two new nullable/defaulted columns. No backfill needed; existing `SportEvent` rows get `RecurrenceId = NULL`, `IsRecurrenceMaster = false` and are entirely unaffected. No frontend contract is broken (`Recurrence` request field and the three new response fields are all optional/present-with-null).

## Open Questions

- Should `EventRecurrence` also store `TeamId` directly (denormalized) for a cheap "how many active recurring series does this team have" query later, or is joining through `MasterEvent.TeamId` acceptable? Left as joining through the master for this change — flag for the front-specialist follow-up if a "manage recurring series" screen needs it.
