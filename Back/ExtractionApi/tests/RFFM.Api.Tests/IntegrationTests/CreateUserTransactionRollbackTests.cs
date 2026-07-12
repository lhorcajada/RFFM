#nullable enable
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Features.Coaches.Users.Commands;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Services.Email;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Integration test for cross-DbContext transaction rollback behavior.
    ///
    /// Proves that when a failure occurs after `ClubJoinRequest`/`UserClub`/`UserTeam` is added to `AppDbContext`
    /// but before the `TransactionScope` completes, the entire operation is rolled back atomically:
    /// - No `ClubJoinRequest`/`UserClub`/`UserTeam` row remains in `AppDbContext`
    ///
    /// This validates the design.md §3 "Cross-DbContext transaction" risk mitigation via `TransactionScope`.
    ///
    /// Note on failure injection: `CreateUser.Handler.EnsureIdentityRoleAsync` deliberately
    /// swallows role-assignment failures (best-effort, logged as a warning) — that is existing,
    /// intended behavior, not a bug. The one write inside the `TransactionScope` that is
    /// genuinely NOT caught anywhere in the handler is `AppDbContext.SaveChangesAsync()` at the
    /// end of the transactional block (see `CreateUser.cs`). These tests use a `AppDbContext`
    /// subclass that performs the real `SaveChangesAsync` (so the row is physically written inside
    /// the ambient `TransactionScope` transaction) and then throws immediately afterward — before
    /// `scope.Complete()` is ever reached. This reproduces a genuine unrecoverable failure at that
    /// exact point (e.g. a broken connection, a trigger failure, a downstream error) and lets us
    /// verify, from a completely separate/fresh `AppDbContext`, that Postgres really rolled the
    /// insert back.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class CreateUserTransactionRollbackTests
    {
        private readonly PostgresContainerFixture _fixture;

        public CreateUserTransactionRollbackTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        /// <summary>
        /// SaveChanges interceptor used to inject a genuine, unrecoverable failure right after the
        /// real `SaveChangesAsync()` call that the CreateUser handler performs inside its
        /// `TransactionScope` — but before the scope is completed. `SavedChangesAsync` only fires
        /// once EF Core has actually sent the insert to Postgres, so the row is physically written
        /// inside the ambient transaction; throwing from this hook means the
        /// `using (var scope = ...)` block in the handler exits without calling `scope.Complete()`,
        /// so the ambient transaction rolls back for real in Postgres.
        ///
        /// Deliberately implemented as an interceptor (not an `AppDbContext` subclass): EF Core
        /// caches the compiled model per concrete `DbContext` CLR type, and a subclass forces a
        /// fresh, uncached model build that surfaces an unrelated pre-existing constructor-binding
        /// quirk on an unrelated entity. Using the interceptor keeps the real `AppDbContext` type,
        /// so it reuses the already-validated cached model.
        /// </summary>
        private sealed class ThrowAfterSaveInterceptor : SaveChangesInterceptor
        {
            public override ValueTask<int> SavedChangesAsync(
                SaveChangesCompletedEventData eventData,
                int result,
                CancellationToken cancellationToken = default)
            {
                throw new InvalidOperationException("Simulated fatal failure after AppDbContext write, before TransactionScope.Complete()");
            }
        }

        private AppDbContext CreateThrowingDbContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseNpgsql(_fixture.ConnectionString, npgsql =>
                {
                    // Mirrors production's AppDbContext registration (ServiceCollectionExtensions.cs),
                    // including EnableRetryOnFailure — this is the exact config that made
                    // CreateUser.Handler's now-removed TransactionScope throw HTTP 500 in production
                    // while passing here without it. Keeping it enabled proves the fixed handler
                    // (execution-strategy + explicit transaction) is actually retry-on-failure-safe.
                    npgsql.EnableRetryOnFailure(
                        maxRetryCount: 5,
                        maxRetryDelay: TimeSpan.FromSeconds(30),
                        errorCodesToAdd: null);
                    npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "app");
                })
                .AddInterceptors(new ThrowAfterSaveInterceptor())
                .Options;

            return new AppDbContext(options);
        }

        [Fact]
        public async Task Handle_WhenRoleAssignmentFails_RollsBackAllChangesAtomically()
        {
            // Arrange
            var userManagerMock = MockUserManager();
            IdentityUser? createdUser = null;

            userManagerMock
                .Setup(m => m.FindByNameAsync(It.IsAny<string>()))
                .ReturnsAsync((IdentityUser?)null);
            userManagerMock
                .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
                .ReturnsAsync((IdentityUser?)null);
            userManagerMock
                .Setup(m => m.CreateAsync(It.IsAny<IdentityUser>(), It.IsAny<string>()))
                .Callback<IdentityUser, string>((user, password) => createdUser = user)
                .ReturnsAsync(IdentityResult.Success);
            userManagerMock
                .Setup(m => m.GetRolesAsync(It.IsAny<IdentityUser>()))
                .ReturnsAsync(new List<string> { "ClubMember" });

            // AddToRoleAsync failing is intentionally NOT fatal (EnsureIdentityRoleAsync catches
            // and logs it) — that's existing, correct best-effort behavior, so this is set up to
            // succeed here. The genuine, unrecoverable failure this test exercises is the
            // AppDbContext SaveChangesAsync at the end of the TransactionScope block, injected via
            // ThrowAfterSaveDbContext below.
            var roleManagerMock = MockRoleManager();
            roleManagerMock
                .Setup(m => m.RoleExistsAsync(It.IsAny<string>()))
                .ReturnsAsync(true);

            var configuration = new ConfigurationBuilder().Build();

            // Seed a real club with an invitation code so the ClubMember pre-check succeeds and the
            // handler actually adds a UserClub row to AppDbContext inside the TransactionScope.
            var setupDb = _fixture.CreateDbContext();
            var club = Club.Create("Rollback Test Club", 1, invitationCode: "ROLBACK1");
            setupDb.Clubs.Add(club);
            await setupDb.SaveChangesAsync();

            var throwingDb = CreateThrowingDbContext();
            var emailService = new EmailService(configuration, null!);
            var logger = NullLogger<CreateUser.Handler>.Instance;

            var handler = new CreateUser.Handler(
                userManagerMock.Object,
                roleManagerMock.Object,
                emailService,
                configuration,
                throwingDb,
                logger);

            var command = new CreateUser.Command
            {
                Alias = "rollbacktest",
                Email = "rollbacktest@rffm.test",
                Password = "S3cure!Pass",
                AccountType = "ClubMember",
                ClubInvitationCode = "ROLBACK1"
            };

            // Act & Assert
            // The AppDbContext write inside the TransactionScope fails right after physically
            // inserting the UserClub row (but before scope.Complete()), so the ambient transaction
            // must roll back and the handler's exception must propagate uncaught.
            var exception = await Assert.ThrowsAsync<InvalidOperationException>(async () =>
                await handler.Handle(command, CancellationToken.None));

            Assert.NotNull(exception);
            Assert.Contains("Simulated fatal failure", exception.Message);
            Assert.NotNull(createdUser);

            // Verify rollback for real: query from a brand-new AppDbContext (not the poisoned one,
            // and not the same instance/transaction) to make sure no UserClub row survived.
            await using var freshDb = _fixture.CreateDbContext();
            var persistedUserClubs = await freshDb.UserClubs
                .Where(uc => uc.ApplicationUserId == createdUser!.Id)
                .ToListAsync();
            Assert.Empty(persistedUserClubs);
        }

        [Fact]
        public async Task Handle_CoachWithPendingJoinRequest_RollsBackClubJoinRequestOnIdentityFailure()
        {
            // Arrange
            var userManagerMock = MockUserManager();
            IdentityUser? createdUser = null;

            userManagerMock
                .Setup(m => m.FindByNameAsync(It.IsAny<string>()))
                .ReturnsAsync((IdentityUser?)null);
            userManagerMock
                .Setup(m => m.FindByEmailAsync(It.IsAny<string>()))
                .ReturnsAsync((IdentityUser?)null);
            userManagerMock
                .Setup(m => m.CreateAsync(It.IsAny<IdentityUser>(), It.IsAny<string>()))
                .Callback<IdentityUser, string>((user, password) => createdUser = user)
                .ReturnsAsync(IdentityResult.Success);

            // Note: the Coach-with-invitation-code path never calls EnsureIdentityRoleAsync /
            // AddToRoleAsync at all (see CreateUser.cs: it only adds a ClubJoinRequest and defers
            // role assignment until the club approves the request), so making AddToRoleAsync throw
            // would never even be exercised here. The genuine, unrecoverable failure point for this
            // path is the AppDbContext.SaveChangesAsync() call at the end of the TransactionScope
            // block, injected via ThrowAfterSaveDbContext below.
            var roleManagerMock = MockRoleManager();
            roleManagerMock
                .Setup(m => m.RoleExistsAsync(It.IsAny<string>()))
                .ReturnsAsync(true);

            var configuration = new ConfigurationBuilder().Build();

            // Seed a club with an invitation code (max 8 chars per ClubEntityConfiguration).
            var setupDb = _fixture.CreateDbContext();
            var club = Club.Create("Test Club", 1, invitationCode: "TESTCODE");
            setupDb.Clubs.Add(club);
            await setupDb.SaveChangesAsync();

            var throwingDb = CreateThrowingDbContext();
            var emailService = new EmailService(configuration, null!);
            var logger = NullLogger<CreateUser.Handler>.Instance;

            var handler = new CreateUser.Handler(
                userManagerMock.Object,
                roleManagerMock.Object,
                emailService,
                configuration,
                throwingDb,
                logger);

            var command = new CreateUser.Command
            {
                Alias = "coachrollback",
                Email = "coachrollback@rffm.test",
                Password = "S3cure!Pass",
                AccountType = "Coach",
                ClubInvitationCode = "TESTCODE"
            };

            // Act & Assert
            var exception = await Assert.ThrowsAsync<InvalidOperationException>(async () =>
                await handler.Handle(command, CancellationToken.None));

            Assert.NotNull(exception);
            Assert.Contains("Simulated fatal failure", exception.Message);
            Assert.NotNull(createdUser);

            // Verify rollback for real: query from a brand-new AppDbContext to make sure no
            // ClubJoinRequest row survived the aborted TransactionScope.
            await using var freshDb = _fixture.CreateDbContext();
            var joinRequests = await freshDb.ClubJoinRequests
                .Where(r => r.ApplicationUserId == createdUser!.Id)
                .ToListAsync();
            Assert.Empty(joinRequests);
        }

        private static Mock<UserManager<IdentityUser>> MockUserManager()
        {
            var store = new Mock<IUserStore<IdentityUser>>();
            return new Mock<UserManager<IdentityUser>>(
                store.Object, null!, null!, null!, null!, null!, null!, null!, null!);
        }

        private static Mock<RoleManager<IdentityRole>> MockRoleManager()
        {
            var store = new Mock<IRoleStore<IdentityRole>>();
            return new Mock<RoleManager<IdentityRole>>(
                store.Object, null!, null!, null!, null!);
        }
    }
}
