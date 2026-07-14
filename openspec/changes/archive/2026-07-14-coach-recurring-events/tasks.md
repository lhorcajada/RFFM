## 1. Domain model

- [ ] 1.1 Create `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Assistances/RecurrenceFrequency.cs` — hand-rolled enum (`Daily`/`Weekly`/`Monthly`), mirroring `SportEventType.cs`: `Id`, `Name`, `List()`, `From(int)`, `FromCode(string)`, `Next(DateTime)`.
- [ ] 1.2 Create `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Assistances/RecurrenceConstants.cs` — `public const int MaxInstances = 52;`.
- [ ] 1.3 Create `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Assistances/RecurrenceScheduler.cs` — static `GenerateDates(DateTime startUtc, RecurrenceFrequency frequency, DateTime endUtc) : IReadOnlyList<DateTime>`, stepping via `frequency.Next(...)` while `<= endUtc`. Pure, no EF/DB dependency — this is what both the validator and the handler call, and what unit tests target directly.
- [ ] 1.4 Create `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Assistances/EventRecurrence.cs` — `BaseEntity` subclass per design.md §1 (`FrequencyId`, `EndDate`, `MasterEventId`, `InstanceCount`, private ctor + `Create(...)` factory with invariant checks).
- [ ] 1.5 Edit `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Assistances/SportEvent.cs` — add `RecurrenceId` (string?), `IsRecurrenceMaster` (bool, default false), `Recurrence` (nav property, `EventRecurrence?`). No constructor changes needed (set via property assignment in the handler, consistent with how `SelectedKitNumber` is set post-construction elsewhere).
- Verify: `dotnet build` from `Back/ExtractionApi` — no compile errors.

## 2. Persistence

- [ ] 2.1 Create `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Aggregates/Assistances/EventRecurrenceEntityConfiguration.cs` — table `EventRecurrences`, PK `Id`, required `FrequencyId`/`EndDate`/`MasterEventId`/`InstanceCount`, `HasOne(MasterEvent).WithMany().HasForeignKey(MasterEventId)`.
- [ ] 2.2 Edit `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Aggregates/Assistances/SportEventEntityConfiguration.cs` — add `RecurrenceId` (optional, FK), `IsRecurrenceMaster` (required, default `false`), and `HasOne(se => se.Recurrence).WithMany(r => r.Events).HasForeignKey(se => se.RecurrenceId)` with `OnDelete(DeleteBehavior.SetNull)`.
- [ ] 2.3 Confirm `EventRecurrences` `DbSet` is exposed on `AppDbContext` (`Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/AppDbContext.cs`) — add `public DbSet<EventRecurrence> EventRecurrences => Set<EventRecurrence>();` alongside the existing `SportEvents` DbSet if not auto-discovered.
- [ ] 2.4 Run `cd Back/ExtractionApi && .\manage-migrations.ps1 -Action create -MigrationName AddEventRecurrence -Context AppDbContext` and inspect the generated migration for the expected table + two new nullable/defaulted columns before applying.
- Verify: `dotnet build`; review migration `Up()`/`Down()` are purely additive (no data loss on rollback).

## 3. Command / validator / handler

- [ ] 3.1 Edit `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/SportEvents/Commands/CreateSportEvent.cs`:
  - Add `RecurrenceRequest(string Frequency, DateTime EndDate)` record and `Recurrence` field on `CreateSportEventRequest`.
  - Extend `CreateSportEventValidator` with the frequency/end-date/52-cap rules from design.md §5 (reuse `RecurrenceScheduler.GenerateDates`).
  - Extend the endpoint delegate to build `EventRecurrence` + instance `SportEvent`s per design.md §4 when `req.Recurrence` is set.
  - Extend `SportEventSaveResponse` with `RecurrenceId`, `IsRecurrenceMaster`, `RecurrenceInstanceCount` and populate them in the `Results.Ok(...)` call.
- [ ] 3.2 Double check `CodActa` is **not** propagated to generated instances (per design.md risk note) — explicit `null` with a one-line comment.
- Verify: `dotnet build`.

## 4. Tests (xUnit + Moq)

- [ ] 4.1 New file `RecurrenceSchedulerTests.cs` (adjacent to `RecurrenceScheduler.cs` or under the project's existing test folder pattern — check `Back/ExtractionApi/tests/` for where sibling domain tests live): cases for daily/weekly/monthly stepping, boundary where `endUtc` lands exactly on a generated date (inclusive), and a case producing exactly 52 vs. 53 dates.
- [ ] 4.2 New file `CreateSportEventValidatorTests.cs` (or extend an existing one if `CreateSportEventValidator` already has tests): valid recurrence passes; invalid frequency string fails; end date before event date fails; a combination producing 53 instances fails with the expected error message; a combination producing exactly 52 passes.
- [ ] 4.3 If an existing integration-test harness hits the minimal-API endpoint directly (check `Back/ExtractionApi/tests/` for `WebApplicationFactory`-style tests), add one asserting that a recurring `POST /api/sport-events` call persists `1 + N` `SportEvent` rows sharing one `RecurrenceId`, with only the first flagged `IsRecurrenceMaster`.
- Verify: `dotnet test` — 100% pass, no skipped tests.

## 5. Wrap-up

- [ ] 5.1 `dotnet build` + `dotnet test` clean from `Back/ExtractionApi`.
- [ ] 5.2 Manually exercise `POST /api/sport-events` with and without `recurrence` via the running API (`dotnet run --project src/RFFM.Host`) to confirm response shape matches design.md §3 before handing the contract to front-specialist.
- [ ] 5.3 Flag to the user/front-specialist that the frontend checkbox/frequency-selector UI is a separate, not-yet-started change depending on this contract.
