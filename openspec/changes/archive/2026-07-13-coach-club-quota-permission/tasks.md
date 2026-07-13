## 1. Permissions (Red -> Green)

- [x] 1.1 Add a failing/adjusted test in `FeaturePermissionBehaviorTests.cs` (or a new test) asserting the `Coach` role has `Write` access to `/coach/clubs` once seeded (integration-style test against `PostgresContainerFixture`, seeding the row directly, or a dedicated seeder test).
- [x] 1.2 Add the `Coach` seed entry `("ClubManagement", "/coach/clubs", "Coach", 2 /* PermissionType.Write */, false)` to `SeedFeaturePermissionsAsync` in `Back/ExtractionApi/src/RFFM.Host/DependencyInjection/WebApplicationExtensions.cs`, placed with the other `// Coach` rows.
- [x] 1.3 Verify test from 1.1 passes.

## 2. Error code catalog

- [x] 2.1 Add `public const string ClubQuotaExceeded = "club_quota_exceeded";` to `Back/ExtractionApi/src/RFFM.Api/Domain/ErrorCodes.cs`, under a `// Clubs (Features/Coaches/Clubs/Commands/CreateClub.cs)` section, matching existing snake_case limit-style codes (`TeamHasPlayers`, `SeasonHasRelatedData`).

## 3. Quota enforcement (Red -> Green -> Refactor)

- [x] 3.1 Write failing unit tests for `CreateClubHandler` (Postgres-container-backed, mirroring `CreateUserHandlerTests.cs`/`FeaturePermissionBehaviorTests.cs` conventions):
  - Coach user with 0 existing creator clubs can create a club (200 / success, `UserClub.IsCreator == true` persisted).
  - Coach user already creator of 3 clubs attempting a 4th throws `DomainException` with `Code == ErrorCodes.ClubQuotaExceeded`.
  - Existing `Name`/`CountryCode` FluentValidation rules still reject empty values (via `CreateValidator`, unaffected by the quota logic — regression check only, may already exist).
- [x] 3.2 Implement the quota check in `CreateClubHandler.Handle` (`Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Clubs/Commands/CreateClub.cs`): before creating the `Club`, count `_catalogDbContext.UserClubs.CountAsync(uc => uc.ApplicationUserId == request.UserId && uc.IsCreator, cancellationToken)`; if `>= 3`, throw `new DomainException("Clubes", "Has alcanzado el número máximo de clubes que puedes crear (3).", ErrorCodes.ClubQuotaExceeded)`.
- [x] 3.3 Optionally introduce a named constant (e.g. `ClubConstants.MaxClubsPerCreator = 3`) instead of a magic number, per design.md decision 3.
- [x] 3.4 Run the tests from 3.1 and confirm green.

## 4. Verification

- [x] 4.1 Run `dotnet build` from `Back/ExtractionApi` and fix any compile errors.
- [x] 4.2 Run `dotnet test` from `Back/ExtractionApi` and confirm 100% pass, no skipped tests.
- [x] 4.3 Confirm no changes were made outside `Back/ExtractionApi/` (this is a backend-only change).
- [x] 4.4 Re-read `design.md`'s "Final 400 response contract" section and confirm the implemented `DomainException` call produces that exact `code` value and status.
