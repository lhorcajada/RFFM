# Implement: coach-recurring-events

Self-contained script for the `openspec-implementer` subagent. Backend only, `Back/ExtractionApi/`. Follow strict TDD (Red → Green → Refactor) per group below — write the failing test, run it, confirm it fails for the right reason, then write the minimal implementation, then refactor while staying green. All paths below are relative to `Back/ExtractionApi/` unless stated otherwise. Do not touch `Front/`.

Reference docs already reviewed and approved by the user: `openspec/changes/coach-recurring-events/proposal.md`, `design.md`, `tasks.md`, `specs/coach-recurring-events/spec.md`. This script operationalizes them — if anything here conflicts with `design.md`, `design.md` wins.

## 0. Environment notes

- `dotnet build` from `Back/ExtractionApi` must be clean throughout.
- `tests/RFFM.Api.Tests` has both unit tests (`UnitTests/`, no external dependencies) and integration tests (`IntegrationTests/`, use `PostgresContainerFixture` — a Testcontainers-managed ephemeral `postgres:16` container, requires a reachable Docker/Podman daemon).
- Check Docker availability first: `docker version`. If the daemon is unreachable (client present but no daemon, or command errors), the integration test in step 4 will fail to start the container — that is an **environment** limitation, not a code defect. In that case: run `dotnet test --filter "FullyQualifiedName!~IntegrationTests"` for the pass/fail verdict, clearly state in the final report that integration tests were not executed due to no local Docker daemon, and still ensure the integration test file is written and compiles (`dotnet build` must succeed) so it runs correctly in CI/dev environments that do have Docker.
- No `WebApplicationFactory`/HTTP-level test harness exists in this repo today for any minimal-API endpoint — do not introduce one for this change (out of scope, bigger diff than warranted). Endpoint behavior is covered via: (a) unit tests on the validator and the pure scheduling logic, (b) an integration test that persists entities the same way the handler does, against a real Postgres, to prove the EF mapping/migration is correct.

## 1. Domain model (Red → Green → Refactor)

### 1.1 `RecurrenceScheduler` — write test first
Create `tests/RFFM.Api.Tests/UnitTests/RecurrenceSchedulerTests.cs`:

```csharp
#nullable enable
using System;
using System.Linq;
using RFFM.Api.Domain.Aggregates.Assistances;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class RecurrenceSchedulerTests
    {
        [Fact]
        public void GenerateDates_Daily_StepsByOneDayInclusiveOfEndDate()
        {
            var start = new DateTime(2026, 8, 1, 18, 0, 0, DateTimeKind.Utc);
            var end = new DateTime(2026, 8, 4, 0, 0, 0, DateTimeKind.Utc); // date-only end bound
            var dates = RecurrenceScheduler.GenerateDates(start, RecurrenceFrequency.FromCode("daily"), end);
            Assert.Equal(4, dates.Count); // Aug 1, 2, 3, 4 (all with 18:00 time-of-day, <= end-of-day Aug 4)
            Assert.Equal(start, dates[0]);
        }

        [Fact]
        public void GenerateDates_Weekly_StepsBySevenDays()
        {
            var start = new DateTime(2026, 8, 3, 18, 0, 0, DateTimeKind.Utc);
            var end = new DateTime(2026, 8, 24, 0, 0, 0, DateTimeKind.Utc);
            var dates = RecurrenceScheduler.GenerateDates(start, RecurrenceFrequency.FromCode("weekly"), end);
            Assert.Equal(new[] { 3, 10, 17, 24 }, dates.Select(d => d.Day).ToArray());
        }

        [Fact]
        public void GenerateDates_Monthly_StepsByCalendarMonth()
        {
            var start = new DateTime(2026, 1, 15, 10, 0, 0, DateTimeKind.Utc);
            var end = new DateTime(2026, 4, 20, 0, 0, 0, DateTimeKind.Utc);
            var dates = RecurrenceScheduler.GenerateDates(start, RecurrenceFrequency.FromCode("monthly"), end);
            Assert.Equal(new[] { 1, 2, 3, 4 }, dates.Select(d => d.Month).ToArray());
        }

        [Fact]
        public void GenerateDates_ExactlyFiftyTwoInstances_ReturnsFiftyTwo()
        {
            var start = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            var end = start.AddDays(51); // 52 daily occurrences: day 0..51
            var dates = RecurrenceScheduler.GenerateDates(start, RecurrenceFrequency.FromCode("daily"), end);
            Assert.Equal(52, dates.Count);
        }

        [Fact]
        public void GenerateDates_FiftyThreeInstances_ReturnsFiftyThree_CapEnforcedElsewhere()
        {
            // GenerateDates itself does not cap — capping/rejection is the validator's job (design.md §5).
            var start = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            var end = start.AddDays(52); // 53 daily occurrences
            var dates = RecurrenceScheduler.GenerateDates(start, RecurrenceFrequency.FromCode("daily"), end);
            Assert.Equal(53, dates.Count);
        }

        [Fact]
        public void GenerateDates_EndDateBeforeStart_ReturnsEmpty()
        {
            var start = new DateTime(2026, 8, 10, 0, 0, 0, DateTimeKind.Utc);
            var end = new DateTime(2026, 8, 1, 0, 0, 0, DateTimeKind.Utc);
            var dates = RecurrenceScheduler.GenerateDates(start, RecurrenceFrequency.FromCode("weekly"), end);
            Assert.Empty(dates);
        }
    }
}
```

