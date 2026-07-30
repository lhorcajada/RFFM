## Context

`Front/src/apps/coach/pages/sanctions/Sanctions.tsx` and `Front/src/apps/coach/services/teamplayerSanctionService.ts` already call `GET/POST/PUT/DELETE /api/catalog/teamplayer/{id}/sanctions`, but the backend has no matching feature — every call 404s and the frontend service silently swallows the error, returning `[]`/`null`. The nearest working sibling feature is `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Commands/SetPlayerInjury.cs`, which manages `TeamPlayerInjury` records (GET/POST/PUT/DELETE, inline Minimal API, `[Authorize(Roles = "Coach,Administrator")]` on writes, open GET) and has its own EF entity, configuration, migration and regression test (`InjuryEndpointAuthorizationTests`). This change reproduces that exact pattern for sanctions and adds a new requirement not present in the frontend today: sanctions must be split into two categories — **competition** sanctions (cards/expulsions in matches) and **internal discipline** sanctions (club/team rule violations).

## Goals / Non-Goals

**Goals:**
- Ship a working backend endpoint at the exact route the (currently broken) Front already calls, so it can be reconnected later with a minimal diff.
- Model sanction category as a first-class, typed field so Front and the upcoming Mobile app can filter/render by category.
- Follow `SetPlayerInjury`'s structural pattern exactly (one file, inline Minimal API, same auth shape, same CRUD verbs) rather than introducing a new Mediator/CQRS pattern for a single sibling feature.
- Full TDD: xUnit + Moq/Testcontainers tests written first, mirroring `InjuryEndpointAuthorizationTests`.

**Non-Goals:**
- No changes to `Front/` or `Mobile/` — this is a backend-only contract delivery.
- No automatic sanction expiration/scheduling logic (e.g. auto-lifting after N matches) — `EndDate` is set manually by the coach, exactly like `TeamPlayerInjury.EndDate`.
- No cross-feature aggregation (e.g. "sanctions count per team" dashboard widget) — out of scope.

## Decisions

### 1. Inline Minimal API endpoints (not ICommand/IQueryApp), one file
`SetPlayerInjury` is the direct structural sibling and is deliberately *not* Mediator-based — its own code comment explains this was a conscious choice for these simple per-teamplayer CRUD sub-resources, gated with `[Authorize(Roles = ...)]` directly on the route delegate. Introducing CQRS/Mediator for sanctions alone would fragment the pattern between two nearly-identical features. **Decision: mirror `SetPlayerInjury` exactly** — single file `SetPlayerSanction.cs` in `Features/Coaches/Players/Commands/`, implementing `IFeatureModule`, with `[Authorize(Roles = "Coach,Administrator")]` on POST/PUT/DELETE and open `RequireAuthorization()` on GET.

*Alternative considered*: full ICommand/IQueryApp + FluentValidation, consistent with `copilot-instructions.md`'s general guidance ("a validator is required for every ICommand"). Rejected for this slice specifically because it is not an `ICommand`-shaped feature (no Mediator involved at all, same as its closest sibling) — validation is instead done inline in the route delegate (existence checks + explicit category/enum validation), matching exactly what `SetPlayerInjury` already does for its own required fields via domain-level `ArgumentException`s. This keeps the two sibling features consistent with each other, which the task explicitly prioritizes over the general Mediator convention for this specific vertical slice.

### 2. `SanctionCategory` as an `Ardalis.SmartEnum<SanctionCategory>`
`copilot-instructions.md` and the tech stack call out `Ardalis.SmartEnum` + `SmartEnum.EFCore` for domain enums ("never raw int enums"), and `AppDbContext.OnModelCreating` already calls `modelBuilder.ConfigureSmartEnum()` — the wiring exists but no concrete `SmartEnum` type has been added yet anywhere in the domain. Category is a small, closed, backend-owned set of exactly two values (not user-extensible free text like `InjuryType`/`SanctionType`), which is exactly the case `SmartEnum` is meant for.

