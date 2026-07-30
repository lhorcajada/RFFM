## 1. Domain

- [x] 1.1 Create `SanctionCategory : SmartEnum<SanctionCategory>` in `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/TeamPlayers/SanctionCategory.cs` with values `Competition` (1) and `InternalDiscipline` (2).
- [x] 1.2 Create `TeamPlayerSanction : BaseEntity` in `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/TeamPlayers/TeamPlayerSanction.cs` mirroring `TeamPlayerInjury`'s shape (`Create`, `Update`, private setters), with properties `TeamPlayerId`, `Category` (`SanctionCategory`), `StartDate`, `SanctionType`, `Description?`, `EstimatedEnd?`, `EndDate?`, plus `TeamPlayer` navigation.
- [x] 1.3 Add `public ICollection<TeamPlayerSanction> Sanctions { get; private set; } = new List<TeamPlayerSanction>();` to `TeamPlayer.cs`.

## 2. Persistence

- [x] 2.1 Add `TeamPlayerSanctionEntityConfiguration : IEntityTypeConfiguration<TeamPlayerSanction>` in `Infrastructure/Persistence/Configuration/Entities/`, mirroring `TeamPlayerInjuryEntityConfiguration` (table `TeamPlayerSanctions`, indexes on `TeamPlayerId` and `(TeamPlayerId, EndDate)`, FK cascade delete, max lengths on string fields, `Category` mapped as SmartEnum int).
- [x] 2.2 Add `DbSet<TeamPlayerSanction> TeamPlayerSanctions { get; set; }` to `AppDbContext.cs`.
- [x] 2.3 Generate EF migration `AddTeamPlayerSanctions` via `.\manage-migrations.ps1 create AddTeamPlayerSanctions` (context `AppDbContext`) and verify the generated SQL only adds the new table/indexes/FK.

## 3. Tests First (TDD Red)

- [x] 3.1 Add `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/SanctionEndpointAuthorizationTests.cs` mirroring `InjuryEndpointAuthorizationTests`: role-gated POST/PUT/DELETE (`Player`/`FamilyMember` → 403, `Coach` → success), open GET for `Player` role.
- [x] 3.2 Add scenarios for: creating a `Competition` sanction, creating an `InternalDiscipline` sanction, rejecting an unknown/missing `category` on create (400), filtering `GET ?category=` to one category, rejecting an unknown `category` query value (400), 404 on non-existent team player / sanction id, lifting a sanction via `PUT` with `endDate` set.
- [x] 3.3 Run `dotnet test --filter SanctionEndpointAuthorizationTests` and confirm all new tests fail (Red) because the feature doesn't exist yet.

## 4. Feature Implementation (TDD Green)

- [x] 4.1 Create `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Commands/SetPlayerSanction.cs` implementing `IFeatureModule`, mirroring `SetPlayerInjury.cs` structurally:
  - `GET /api/catalog/teamplayer/{id}/sanctions` (open, optional `?category=` filter, 404 if team player missing, 400 ProblemDetails on unknown category)
  - `POST /api/catalog/teamplayer/{id}/sanctions` (`[Authorize(Roles = "Coach,Administrator")]`, 400 ProblemDetails on missing/unknown category or empty `sanctionType`, 404 if team player missing, 201 Created)
  - `PUT /api/catalog/teamplayer/{id}/sanctions/{sanctionId}` (`[Authorize(Roles = "Coach,Administrator")]`, same validation, 404 if sanction/team player missing, 200 OK)
  - `DELETE /api/catalog/teamplayer/{id}/sanctions/{sanctionId}` (`[Authorize(Roles = "Coach,Administrator")]`, 404 if missing, 204 No Content)
  - `ToResponse` mapping `SanctionRecordResponse(string Id, string Category, DateTime StartDate, string SanctionType, string? Description, string? EstimatedEnd, DateTime? EndDate)`, with `Category` serialized as the SmartEnum's `Name`.
- [x] 4.2 Add the module registration check (confirm `AddFeatureModules.MapFeatures()` auto-discovers it — no manual registration expected, verify by reflection/assembly scan already in place).
- [x] 4.3 Run `dotnet test --filter SanctionEndpointAuthorizationTests` and confirm all tests now pass (Green).

## 5. Verification

- [x] 5.1 Run `dotnet build` from `Back/ExtractionApi` — must succeed with no new warnings/errors.
- [x] 5.2 Run the full `dotnet test` suite — must be 100% green, no skipped tests.
- [x] 5.3 Run `openspec validate add-player-sanctions --strict` — must pass.
- [x] 5.4 Manually confirm route naming/response shape against `proposal.md`/`design.md` (category values `Competition`/`InternalDiscipline`, field names matching the existing (dead) Front `SanctionRecord` type plus `category`).
