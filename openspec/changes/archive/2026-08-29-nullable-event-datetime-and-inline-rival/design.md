## Context

`SportEvent` (`Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Assistances/SportEvent.cs`)
currently requires `EveDateTime` (`DateTime`) and `StartTime` (`DateTime`) — both
validated by `SetEveDateTime`/`SetStartTime` to be non-default and not in the past.
`CreateSportEvent.cs` builds the entity directly (it is a raw Minimal API lambda, not a
Mediator `ICommand`) via `SportEvent.CreateNew(...)`, which bypasses those domain
setters entirely (no validation on create — see its doc comment: "bypassing domain
date-constraint validation"). `UpdateSportEvent.cs` also assigns fields directly rather
than calling the setters. `CreateSportEventValidator`/`UpdateSportEventValidator`
(FluentValidation) exist but are **not wired into the Minimal API pipeline** — no
`AddFluentValidationAutoValidation`/endpoint filter registers them, and
`ValidationBehavior` only fires for Mediator `ICommand`/`IQueryApp` requests (see
`ServiceCollectionExtensions.cs` comment: "no assembly-wide validator scan exists in
this project"). Today they are exercised only by
`tests/RFFM.Api.Tests/UnitTests/CreateSportEventValidatorTests.cs` calling
`_validator.Validate(...)` directly — a pre-existing gap, not something this change
was asked to fix everywhere, but the two new business rules below (mutual exclusion of
`RivalId`/`NewRival`, recurrence requiring a date) are meaningless if never executed in
production, so this change wires `CreateSportEventValidator` into the `POST
/api/sport-events` endpoint (3-line addition, see §5) — the smallest fix that makes the
new rules actually enforce anything.

Rival creation already exists as its own vertical slice
(`Features/Coaches/Rivals/Commands/CreateRival.cs`, a proper Mediator `ICommand` with
`CreateRivalValidator` wired through the standard pipeline) — this change reuses that
same construction logic (`new Rival(name, urlPhoto, category)`) inline inside
`CreateSportEvent`'s handler rather than calling `CreateRival` via `IMediator`, to keep
rival creation + event creation in one `SaveChangesAsync` (matching how
`CreateSportEvent` already batches the master `SportEvent` insert).

## Goals / Non-Goals

**Goals**
- `EveDateTime`/`StartTime` become optional end-to-end: domain entity, create request,
  update request (compiles against the new nullability; behavior unchanged), query
  responses, EF configuration + migration.
- Creating an event with `Recurrence` still requires `EveDateTime` (recurrence needs an
  anchor date) — enforced by validation, not by leaving it silently broken.
- `POST /api/sport-events` accepts an optional `NewRival` payload as an alternative to
  `RivalId`; both optional, mutually exclusive, event creation still works with neither.
- Every existing internal consumer of `SportEvent.EveDateTime`/`.StartTime` that assumes
  non-null keeps compiling and keeps its current behavior for events that do have a
  date (the overwhelming majority, since this is an edge case for "not yet scheduled"
  events).

**Non-Goals**
- No change to `Location` (already nullable) beyond what's incidentally touched.
- No change to `EndTime`/`ArrivalDate` nullability (already nullable).
- No retroactive backfill of existing rows — the migration adds nullability, no data
  migration needed (existing rows already have non-null values).
- No change to `UpdateSportEvent`'s validation strictness (still requires `Name`,
  `EventTypeId`; still accepts `EveDateTime`/`StartTime` as required-shaped on the
  wire, since editing to *add* a missing date is the intended use of that endpoint —
  see "Update stays as-is" below).
- No frontend implementation (see proposal.md; contract for `front-specialist` is §7
  below).
- No fix for the general "Minimal API DTO validators aren't wired" gap beyond
  `CreateSportEventValidator` itself.

## Decisions

### 1. `SportEvent` entity — nullable `EveDateTime`/`StartTime`

```csharp
public DateTime? EveDateTime { get; set; }
public DateTime? StartTime { get; set; }
```

`SetEveDateTime`/`SetStartTime` accept `DateTime?` and only validate
non-default/non-past **when a value is provided** — `null` is always accepted (that's
the whole point):

```csharp
public void SetEveDateTime(DateTime? eveDateTime)
{
    if (eveDateTime.HasValue)
    {
        if (eveDateTime.Value == default)
            throw new ArgumentException("La fecha del evento no puede estar vacía");
        if (eveDateTime.Value < DateTime.UtcNow)
            throw new ArgumentException("La fecha del evento no puede ser anterior a la fecha actual");
    }
    EveDateTime = eveDateTime;
}

public void SetStartTime(DateTime? startTime)
{
    if (startTime.HasValue)
    {
        if (startTime.Value == default)
            throw new ArgumentException("La hora de inicio no puede estar vacía");
        if (startTime.Value < DateTime.UtcNow)
            throw new ArgumentException("La hora de inicio no puede ser anterior a la hora actual");
        if (EndTime.HasValue && startTime.Value >= EndTime.Value)
            throw new ArgumentException("La hora de inicio no puede ser posterior o igual a la hora de fin");
    }
    StartTime = startTime;
}

public void SetEndTime(DateTime? endTime)
{
    if (endTime.HasValue)
    {
        if (endTime.Value < DateTime.UtcNow)
            throw new ArgumentException("La hora de fin no puede ser anterior a la hora actual");
        if (StartTime.HasValue && endTime.Value <= StartTime.Value)
            throw new ArgumentException("La hora de fin no puede ser anterior o igual a la hora de inicio");
    }
    EndTime = endTime;
}
```

`SetArrivalDate` is untouched — it already compares against the nullable `EndTime` via
lifted operators and doesn't reference `StartTime`.

`SportEvent.CreateNew(...)` (the factory actually used by `CreateSportEvent`,
`UpdateSportEvent` never calls it, and every test) already takes `DateTime
eveDateTime, DateTime startTime` as non-nullable parameters and bypasses the setters —
these become `DateTime? eveDateTime, DateTime? startTime` so callers can pass `null`.
Every existing call site passes concrete `DateTime` values (implicit conversion to
`DateTime?`), so no caller needs to change.

`EventModel` (`Domain/Models/EventModel.cs`) — the model backing the private
`SportEvent(EventModel)` constructor / `SportEvent.Create(EventModel)` factory — has no
current callers in the codebase (`grep` confirms only its own definition). Its
`EveDateTime`/`StartTime` become `DateTime?` too, purely so the constructor that calls
`SetEveDateTime`/`SetStartTime` still compiles; this path stays otherwise untouched and
untested (it was already untested).

### 2. Recurrence requires a date

`CreateSportEventValidator` gains:

```csharp
RuleFor(x => x.EveDateTime)
    .NotNull()
    .When(x => x.Recurrence is not null)
    .WithMessage("La recurrencia requiere una fecha de evento");
```

The handler already only enters the recurrence branch `if (req.Recurrence is not
null)`; with the validator now actually wired (see §5), a request with `Recurrence` set
and `EveDateTime: null` is rejected before reaching the handler, so no defensive
null-check is needed inside the recurrence block itself — `ev.EveDateTime` is
guaranteed non-null there by the validator contract. `RecurrenceScheduler.GenerateDates`
keeps its non-nullable `DateTime startUtc` signature; the handler passes
`ev.EveDateTime!.Value` (validator-guaranteed) or, to stay honest about the invariant
in code rather than only in the validator, an explicit
`ev.EveDateTime ?? throw new InvalidOperationException(...)` — the design intent is
"unreachable when validation ran", not a silent `.Value` NRE risk if that assumption
is ever violated by a future caller that skips validation.

### 3. `CreateSportEventRequest`/response contracts

```csharp
public record CreateSportEventRequest(
    string Name,
    DateTime? EveDateTime,          // was DateTime
    DateTime? StartTime,
    DateTime? EndTime,
    DateTime? ArrivalDate,
    string? Location,
    string? Description,
    int EventTypeId,
    string TeamId,
    string? RivalId,
    NewRivalRequest? NewRival,       // new
    bool? IsHomeMatch,
    string? CodActa,
    RecurrenceRequest? Recurrence = null
);

public record NewRivalRequest(string Name, string? UrlPhoto, string? Category);
```

`SportEventSaveResponse`, `SportEventResponse` (`GetSportEvents.cs`),
`SportEventItemResponse` (`GetSportEventItem.cs`): `EveDateTime`/`StartTime` become
`DateTime?`.

### 4. Rival: existing vs. new vs. none

Validator additions:

```csharp
RuleFor(x => x)
    .Must(x => x.RivalId is null || x.NewRival is null)
    .WithMessage("No se puede indicar un rival existente y uno nuevo a la vez");

When(x => x.NewRival is not null, () =>
{
    RuleFor(x => x.NewRival!.Name).NotEmpty().MaximumLength(100);
    RuleFor(x => x.NewRival!.Category).MaximumLength(50);
    RuleFor(x => x.NewRival!.UrlPhoto).MaximumLength(256);
});
```

(Lengths mirror `Rival.SetName`/`SetUrlPhoto`/`SetCategory` and
`CreateRivalValidator` — same caps, kept in sync deliberately.)

Handler (`CreateSportEvent`'s route lambda):

```csharp
string? resolvedRivalId;
if (req.NewRival is not null)
{
    var rival = new Rival(req.NewRival.Name, req.NewRival.UrlPhoto, req.NewRival.Category);
    db.Rivals.Add(rival);
    resolvedRivalId = rival.Id;
}
else if (req.RivalId is not null)
{
    resolvedRivalId = (await db.Rivals.Select(r => r.Id).ToListAsync(cancellationToken))
        .FirstOrDefault(id => id.Trim() == req.RivalId.Trim()) ?? req.RivalId;
}
else
{
    resolvedRivalId = null;
}
```

`Rival.Id` (from `BaseEntity`) is assigned in-memory at construction (`Guid.NewGuid()`
as string), before `SaveChangesAsync` — so `resolvedRivalId` is known immediately and
`SportEvent.CreateNew(...)` can reference it in the same call, same as the existing
`RivalId` path. `db.Rivals.Add(rival)` and `db.SportEvents.Add(ev)` go into the **same**
`SaveChangesAsync` — unlike the master/recurrence two-phase save, this has no circular
FK (`Rival` never references `SportEvent`), so EF Core's dependency graph orders the
`Rival` insert before the `SportEvent` insert automatically.

`UpdateSportEvent` is not touched — it already resolves `RivalId` only (no
`NewRival` on update; out of scope per proposal.md).

### 5. Wiring `CreateSportEventValidator` into the endpoint

Minimal, additive change to the existing lambda in `CreateSportEvent.AddRoutes`:

```csharp
app.MapPost("/api/sport-events",
        async (CreateSportEventRequest req, AppDbContext db, IPushNotificationDispatcher dispatcher,
               IValidator<CreateSportEventRequest> validator, CancellationToken cancellationToken) =>
        {
            var validation = await validator.ValidateAsync(req, cancellationToken);
            if (!validation.IsValid)
                return Results.ValidationProblem(validation.ToDictionary());
            // ...existing body...
        })
```

`IValidator<CreateSportEventRequest>` resolves to `CreateSportEventValidator` via
FluentValidation's `AddValidatorsFromAssemblyContaining<T>()` if already registered
assembly-wide for `AbstractValidator<T>` types, or otherwise needs the same explicit
`services.AddScoped<IValidator<CreateSportEventRequest>, CreateSportEventValidator>()`
registration pattern used for the News/PushNotifications validators in
`ServiceCollectionExtensions.cs` — confirm which applies by checking whether
`CreateSportEventValidator` already resolves from DI (it currently doesn't need to,
since nothing requests it); add the explicit registration if assembly scanning isn't
in place. `Results.ValidationProblem` returns RFC 7807 `ValidationProblemDetails`,
consistent with the rest of the API's error contract.

### 6. EF configuration + migration

`SportEventEntityConfiguration.cs`:

```csharp
builder.Property(se => se.EveDateTime).IsRequired(false);
builder.Property(se => se.StartTime).IsRequired(false);
```

New migration via `.\manage-migrations.ps1` (or `dotnet ef migrations add
MakeEventDateTimeAndStartTimeNullable --startup-project ../RFFM.Host`) — alters both
columns to nullable, no data transformation needed (existing rows keep their values).

### 7. Downstream consumers of `.EveDateTime`/`.StartTime` (non-nullable today)

Grep confirms these read `SportEvent.EveDateTime`/`.StartTime` assuming non-null; each
needs a minimal adjustment to keep current behavior for dated events and degrade
sensibly for undated ones:

| File | Usage | Fix |
|---|---|---|
| `Features/Coaches/Assistances/Queries/GetTrainingAttendanceSummary.cs:87,168` | Projects `e.EveDateTime` into a DTO field, used for display/sort | DTO field becomes `DateTime?`; sort/display already null-tolerant patterns used elsewhere in the file, or falls back to `DateTime.MaxValue`/last for undated (training events always have a date in practice — this only matters if an undated event is later surfaced here) |
| `Features/Coaches/Convocations/GetEventConvocations.cs:74` | `sportEvent?.EveDateTime.Date ?? DateTime.UtcNow.Date` | `sportEvent?.EveDateTime?.Date ?? DateTime.UtcNow.Date` |
| `Features/Coaches/Convocations/GetEventPlayers.cs:56` | `sportEvent.EveDateTime.Date` | `sportEvent.EveDateTime?.Date ?? DateTime.UtcNow.Date` (mirrors the pattern in the sibling file above) |
| `Features/Coaches/SeasonPrep/SeasonPrepExportPdf.cs:86` | `eventDate = ev.EveDateTime` assigned to a non-nullable local | Local becomes `DateTime?`; downstream formatting already must handle "TBD"/blank for a PDF row — render an explicit placeholder (e.g. "Por confirmar") when null |
| `Features/Coaches/SportEvents/Commands/SyncCalendarFromFederation.cs:139-183` | Compares/assigns `EveDateTime`/`StartTime` against federation data, which always supplies a real match date | No behavior change — federation sync always has a date; only needs to compile (assignments to nullable properties from non-nullable locals compile as-is; comparisons `e.EveDateTime >= matchDateUtc` need `e.EveDateTime.HasValue && e.EveDateTime.Value >= matchDateUtc`, or restrict the query to `e.EveDateTime != null && ...`) |
| `Features/Mobile/Players/Queries/GetPlayerSeasonCards.cs:116,118` | Builds a `Dictionary<string, DateTime>` keyed by event id from `se.EveDateTime` | Dictionary value becomes `DateTime?`; consumers filter/skip entries with no date (mobile season cards are historical/played matches, which always have a date in practice) |

Each fix is verified by running the existing test for that handler
(`GetTeamConvocationsSummaryHandlerTests`, etc. — see tasks.md) after the change,
confirming no behavior regression for dated events (the only case those tests cover
today).

## Frontend Contract (for `front-specialist`)

This backend change does not touch `Front/`, but the following is the finished
contract the Coach event-creation form should target:

**`POST /api/sport-events`** — updated request body:

```ts
type CreateSportEventRequest = {
  name: string;
  eveDateTime?: string | null;   // ISO datetime — now optional
  startTime?: string | null;     // ISO datetime — now optional
  endTime?: string | null;
  arrivalDate?: string | null;
  location?: string | null;
  description?: string | null;
  eventTypeId: number;           // still required
  teamId: string;                // still required
  rivalId?: string | null;       // existing rival — mutually exclusive with newRival
  newRival?: {                   // new — create + link a rival inline
    name: string;                // required if newRival is present
    urlPhoto?: string | null;
    category?: string | null;
  } | null;
  isHomeMatch?: boolean | null;
  codActa?: string | null;
  recurrence?: { frequency: "daily" | "weekly" | "monthly"; endDate: string } | null;
  // recurrence REQUIRES eveDateTime to be set — sending both recurrence and no
  // eveDateTime is rejected with 400 ValidationProblemDetails
};
```

Validation errors the form must surface:
- `newRival` + `rivalId` both present → 400 ("No se puede indicar un rival existente y
  uno nuevo a la vez") — the form should make these UI-mutually-exclusive (radio/toggle
  between "rival existente" / "rival nuevo" / "sin rival") rather than relying on the
  backend rejection as the only guard.
- `newRival.name` empty when the "rival nuevo" mode is selected → 400.
- `recurrence` set without `eveDateTime` → 400 — the form should disable/hide the
  recurrence option whenever the date field is empty.

Response bodies (`SportEventSaveResponse`, `SportEventResponse`,
`SportEventItemResponse`) now have `eveDateTime`/`startTime` as nullable — any frontend
code formatting these dates (list rows, detail view, calendar) needs a "sin fecha" /
"por confirmar" fallback instead of assuming a parseable date is always present.

`PUT /api/sport-events/{id}` is unchanged in this backend change (still expects
`eveDateTime`/`startTime` on the wire); it is the mechanism the form should call later
to fill in a previously-missing date, same as any other edit.

## Risks / Trade-offs

- Wiring a previously-dead validator into the live endpoint (§5) changes production
  behavior for any existing caller currently sending payloads that would fail the
  *existing* rules (`Name` required, `TeamId` required, `EventTypeId > 0`,
  recurrence-frequency/end-date/cap rules) but that the endpoint silently accepted
  before because nothing enforced them. This is judged acceptable — those rules were
  already the intended contract (tested, documented) and no legitimate caller should be
  relying on bypassing them — but it is a behavior change worth flagging at review.
- Table scan across `SportEvents` for null-date events long-term could complicate
  calendar sorting (`ORDER BY EveDateTime` puts NULLs first/last per DB semantics) —
  out of scope here since sorting/display is a frontend concern per the contract above,
  but noted for whoever builds the "undated events" list view.

## Migration Plan

1. Backend-only change; deploy before any frontend change that starts sending
   `eveDateTime: null` or `newRival` (this change makes the backend accept both **without
   requiring** the frontend to send them — existing frontend payloads keep working
   unchanged since they always send concrete dates and never send `newRival`).
2. Apply the EF migration (`MakeEventDateTimeAndStartTimeNullable`) before or alongside
   deploy — nullable-column alterations are non-breaking for existing rows.
3. No rollback complexity: reverting the migration (re-adding `NOT NULL`) would fail if
   any undated event was created in the meantime — acceptable, documented as a forward-
   only migration in this scope.
