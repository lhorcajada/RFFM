## Why

Coaches who bought the app on their own must keep private ownership of the data they entered, while clubs that buy the app need a separate, safe place. Today isolation depends on per-handler checks, and a missed check would leak data between clubs.

## What Changes

- Every club gets a type, Personal space or Club, shown to users as "Espacio personal" and "Club"; every existing club becomes a Personal space.
- A Personal space is visible only to its members: it does not appear in searches or suggestions, and its name may match another club's name.
- A coach can belong to several spaces and clubs at once, each isolated from the others.
- Club-scoped data is filtered by its `ClubId` in the data layer, so requesting another club's data returns not found.
- Data belongs to whoever created it, with no ownership transfer or club claim; isolation stays logical, in one database.
- Out of this change: payment gateway integration, club creation by a directive, plan limits, seat charges, and team copy (later slices).

## Capabilities

### New Capabilities
- `space-types`: club type (Personal space or Club), the migration of existing clubs to Personal space, visibility of a Personal space, and membership in several spaces at once.
- `club-data-isolation`: data-layer filtering of club-scoped data by the clubs the authenticated user belongs to, with leak tests per filtered entity.

### Modified Capabilities

None.

## Impact

- Backend only (`Back/ExtractionApi`): `Club` entity and its EF configuration, a schema migration, `AppDbContext` global query filters, and club listing and search flows that must hide Personal spaces from non-members.
- Affected entities: `Team`, `Player`, `TaskTrainingBase`, `Season`, `UserActivityLog`.
- Real-database leak tests, one per filtered entity.
- Frontend: the labels "Espacio personal" and "Club" (internal values are never shown), and the web onboarding of players and family members sends the team join code when it requests the player list and when it verifies the identity.

## Proposal Research Documentation

**Local files**:
- Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/Club.cs - club entity without a type field
- Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/UserClub.cs - membership rows (`ApplicationUserId`, `ClubId`, `IsCreator`)
- Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/Team.cs - carries `ClubId`
- Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/AppDbContext.cs - no query filter registered today
- Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Aggregates/UserClubs/ClubEntityConfiguration.cs - club mapping
- Back/ExtractionApi/src/RFFM.Api/Features/Scopes/ScopeAuthorizationService.cs - current per-handler scope checks
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Clubs/Queries/GetClubs.cs - club listing that returns every club
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Clubs/Commands/CreateClub.cs - club creation and creator quota
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Invitation/ClubInvitationValidation.cs - invitation-code lookup over all clubs
- Back/ExtractionApi/src/RFFM.Api/Infrastructure/Services/CurrentUserService.cs - authenticated user id from the HTTP context
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Players/Player.cs - entity carrying `ClubId`
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Seasons/Season.cs - entity carrying a nullable `ClubId`
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Audit/UserActivityLog.cs - entity carrying a nullable `ClubId`
- Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Training/TasksTraining/TaskTrainingBase.cs - entity carrying `ClubId`
- Back/ExtractionApi/src/RFFM.Api/Domain/Models/PlayerModelBase.cs - entity carrying `ClubId`
- Back/ExtractionApi/tests/RFFM.Api.Tests/Fixtures/PostgresContainerFixture.cs - real PostgreSQL test fixture
- GLOSSARY.md

**External URLs**:
- None

## Additional Notes

- No `HasQueryFilter` exists in the backend today; `AppDbContext` is created with `DbContextOptions` only, and `ICurrentUserService` is registered scoped.
- `Season.ClubId` and `UserActivityLog.ClubId` are nullable.
- Some flows read clubs or teams without an authenticated user, such as the invitation-code join in `ClubInvitationValidation`.