`SanctionCategory : SmartEnum<SanctionCategory>` lives in `Domain/Entities/TeamPlayers/SanctionCategory.cs`, with two values:
```csharp
public static readonly SanctionCategory Competition = new(1, nameof(Competition));
public static readonly SanctionCategory InternalDiscipline = new(2, nameof(InternalDiscipline));
```
EF stores it as `int` (SmartEnum.EFCore's default value converter) in a new `Category` column. The API DTOs expose/accept it as its **string `Name`** (`"Competition"` / `"InternalDiscipline"`) for a readable JSON contract — `System.Text.Json`'s default string enum handling isn't used since this isn't a native C# `enum`; the feature file does the `SmartEnum.Name` ↔ string mapping explicitly in `ToResponse`/request parsing, returning a `ProblemDetails` 400 if the incoming string doesn't match a known value.

*Alternative considered*: plain `string` field like `InjuryType`/`SanctionType`, validated against a fixed allow-list in the route delegate. Simpler and closer to the sibling's "everything is a string" style, but loses type safety in the domain layer and doesn't follow the explicit `SmartEnum` convention now that a genuinely closed, non-extensible field exists to apply it to. Chosen `SmartEnum` because this is precisely the scenario the codebase's own conventions call it out for, and it costs one extra small file.

### 3. Route shape and category filtering
Routes stay identical to what the Front already calls (`/api/catalog/teamplayer/{id}/sanctions[...]`) so no frontend changes are required to "turn it on" later. `GET` gains an optional `?category=Competition|InternalDiscipline` query parameter (unknown value → `400 ProblemDetails`) so Front/Mobile can request one list at a time without over-fetching; omitting it returns both categories together (superset, backward compatible with the existing Front page which doesn't split by category today).

### 4. Entity/table naming
`TeamPlayerSanction` entity, `TeamPlayerSanctions` table (schema `app`, same schema/`AppDbContext` as `TeamPlayerInjuries`), FK to `TeamPlayer.Id` with `DeleteBehavior.Cascade`, indexes on `TeamPlayerId` and `(TeamPlayerId, EndDate)` — identical indexing strategy to `TeamPlayerInjuryEntityConfiguration`, since the query pattern (list active/all sanctions per player) is the same.

Field naming intentionally matches the frontend's existing (currently dead) `SanctionRecord` contract instead of inventing new names: `StartDate`, `SanctionType` (free text, e.g. "Expulsión"), `Description?`, `EstimatedEnd?` (free text, e.g. "2 partidos" — note this differs from injury's `EstimatedRecovery` name to match what Front already sends), `EndDate?` (null = active sanction), plus the new `Category` (required).

## Risks / Trade-offs

- **[Risk]** Introducing the first real `SmartEnum` in the domain sets a precedent/pattern other features may or may not want to follow immediately. → Mitigation: kept minimal and self-contained (one small file), doesn't touch or refactor any other feature's existing string-based fields (e.g. `InjuryType` stays a string).
- **[Risk]** No FluentValidation validator despite it being a general project convention for `ICommand`s. → Mitigation: this feature isn't `ICommand`-shaped (same as `SetPlayerInjury`); inline validation returns the same `ProblemDetails` shape via `Results.ValidationProblem`/`Results.BadRequest` that the global `Hellang.Middleware.ProblemDetails` pipeline produces for other errors, so the *contract* (RFC 7807) is preserved even though the *mechanism* differs.
- **[Risk]** Frontend `SanctionRecord` type doesn't have `category` yet — if Front is reconnected without updating the type, the new field is simply ignored by TypeScript's structural typing (extra property), no runtime break. → No action needed now; noted for whoever picks up the Front/Mobile wiring.

## Migration Plan

1. Add `TeamPlayerSanction` entity + `SanctionCategory` SmartEnum + EF configuration + `AppDbContext.TeamPlayerSanctions` DbSet.
2. Generate migration `AddTeamPlayerSanctions` via `.\manage-migrations.ps1 create AddTeamPlayerSanctions` (context `AppDbContext`).
3. Add `SetPlayerSanction.cs` feature file (routes + records + inline handlers).
4. Add regression tests mirroring `InjuryEndpointAuthorizationTests` (new file `SanctionEndpointAuthorizationTests.cs`), written first (TDD Red), then made to pass.
5. `dotnet build` + `dotnet test` (Testcontainers-backed integration tests) before considering the change done. No manual production deploy steps beyond the standard EF migration apply — additive table, no rollback complexity (drop table/migration if reverted).

## Open Questions

- None blocking; category enum values (`Competition`, `InternalDiscipline`) and their exact JSON string spelling should be confirmed with whoever implements the Mobile client before they hardcode string literals.