Run `dotnet test --filter RecurrenceSchedulerTests` — confirm it fails to **compile** (no `RecurrenceScheduler`/`RecurrenceFrequency` types yet). That is the expected Red state.

Now implement, minimal:

Create `src/RFFM.Api/Domain/Aggregates/Assistances/RecurrenceFrequency.cs`:
```csharp
namespace RFFM.Api.Domain.Aggregates.Assistances
{
    public class RecurrenceFrequency
    {
        private static readonly RecurrenceFrequency Daily = new(1, "Diaria");
        private static readonly RecurrenceFrequency Weekly = new(2, "Semanal");
        private static readonly RecurrenceFrequency Monthly = new(3, "Mensual");

        public int Id { get; }
        public string Name { get; }

        private RecurrenceFrequency(int id, string name)
        {
            Id = id;
            Name = name;
        }

        public static IEnumerable<RecurrenceFrequency> List() => new[] { Daily, Weekly, Monthly };

        public static RecurrenceFrequency From(int id)
        {
            var frequency = List().SingleOrDefault(f => f.Id == id);
            if (frequency == null)
                throw new ArgumentException($"Possible values for RecurrenceFrequency: {string.Join(",", List().Select(f => f.Name))}");
            return frequency;
        }

        public static RecurrenceFrequency FromCode(string? code)
        {
            return code?.Trim().ToLowerInvariant() switch
            {
                "daily" => Daily,
                "weekly" => Weekly,
                "monthly" => Monthly,
                _ => throw new ArgumentException("Possible values for Recurrence.Frequency: daily, weekly, monthly"),
            };
        }

        public static bool IsValidCode(string? code) =>
            code is not null && new[] { "daily", "weekly", "monthly" }.Contains(code.Trim().ToLowerInvariant());

        public DateTime Next(DateTime from) => Id switch
        {
            1 => from.AddDays(1),
            2 => from.AddDays(7),
            3 => from.AddMonths(1),
            _ => throw new InvalidOperationException("Unknown recurrence frequency"),
        };
    }
}
```
(Add `using System; using System.Collections.Generic; using System.Linq;` as needed — match the file's actual usings once written; `RFFM.Api` targets implicit usings so most of these may already be global, verify with `dotnet build`.)

Create `src/RFFM.Api/Domain/Aggregates/Assistances/RecurrenceConstants.cs`:
```csharp
namespace RFFM.Api.Domain.Aggregates.Assistances
{
    public static class RecurrenceConstants
    {
        public const int MaxInstances = 52;
    }
}
```

Create `src/RFFM.Api/Domain/Aggregates/Assistances/RecurrenceScheduler.cs`:
```csharp
namespace RFFM.Api.Domain.Aggregates.Assistances
{
    /// <summary>
    /// Pure date-generation logic for recurring events. No DB/EF dependency so it can be unit
    /// tested directly and shared between CreateSportEventValidator (counting/rejecting) and the
    /// CreateSportEvent endpoint handler (actually building the instances) — see design.md §4/§5.
    /// </summary>
    public static class RecurrenceScheduler
    {
        public static IReadOnlyList<DateTime> GenerateDates(DateTime startUtc, RecurrenceFrequency frequency, DateTime endUtc)
        {
            var dates = new List<DateTime>();
            var cursor = startUtc;
            // Compare by day so an end date with a 00:00 time-of-day still includes an occurrence
            // that lands earlier that same day (the master's time-of-day is reused for every
            // instance; endDate is a date-only picker value on the frontend).
            while (cursor.Date <= endUtc.Date)
            {
                dates.Add(cursor);
                cursor = frequency.Next(cursor);
            }
            return dates;
        }
    }
}
```

Run `dotnet test --filter RecurrenceSchedulerTests` again — confirm Green (all 6 pass).

### 1.2 `EventRecurrence` entity
Create `src/RFFM.Api/Domain/Aggregates/Assistances/EventRecurrence.cs`:
```csharp
using RFFM.Api.Domain;

namespace RFFM.Api.Domain.Aggregates.Assistances
{
    public class EventRecurrence : BaseEntity
    {
        public int FrequencyId { get; private set; }
        public DateTime EndDate { get; private set; }
        public string MasterEventId { get; private set; } = null!;
        public int InstanceCount { get; private set; }

        public SportEvent MasterEvent { get; set; } = null!;
        public List<SportEvent> Events { get; set; } = null!;

        private EventRecurrence()
        {
        }

        public static EventRecurrence Create(RecurrenceFrequency frequency, DateTime endDate, string masterEventId, int instanceCount)
        {
            if (endDate == default)
                throw new ArgumentException("La fecha final de la recurrencia no puede estar vacía");
            if (string.IsNullOrEmpty(masterEventId))
                throw new ArgumentException("El evento maestro no puede estar vacío");
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
}
```
(Drop the redundant `using RFFM.Api.Domain;` if the file is already inside that namespace tree and `BaseEntity` resolves without it — check against how `SportEvent.cs` imports `BaseEntity`'s namespace, mirror that exactly.)

Add a small unit test `tests/RFFM.Api.Tests/UnitTests/EventRecurrenceTests.cs` (Red first):
```csharp
#nullable enable
using System;
using RFFM.Api.Domain.Aggregates.Assistances;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class EventRecurrenceTests
    {
        [Fact]
        public void Create_WithValidData_Succeeds()
        {
            var recurrence = EventRecurrence.Create(RecurrenceFrequency.FromCode("weekly"), DateTime.UtcNow.AddMonths(1), "event-1", 4);
            Assert.Equal(2, recurrence.FrequencyId);
            Assert.Equal("event-1", recurrence.MasterEventId);
            Assert.Equal(4, recurrence.InstanceCount);
        }

        [Fact]
        public void Create_WithInstanceCountAboveCap_Throws()
        {
            Assert.Throws<ArgumentException>(() =>
                EventRecurrence.Create(RecurrenceFrequency.FromCode("daily"), DateTime.UtcNow.AddYears(1), "event-1", 53));
        }

        [Fact]
        public void Create_WithEmptyMasterEventId_Throws()
        {
            Assert.Throws<ArgumentException>(() =>
                EventRecurrence.Create(RecurrenceFrequency.FromCode("daily"), DateTime.UtcNow.AddDays(10), "", 5));
        }
    }
}
```
Confirm Red (missing type) → implement `EventRecurrence.cs` above → confirm Green.

### 1.3 `SportEvent` changes
Edit `src/RFFM.Api/Domain/Aggregates/Assistances/SportEvent.cs`. Add after `SelectedKitNumber`:
```csharp
        public string? RecurrenceId { get; set; }
        public bool IsRecurrenceMaster { get; set; }
        public EventRecurrence? Recurrence { get; set; }
```
No constructor changes — both `CreateNew` and `Create` factories stay untouched; `RecurrenceId`/`IsRecurrenceMaster` are set by the endpoint handler after construction, the same way `SelectedKitNumber` is set via `SetSelectedKit` post-construction elsewhere in the codebase (here a plain setter is fine since there's no invariant beyond "must be a valid `EventRecurrence.Id` if set", which is enforced by the FK constraint, not by an entity method).

`dotnet build` — confirm clean.

## 2. Persistence (Red → Green via a Postgres integration test)

### 2.1 EF configuration
Create `src/RFFM.Api/Infrastructure/Persistence/Configuration/Aggregates/Assistances/EventRecurrenceEntityConfiguration.cs`:
```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.Assistances;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.Assistances
{
    internal class EventRecurrenceEntityConfiguration : IEntityTypeConfiguration<EventRecurrence>
    {
        public void Configure(EntityTypeBuilder<EventRecurrence> builder)
        {
            builder.ToTable("EventRecurrences");
            builder.HasKey(r => r.Id);

            builder.Property(r => r.FrequencyId).IsRequired();
            builder.Property(r => r.EndDate).IsRequired();
            builder.Property(r => r.MasterEventId).IsRequired();
            builder.Property(r => r.InstanceCount).IsRequired();

            builder.HasOne(r => r.MasterEvent)
                .WithMany()
                .HasForeignKey(r => r.MasterEventId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
```

Edit `src/RFFM.Api/Infrastructure/Persistence/Configuration/Aggregates/Assistances/SportEventEntityConfiguration.cs`, after the `SelectedKitNumber` property config:
```csharp
            builder.Property(se => se.RecurrenceId)
                .IsRequired(false);

            builder.Property(se => se.IsRecurrenceMaster)
                .IsRequired()
                .HasDefaultValue(false);

            builder.HasOne(se => se.Recurrence)
                .WithMany(r => r.Events)
                .HasForeignKey(se => se.RecurrenceId)
                .OnDelete(DeleteBehavior.SetNull);
```

### 2.2 `AppDbContext` DbSet
Edit `src/RFFM.Api/Infrastructure/Persistence/AppDbContext.cs` — add near `public DbSet<SportEvent> SportEvents { get; set; }` (same style/line format):
```csharp
        public DbSet<EventRecurrence> EventRecurrences { get; set; }
```
Add `using RFFM.Api.Domain.Aggregates.Assistances;` if not already present (it likely already is, since `SportEvent` lives there — check before adding a duplicate `using`).

`dotnet build` — confirm clean.

### 2.3 Migration
From `Back/ExtractionApi`:
```
.\manage-migrations.ps1 -Action create -MigrationName AddEventRecurrence -Context AppDbContext
```
Inspect the generated migration under `src/RFFM.Api/Infrastructure/Migrations/`:
- `Up()` must: create table `EventRecurrences` (schema `app`) with columns matching §2.1, FK to `SportEvents.Id`; add nullable `RecurrenceId` + `IsRecurrenceMaster` (`default false`) columns to `SportEvents`; add FK `SportEvents.RecurrenceId` → `EventRecurrences.Id` with `ON DELETE SET NULL`.
- `Down()` must cleanly reverse all of the above (drop FK, drop columns, drop table) — purely additive, no data loss risk on rollback since no existing column is altered.
- If EF's design-time snapshot comparison misfires (there is a pre-existing, unrelated snapshot-corruption issue noted in `PostgresContainerFixture.cs` — `RelationalEventId.PendingModelChangesWarning` is deliberately suppressed there), do not attempt to "fix" the snapshot as part of this change; that is out of scope. Only ensure the migration itself applies cleanly.

Do not run `-Action apply` against any real/shared database — verify the migration via the integration test in step 4, which calls `Database.MigrateAsync()` against an ephemeral Testcontainers Postgres instance (see `tests/RFFM.Api.Tests/Fixtures/PostgresContainerFixture.cs`), exactly like the existing `CreateUserTransactionRollbackTests`.

## 3. Command / validator / handler (Red → Green)

### 3.1 Validator tests first
Create `tests/RFFM.Api.Tests/UnitTests/CreateSportEventValidatorTests.cs`:
```csharp
#nullable enable
using System;
using RFFM.Api.Features.Coaches.SportEvents.Commands;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class CreateSportEventValidatorTests
    {
        private readonly CreateSportEventValidator _validator = new();

        private static CreateSportEventRequest BaseRequest(RecurrenceRequest? recurrence) => new(
            Name: "Entrenamiento",
            EveDateTime: new DateTime(2026, 8, 3, 18, 0, 0, DateTimeKind.Utc),
            StartTime: new DateTime(2026, 8, 3, 18, 0, 0, DateTimeKind.Utc),
            EndTime: null,
            ArrivalDate: null,
            Location: null,
            Description: null,
            EventTypeId: 2,
            TeamId: "team-1",
            RivalId: null,
            IsHomeMatch: null,
            CodActa: null,
            Recurrence: recurrence
        );

        [Fact]
        public void Validate_WithoutRecurrence_Succeeds()
        {
            var result = _validator.Validate(BaseRequest(null));
            Assert.True(result.IsValid);
        }

        [Fact]
        public void Validate_WithValidWeeklyRecurrence_Succeeds()
        {
            var request = BaseRequest(new RecurrenceRequest("weekly", new DateTime(2026, 8, 24)));
            var result = _validator.Validate(request);
            Assert.True(result.IsValid);
        }

        [Fact]
        public void Validate_WithUnknownFrequency_Fails()
        {
            var request = BaseRequest(new RecurrenceRequest("yearly", new DateTime(2026, 8, 24)));
            var result = _validator.Validate(request);
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_WithEndDateBeforeEventDate_Fails()
        {
            var request = BaseRequest(new RecurrenceRequest("weekly", new DateTime(2026, 8, 1)));
            var result = _validator.Validate(request);
            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validate_WithExactlyFiftyTwoInstances_Succeeds()
        {
            var start = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            var request = BaseRequest(new RecurrenceRequest("daily", start.AddDays(51))) with { EveDateTime = start, StartTime = start };
            var result = _validator.Validate(request);
            Assert.True(result.IsValid);
        }

        [Fact]
        public void Validate_WithFiftyThreeInstances_Fails()
        {
            var start = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            var request = BaseRequest(new RecurrenceRequest("daily", start.AddDays(52))) with { EveDateTime = start, StartTime = start };
            var result = _validator.Validate(request);
            Assert.False(result.IsValid);
        }
    }
}
```
Run `dotnet test --filter CreateSportEventValidatorTests` — confirm Red (compile error: no `Recurrence`/`RecurrenceRequest` members yet).

### 3.2 Implement — edit `src/RFFM.Api/Features/Coaches/SportEvents/Commands/CreateSportEvent.cs`

Add `using RFFM.Api.Domain.Aggregates.Assistances;` is already present (the file already imports that namespace for `SportEvent`) — confirm, don't duplicate.

Extend the request record:
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
        RecurrenceRequest? Recurrence = null
    );

    public record RecurrenceRequest(
        string Frequency,
        DateTime EndDate
    );
```

Extend the validator:
```csharp
    public class CreateSportEventValidator : AbstractValidator<CreateSportEventRequest>
    {
        public CreateSportEventValidator()
        {
            RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
            RuleFor(x => x.TeamId).NotEmpty();
            RuleFor(x => x.EventTypeId).GreaterThan(0);

            When(x => x.Recurrence is not null, () =>
            {
                RuleFor(x => x.Recurrence!.Frequency)
                    .Must(f => RecurrenceFrequency.IsValidCode(f))
                    .WithMessage("La frecuencia debe ser 'daily', 'weekly' o 'monthly'");

                RuleFor(x => x.Recurrence!.EndDate)
                    .GreaterThan(x => x.EveDateTime)
                    .WithMessage("La fecha final de la recurrencia debe ser posterior a la fecha del evento");

                RuleFor(x => x)
                    .Must(BeWithinInstanceCap)
                    .WithMessage($"Una serie recurrente no puede generar más de {RecurrenceConstants.MaxInstances} eventos; acorta la fecha final o cambia la frecuencia");
            });
        }

        private static bool BeWithinInstanceCap(CreateSportEventRequest request)
        {
            if (!RecurrenceFrequency.IsValidCode(request.Recurrence!.Frequency))
            {
                // Frequency-validity rule above already reports this; do not double-fail here.
                return true;
            }
            var frequency = RecurrenceFrequency.FromCode(request.Recurrence.Frequency);
            var dates = RecurrenceScheduler.GenerateDates(request.EveDateTime, frequency, request.Recurrence.EndDate);
            return dates.Count <= RecurrenceConstants.MaxInstances;
        }
    }
```
(FluentValidation v12 `When(...)` block syntax — verify against another validator in the codebase using `When` if one exists; if the repo's FluentValidation version/style here prefers `.When(x => ..., ApplyConditionTo.AllValidators)` per-rule instead of a `When` block, mirror whichever style is idiomatic here rather than introducing a new one. Check `grep -rn "When(" src/RFFM.Api/Features` for the nearest example before finalizing.)

Run `dotnet test --filter CreateSportEventValidatorTests` — confirm Green.

### 3.3 Handler + response — extend the endpoint delegate and `SportEventSaveResponse`

Extend `SportEventSaveResponse`:
```csharp
    public record SportEventSaveResponse(
        string Id,
        string Name,
        DateTime EveDateTime,
        DateTime StartTime,
        DateTime? EndTime,
        DateTime? ArrivalDate,
        string? Location,
        string? Description,
        int EventTypeId,
        string TeamId,
        string? RivalId,
        bool IsHomeMatch,
        string? CodActa,
        string? RecurrenceId,
        bool IsRecurrenceMaster,
        int? RecurrenceInstanceCount
    );
```

Inside `AddRoutes`, after `var ev = SportEvent.CreateNew(...)` and before `db.SportEvents.Add(ev);`:
```csharp
                        EventRecurrence? recurrence = null;
                        var instances = Array.Empty<SportEvent>();

                        if (req.Recurrence is not null)
                        {
                            var frequency = RecurrenceFrequency.FromCode(req.Recurrence.Frequency);
                            var endDateUtc = DateTime.SpecifyKind(req.Recurrence.EndDate, DateTimeKind.Utc);
                            var dates = RecurrenceScheduler.GenerateDates(ev.EveDateTime, frequency, endDateUtc);

                            recurrence = EventRecurrence.Create(frequency, endDateUtc, ev.Id, dates.Count);
                            ev.RecurrenceId = recurrence.Id;
                            ev.IsRecurrenceMaster = true;

                            var startOffset = ev.StartTime - ev.EveDateTime;
                            var endOffset = ev.EndTime.HasValue ? ev.EndTime.Value - ev.EveDateTime : (TimeSpan?)null;
                            var arrivalOffset = ev.ArrivalDate.HasValue ? ev.ArrivalDate.Value - ev.EveDateTime : (TimeSpan?)null;

                            instances = dates.Skip(1)
                                .Select(d => SportEvent.CreateNew(
                                    ev.Name,
                                    d,
                                    d.Add(startOffset),
                                    endOffset.HasValue ? d.Add(endOffset.Value) : (DateTime?)null,
                                    arrivalOffset.HasValue ? d.Add(arrivalOffset.Value) : (DateTime?)null,
                                    ev.Location,
                                    ev.Description,
                                    ev.EventTypeId,
                                    ev.TeamId,
                                    ev.RivalId,
                                    ev.IsHomeMatch,
                                    null // CodActa is match-specific, never copied to generated instances
                                ))
                                .ToArray();

                            foreach (var instance in instances)
                            {
                                instance.RecurrenceId = recurrence.Id;
                            }
                        }

                        db.SportEvents.Add(ev);
                        if (recurrence is not null)
                        {
                            db.EventRecurrences.Add(recurrence);
                        }
                        if (instances.Length > 0)
                        {
                            db.SportEvents.AddRange(instances);
                        }
                        await db.SaveChangesAsync(cancellationToken);

                        return Results.Ok(new SportEventSaveResponse(
                            ev.Id, ev.Name, ev.EveDateTime, ev.StartTime, ev.EndTime, ev.ArrivalDate,
                            ev.Location, ev.Description, ev.EventTypeId, ev.TeamId, ev.RivalId,
                            ev.IsHomeMatch, ev.CodActa,
                            ev.RecurrenceId, ev.IsRecurrenceMaster,
                            recurrence?.InstanceCount));
```
Remove the old `db.SportEvents.Add(ev); await db.SaveChangesAsync(...); return Results.Ok(new SportEventSaveResponse(...))` lines this replaces — do not leave both.
Add `using System.Linq;` if not already present (needed for `.Skip`/`.Select`/`.ToArray`).

`dotnet build` — confirm clean.

## 4. Integration test — persistence round-trip against real Postgres

Create `tests/RFFM.Api.Tests/IntegrationTests/EventRecurrencePersistenceTests.cs`:
```csharp
#nullable enable
using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Proves the EventRecurrence table + SportEvent.RecurrenceId/IsRecurrenceMaster columns from
    /// the AddEventRecurrence migration round-trip correctly against a real Postgres instance —
    /// i.e. the EF configuration/migration in design.md §6 is actually correct, not just
    /// compiling. Builds entities the same way CreateSportEvent's endpoint handler does.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class EventRecurrencePersistenceTests
    {
        private readonly PostgresContainerFixture _fixture;

        public EventRecurrencePersistenceTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        [Fact]
        public async Task WeeklySeries_PersistsMasterAndInstancesLinkedByOneRecurrenceId()
        {
            // Arrange: seed a team the same way other integration tests seed a club — check
            // whichever existing fixture/helper seeds a Team for SportEvent's required TeamId FK
            // (see other tests under IntegrationTests/ or Domain/Aggregates for the Team factory);
            // adapt this seeding block to match the real Team.Create(...) signature.
            await using var setupDb = _fixture.CreateDbContext();
            // ... seed a Team, capture its Id as teamId ...

            var master = SportEvent.CreateNew(
                "Entrenamiento semanal",
                new DateTime(2026, 8, 3, 18, 0, 0, DateTimeKind.Utc),
                new DateTime(2026, 8, 3, 18, 0, 0, DateTimeKind.Utc),
                null, null, null, null,
                2, teamId, null);

            var frequency = RecurrenceFrequency.FromCode("weekly");
            var endDate = new DateTime(2026, 8, 24, 0, 0, 0, DateTimeKind.Utc);
            var dates = RecurrenceScheduler.GenerateDates(master.EveDateTime, frequency, endDate);
            var recurrence = EventRecurrence.Create(frequency, endDate, master.Id, dates.Count);
            master.RecurrenceId = recurrence.Id;
            master.IsRecurrenceMaster = true;

            var instances = dates.Skip(1)
                .Select(d => SportEvent.CreateNew(master.Name, d, d, null, null, null, null, master.EventTypeId, master.TeamId, null))
                .ToArray();
            foreach (var i in instances) i.RecurrenceId = recurrence.Id;

            await using var writeDb = _fixture.CreateDbContext();
            writeDb.SportEvents.Add(master);
            writeDb.EventRecurrences.Add(recurrence);
            writeDb.SportEvents.AddRange(instances);
            await writeDb.SaveChangesAsync();

            // Act: read back from a fresh context.
            await using var readDb = _fixture.CreateDbContext();
            var persisted = await readDb.SportEvents
                .Where(e => e.RecurrenceId == recurrence.Id)
                .ToListAsync();

            // Assert
            Assert.Equal(4, persisted.Count); // Aug 3, 10, 17, 24
            Assert.Single(persisted, e => e.IsRecurrenceMaster);
            Assert.Equal(4, persisted.Select(e => e.Id).Distinct().Count());

            var persistedRecurrence = await readDb.EventRecurrences.SingleAsync(r => r.Id == recurrence.Id);
            Assert.Equal(master.Id, persistedRecurrence.MasterEventId);
            Assert.Equal(4, persistedRecurrence.InstanceCount);
        }
    }
}
```
Before finalizing this file: find how an existing integration test (e.g. `CreateUserTransactionRollbackTests.cs` seeds a `Club`) seeds a `Team` for `SportEvent.TeamId`'s required FK — grep `Team.Create` or similar factory in `src/RFFM.Api/Domain` and replace the `// ... seed a Team ...` placeholder with a real call, mirroring the exact factory signature. Do not invent a signature; read the actual `Team` entity first.

Run:
```
docker version
```
If a daemon responds: `dotnet test --filter EventRecurrencePersistenceTests` — confirm Red first (missing columns/table) is not really achievable cleanly since this is written after the migration already exists; instead confirm Green directly, and as a sanity check temporarily rename `RecurrenceId` in the test query to a nonexistent column to prove the test would fail loudly, then revert — OR skip this contrived-Red step and treat "test passes against the real migration" as sufflicient proof, noting in the report that this test was written test-first in intent (it exercises new schema that didn't exist before step 2.3) even though the Red phase here is "migration doesn't exist yet" rather than "test fails on green schema."
If no daemon responds: skip execution, ensure `dotnet build` still compiles this file, and note the skip in the final report.

## 5. Full verification

```
cd Back/ExtractionApi
dotnet build
dotnet test
```
If the Postgres integration test cannot run (no Docker daemon): `dotnet test --filter "FullyQualifiedName!~IntegrationTests"` and report that integration coverage needs a Docker-capable environment to execute, distinctly from the rest of the suite passing 100%.

Confirm:
- No skipped (`[Fact(Skip=...)]`) tests anywhere.
- `dotnet build` zero errors/warnings introduced.
- All new unit tests green: `RecurrenceSchedulerTests`, `EventRecurrenceTests`, `CreateSportEventValidatorTests`.
- Integration test green (or explicitly, transparently reported as not-run due to environment, with the reason stated).

## 6. Final report format

Report back:
- Every file created/modified (absolute paths).
- `dotnet build` result (pass/fail, warning count).
- `dotnet test` result (pass count / total, explicitly call out any test not executed and why).
- The final `Recurrence` request/response contract (exact JSON shape) for `POST /api/sport-events`, ready to hand to front-specialist verbatim:
  - Request: `{ ...existing fields..., "recurrence": { "frequency": "daily" | "weekly" | "monthly", "endDate": "yyyy-MM-dd" } | null }`
  - Response: existing `SportEventSaveResponse` fields plus `"recurrenceId": string | null`, `"isRecurrenceMaster": boolean`, `"recurrenceInstanceCount": number | null`.
- Any deviation from this script (e.g. FluentValidation `When` syntax adjusted to match the codebase's actual idiom, or the `Team` seeding call in the integration test) and why.
