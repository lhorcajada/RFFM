## Why

`POST /api/sport-events` (`Back/ExtractionApi/src/RFFM.Api/Features/Coaches/SportEvents/Commands/CreateSportEvent.cs`) creates exactly one `SportEvent` row per call. Coaches who run a weekly training session, a recurring meeting, or any other periodic event today must open the "Crear evento" dialog (`Front/src/apps/coach/pages/attendance/components/SportEventDialog.tsx`) and re-enter the same data once per occurrence — tedious and error-prone, and it produces a calendar (`GetSportEvents`) with no relationship between the repeated events. There is no backend concept of a recurring series at all: no entity, no validation of how many occurrences a series may generate, no way to later tell "these N events belong together."

This change adds that concept on the backend only, so the API contract exists before the frontend (a separate, later change owned by front-specialist) builds the "¿Es recurrente?" checkbox UI described by the user.

## What Changes

- Add a `EventRecurrence` concept: a master `SportEvent` plus N generated instance `SportEvent` rows, linked by a new `RecurrenceId` foreign key + frequency/end-date metadata, so a future change can implement "edit/delete this instance only" vs. "edit/delete the whole series" without a further schema migration.
- Extend `POST /api/sport-events` (`CreateSportEventCommand`... today a raw minimal-API delegate, see design.md for whether it moves to Mediator) to accept an optional `Recurrence` block: `{ frequency: "daily" | "weekly" | "monthly", endDate: "yyyy-MM-dd" }`.
- When `Recurrence` is present, generate instances from the master event's date up to (and including, if it lands exactly on) `endDate`, stepping by the chosen frequency, all sharing the same `TeamId`, `EventTypeId`, `Location`, `Description`, rival, etc. as the master.
- Enforce a hard cap of 52 generated instances (master + instances, or instances alone — see design.md for the precise counting rule) via FluentValidation, returning a `ProblemDetails` 400 rather than silently truncating — consistent with how every other `ICommand` in this codebase rejects invalid input instead of coercing it.
- EF Core migration for the new column(s)/table on `AppDbContext` (schema `app`).

## Out of Scope

- Any frontend UI work (checkbox, frequency selector, end-date picker) — tracked separately for front-specialist once this contract is reviewed.
- Editing or deleting a single instance vs. the whole series — the data model must *support* this distinction later, but no endpoint for it ships in this change.
- Recurrence for existing events retrofitted after the fact (`PUT`/`UpdateSportEvent` recurrence editing) — only creation is in scope.
- Time-zone-aware recurrence rules (e.g. DST-adjusted weekly slots) — instances reuse the same UTC time-of-day as the master, matching how `EveDateTime`/`StartTime` are already stored (`DateTime.SpecifyKind(..., DateTimeKind.Utc)`).

## Impact

- Backend only: `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Assistances/` (new entity + `SportEvent` changes), `Infrastructure/Persistence/Configuration/Aggregates/Assistances/` (new EF config), `Infrastructure/Migrations/` (new migration against `AppDbContext`/`CatalogConnection`), `Features/Coaches/SportEvents/Commands/CreateSportEvent.cs` (request/validator/handler), new xUnit tests.
- No frontend files touched by this change.
