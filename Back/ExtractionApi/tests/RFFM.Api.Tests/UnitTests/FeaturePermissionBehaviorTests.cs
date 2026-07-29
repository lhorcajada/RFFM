#nullable enable
using Mediator;
using Moq;
using RFFM.Api.Common;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Services;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class FeaturePermissionBehaviorTests
    {
        private readonly PostgresContainerFixture _fixture;

        public FeaturePermissionBehaviorTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        public record TestRequest : IRequest<Unit>, IRequireFeaturePermission
        {
            public string FeatureRoute => "/coach/clubs";
            public string RequiredPermission => "Write";
        }

        private static ValueTask<Unit> Next(TestRequest r, CancellationToken ct) => ValueTask.FromResult(Unit.Value);

        public record TestReadRequest : IRequest<Unit>, IRequireFeaturePermission
        {
            public string FeatureRoute => "/coach/clubs";
            public string RequiredPermission => "Read";
        }

        private static ValueTask<Unit> NextRead(TestReadRequest r, CancellationToken ct) => ValueTask.FromResult(Unit.Value);

        [Fact]
        public async Task Handle_NotAuthenticated_ThrowsUnauthorizedAccessException()
        {
            await using var db = _fixture.CreateDbContext();
            var currentUser = new Mock<ICurrentUserService>();
            currentUser.Setup(c => c.IsAuthenticated).Returns(false);

            var behavior = new FeaturePermissionBehavior<TestRequest, Unit>(currentUser.Object, db);

            await Assert.ThrowsAsync<UnauthorizedAccessException>(
                async () => await behavior.Handle(new TestRequest(), Next, CancellationToken.None));
        }

        [Fact]
        public async Task Handle_AuthenticatedNoFeaturePermissionRow_ThrowsForbiddenAccessException()
        {
            await using var db = _fixture.CreateDbContext();
            var currentUser = new Mock<ICurrentUserService>();
            currentUser.Setup(c => c.IsAuthenticated).Returns(true);
            var singleRole = $"Coach-{Guid.NewGuid():N}"; // rol único, sin fila seed
            currentUser.Setup(c => c.Role).Returns(singleRole);
            currentUser.Setup(c => c.Roles).Returns(new[] { singleRole });

            var behavior = new FeaturePermissionBehavior<TestRequest, Unit>(currentUser.Object, db);

            await Assert.ThrowsAsync<ForbiddenAccessException>(
                async () => await behavior.Handle(new TestRequest(), Next, CancellationToken.None));
        }

        [Fact]
        public async Task Handle_InsufficientPermissionType_ThrowsForbiddenAccessException()
        {
            await using var db = _fixture.CreateDbContext();
            var role = $"RoleReadOnly-{Guid.NewGuid():N}";
            db.FeaturePermissions.Add(new FeaturePermission("ClubManagement", "/coach/clubs", role, PermissionType.Read, true));
            await db.SaveChangesAsync();

            var currentUser = new Mock<ICurrentUserService>();
            currentUser.Setup(c => c.IsAuthenticated).Returns(true);
            currentUser.Setup(c => c.Role).Returns(role);
            currentUser.Setup(c => c.Roles).Returns(new[] { role });

            var behavior = new FeaturePermissionBehavior<TestRequest, Unit>(currentUser.Object, db);

            await Assert.ThrowsAsync<ForbiddenAccessException>(
                async () => await behavior.Handle(new TestRequest(), Next, CancellationToken.None));
        }

        [Fact]
        public async Task Handle_SufficientReadWritePermission_CallsNext()
        {
            await using var db = _fixture.CreateDbContext();
            var role = $"RoleReadWrite-{Guid.NewGuid():N}";
            db.FeaturePermissions.Add(new FeaturePermission("ClubManagement", "/coach/clubs", role, PermissionType.ReadWrite, true));
            await db.SaveChangesAsync();

            var currentUser = new Mock<ICurrentUserService>();
            currentUser.Setup(c => c.IsAuthenticated).Returns(true);
            currentUser.Setup(c => c.Role).Returns(role);
            currentUser.Setup(c => c.Roles).Returns(new[] { role });

            var behavior = new FeaturePermissionBehavior<TestRequest, Unit>(currentUser.Object, db);
            var result = await behavior.Handle(new TestRequest(), Next, CancellationToken.None);

            Assert.Equal(Unit.Value, result);
        }

        [Fact]
        public async Task Handle_CoachRoleWithSeededWritePermission_CallsNext()
        {
            // Mirrors the seed row added to SeedFeaturePermissionsAsync
            // ("ClubManagement", "/coach/clubs", "Coach", PermissionType.Write, false) so a Coach
            // user (previously blocked with 403 by commit f3e776b) can create/update/delete clubs.
            await using var db = _fixture.CreateDbContext();
            const string role = "Coach";
            if (!db.FeaturePermissions.Any(fp => fp.RoleName == role && fp.FeatureRoute == "/coach/clubs"))
            {
                db.FeaturePermissions.Add(new FeaturePermission("ClubManagement", "/coach/clubs", role, PermissionType.Write, false));
                await db.SaveChangesAsync();
            }

            var currentUser = new Mock<ICurrentUserService>();
            currentUser.Setup(c => c.IsAuthenticated).Returns(true);
            currentUser.Setup(c => c.Role).Returns(role);
            currentUser.Setup(c => c.Roles).Returns(new[] { role });

            var behavior = new FeaturePermissionBehavior<TestRequest, Unit>(currentUser.Object, db);
            var result = await behavior.Handle(new TestRequest(), Next, CancellationToken.None);

            Assert.Equal(Unit.Value, result);
        }

        [Fact]
        public async Task Handle_CoachRoleClubManagementSeed_AlsoGrantsReadAccess()
        {
            // Regression: the seed row for Coach on ClubManagement ("/coach/clubs") granted only
            // PermissionType.Write (see WebApplicationExtensions.SeedFeaturePermissionsAsync), which
            // blocks GetClubs/GetClub (both require "Read") with a 403 -- Coach users could never
            // open the "Clubs" settings tab, even though they were meant to manage it. Must be
            // ReadWrite so both the Read-required queries and the Write-required commands succeed.
            await using var db = _fixture.CreateDbContext();
            var role = $"Coach-{Guid.NewGuid():N}";
            db.FeaturePermissions.Add(new FeaturePermission("ClubManagement", "/coach/clubs", role, PermissionType.ReadWrite, false));
            await db.SaveChangesAsync();

            var currentUser = new Mock<ICurrentUserService>();
            currentUser.Setup(c => c.IsAuthenticated).Returns(true);
            currentUser.Setup(c => c.Role).Returns(role);
            currentUser.Setup(c => c.Roles).Returns(new[] { role });

            var behavior = new FeaturePermissionBehavior<TestReadRequest, Unit>(currentUser.Object, db);
            var result = await behavior.Handle(new TestReadRequest(), NextRead, CancellationToken.None);

            Assert.Equal(Unit.Value, result);
        }

        [Fact]
        public async Task Handle_MultipleRoles_SecondaryRoleHasPermission_CallsNext()
        {
            // Regression test: a user with TWO roles (e.g. "Federacion" and "Coach") must be
            // granted access if ANY of their roles has the required FeaturePermission, even if
            // the first role in the claims collection does not.
            await using var db = _fixture.CreateDbContext();
            var primaryRoleWithoutAccess = $"Federacion-{Guid.NewGuid():N}";
            var secondaryRoleWithAccess = $"Coach-{Guid.NewGuid():N}";
            db.FeaturePermissions.Add(new FeaturePermission(
                "ClubManagement", "/coach/clubs", secondaryRoleWithAccess, PermissionType.ReadWrite, true));
            await db.SaveChangesAsync();

            var currentUser = new Mock<ICurrentUserService>();
            currentUser.Setup(c => c.IsAuthenticated).Returns(true);
            currentUser.Setup(c => c.Role).Returns(primaryRoleWithoutAccess);
            currentUser.Setup(c => c.Roles).Returns(new[] { primaryRoleWithoutAccess, secondaryRoleWithAccess });

            var behavior = new FeaturePermissionBehavior<TestRequest, Unit>(currentUser.Object, db);
            var result = await behavior.Handle(new TestRequest(), Next, CancellationToken.None);

            Assert.Equal(Unit.Value, result);
        }

        [Fact]
        public async Task Handle_AdministratorRole_BypassesEvenWithoutFeaturePermissionRow()
        {
            await using var db = _fixture.CreateDbContext();
            var currentUser = new Mock<ICurrentUserService>();
            currentUser.Setup(c => c.IsAuthenticated).Returns(true);
            currentUser.Setup(c => c.Role).Returns(AppRoles.Administrator.Name);
            currentUser.Setup(c => c.Roles).Returns(new[] { AppRoles.Administrator.Name });

            var behavior = new FeaturePermissionBehavior<TestRequest, Unit>(currentUser.Object, db);
            var result = await behavior.Handle(new TestRequest(), Next, CancellationToken.None);

            Assert.Equal(Unit.Value, result);
        }
    }

    public class ClubCommandsPermissionTests
    {
        [Fact]
        public void CreateClubCommand_ImplementsIRequireFeaturePermission_WithClubsRoute()
        {
            var command = new RFFM.Api.Features.Coaches.Clubs.Commands.CreateClubCommand();
            var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(command);
            Assert.Equal("/coach/clubs", requirement.FeatureRoute);
            Assert.Equal("Write", requirement.RequiredPermission);
        }

        [Fact]
        public void UpdateClubCommand_ImplementsIRequireFeaturePermission_WithClubsRoute()
        {
            var command = new RFFM.Api.Features.Coaches.Clubs.Commands.UpdateClubCommand();
            var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(command);
            Assert.Equal("/coach/clubs", requirement.FeatureRoute);
            Assert.Equal("Write", requirement.RequiredPermission);
        }

        [Fact]
        public void DeleteClubCommand_ImplementsIRequireFeaturePermission_WithClubsRoute()
        {
            var command = new RFFM.Api.Features.Coaches.Clubs.Commands.DeleteClubCommand();
            var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(command);
            Assert.Equal("/coach/clubs", requirement.FeatureRoute);
            Assert.Equal("Write", requirement.RequiredPermission);
        }
    }

    public class AllowedFeatureQueriesPermissionTests
    {
        [Fact]
        public void PlayersByTeamQuery_ImplementsIRequireFeaturePermission_WithSquadRoute()
        {
            var query = new RFFM.Api.Features.Coaches.Players.Queries.GetPlayersByTeam.PlayersByTeamQuery { TeamId = "test" };
            var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(query);
            Assert.Equal("/coach/squad", requirement.FeatureRoute);
            Assert.Equal("Read", requirement.RequiredPermission);
        }

        [Fact]
        public void SportEventsQuery_ImplementsIRequireFeaturePermission_WithEventsRoute()
        {
            var query = new RFFM.Api.Features.Coaches.SportEvents.Queries.GetSportEvents.SportEventsQuery
            {
                TeamId = "test",
                PageNumber = 1,
                PageSize = 10
            };
            var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(query);
            Assert.Equal("/coach/attendance", requirement.FeatureRoute);
            Assert.Equal("Read", requirement.RequiredPermission);
        }

        [Fact]
        public void TrainingAttendanceSummaryQuery_ImplementsIRequireFeaturePermission_WithAttendanceSummaryRoute()
        {
            var query = new RFFM.Api.Features.Coaches.Assistances.Queries.GetTrainingAttendanceSummary.Query
            {
                TeamId = "test"
            };
            var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(query);
            Assert.Equal("/coach/attendance/summary", requirement.FeatureRoute);
            Assert.Equal("Read", requirement.RequiredPermission);
        }

        [Fact]
        public void EventConvocationsQuery_ImplementsIRequireFeaturePermission_WithConvocationsRoute()
        {
            var query = new RFFM.Api.Features.Coaches.Convocations.GetEventConvocations.EventConvocationsQuery
            {
                EventId = "test"
            };
            var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(query);
            Assert.Equal("/coach/convocations", requirement.FeatureRoute);
            Assert.Equal("Read", requirement.RequiredPermission);
        }
    }

    public class BlockedFeatureCommandsPermissionTests
    {
        [Fact]
        public void CreateRivalCommand_ImplementsIRequireFeaturePermission_WithRivalsRoute()
        {
            var command = new RFFM.Api.Features.Coaches.Rivals.Commands.CreateRivalCommand();
            var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(command);
            Assert.Equal(CoachFeatureRoutes.Rivals, requirement.FeatureRoute);
            Assert.Equal("ReadWrite", requirement.RequiredPermission);
        }

        [Fact]
        public void GetRivalsQuery_ImplementsIRequireFeaturePermission_WithRivalsRoute()
        {
            var query = new RFFM.Api.Features.Coaches.Rivals.Queries.GetRivals.RivalsQuery();
            var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(query);
            Assert.Equal(CoachFeatureRoutes.Rivals, requirement.FeatureRoute);
            Assert.Equal("Read", requirement.RequiredPermission);
        }

        [Fact]
        public void DeleteGameModelCommand_ImplementsIRequireFeaturePermission_WithGameModelRoute()
        {
            var command = new RFFM.Api.Features.Coaches.GameModels.Commands.DeleteGameModelCommand("id", "user");
            var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(command);
            Assert.Equal(CoachFeatureRoutes.GameModel, requirement.FeatureRoute);
            Assert.Equal("ReadWrite", requirement.RequiredPermission);
        }

        [Fact]
        public void GameModelQuery_ImplementsIRequireFeaturePermission_WithGameModelRoute()
        {
            var query = new RFFM.Api.Features.Coaches.GameModels.Queries.GetGameModel.GameModelQuery("team", "season", "user");
            var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(query);
            Assert.Equal(CoachFeatureRoutes.GameModel, requirement.FeatureRoute);
            Assert.Equal("Read", requirement.RequiredPermission);
        }

        [Fact]
        public void GetSeasonAccessQuery_ImplementsIRequireFeaturePermission_WithSeasonAccessRoute()
        {
            var query = new RFFM.Api.Features.Coaches.SeasonAccess.GetSeasonAccess.GetSeasonAccessQuery("season", "category");
            var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(query);
            Assert.Equal(CoachFeatureRoutes.SeasonAccess, requirement.FeatureRoute);
            Assert.Equal("Read", requirement.RequiredPermission);
        }

        [Fact]
        public void UpsertSeasonAccessPlayerCommand_ImplementsIRequireFeaturePermission_WithSeasonAccessRoute()
        {
            var command = new RFFM.Api.Features.Coaches.SeasonAccess.UpsertSeasonAccessPlayer.UpsertSeasonAccessPlayerCommand(null!);
            var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(command);
            Assert.Equal(CoachFeatureRoutes.SeasonAccess, requirement.FeatureRoute);
            Assert.Equal("ReadWrite", requirement.RequiredPermission);
        }

        [Fact]
        public void GetConfigQuery_ImplementsIRequireFeaturePermission_WithSettingsRoute()
        {
            var query = new RFFM.Api.Features.Coaches.Settings.ConfigurationCoachModule.GetConfigQuery();
            var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(query);
            Assert.Equal(CoachFeatureRoutes.Settings, requirement.FeatureRoute);
            Assert.Equal("Read", requirement.RequiredPermission);
        }

        [Fact]
        public void CreateConfigCommand_ImplementsIRequireFeaturePermission_WithSettingsRoute()
        {
            var command = new RFFM.Api.Features.Coaches.Settings.ConfigurationCoachModule.CreateConfigCommand(null!);
            var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(command);
            Assert.Equal(CoachFeatureRoutes.Settings, requirement.FeatureRoute);
            Assert.Equal("ReadWrite", requirement.RequiredPermission);
        }

        [Fact]
        public void GetClubQueryApp_ImplementsIRequireFeaturePermission_WithClubManagementRoute()
        {
            var query = new RFFM.Api.Features.Coaches.Clubs.Queries.GetClub.GetClubQueryApp { ClubId = "test" };
            var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(query);
            Assert.Equal(CoachFeatureRoutes.ClubManagement, requirement.FeatureRoute);
            Assert.Equal("Read", requirement.RequiredPermission);
        }

        [Fact]
        public void ClubsQueryApp_ImplementsIRequireFeaturePermission_WithClubManagementRoute()
        {
            var query = new RFFM.Api.Features.Coaches.Clubs.Queries.GetClubs.ClubsQueryApp();
            var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(query);
            Assert.Equal(CoachFeatureRoutes.ClubManagement, requirement.FeatureRoute);
            Assert.Equal("Read", requirement.RequiredPermission);
        }

        [Fact]
        public void PlayersQuery_ClubLevel_ImplementsIRequireFeaturePermission_WithClubPlayersRoute()
        {
            var query = new RFFM.Api.Features.Coaches.Players.Queries.GetPlayers.PlayersQuery { ClubId = "test" };
            var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(query);
            Assert.Equal(CoachFeatureRoutes.ClubPlayers, requirement.FeatureRoute);
            Assert.Equal("Read", requirement.RequiredPermission);
        }

        [Fact]
        public void CreateTeamCommand_ImplementsIRequireFeaturePermission_WithClubTeamsRoute()
        {
            var command = new RFFM.Api.Features.Coaches.Teams.Commands.CreateTeamCommand();
            var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(command);
            Assert.Equal(CoachFeatureRoutes.ClubTeams, requirement.FeatureRoute);
            Assert.Equal("ReadWrite", requirement.RequiredPermission);
        }

        [Fact]
        public void TeamsQuery_ImplementsIRequireFeaturePermission_WithClubTeamsRoute()
        {
            var query = new RFFM.Api.Features.Coaches.Teams.Queries.GetTeams.TeamsQuery("club", "user");
            var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(query);
            Assert.Equal(CoachFeatureRoutes.ClubTeams, requirement.FeatureRoute);
            Assert.Equal("Read", requirement.RequiredPermission);
        }

        [Fact]
        public void ApproveClubJoinRequestCommand_ImplementsIRequireFeaturePermission_WithClubRegistrationsRoute()
        {
            var command = new RFFM.Api.Features.Coaches.ClubJoinRequests.Commands.ApproveClubJoinRequestCommand();
            var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(command);
            Assert.Equal(CoachFeatureRoutes.ClubRegistrations, requirement.FeatureRoute);
            Assert.Equal("ReadWrite", requirement.RequiredPermission);
        }

        [Fact]
        public void GetClubJoinRequestsQuery_ImplementsIRequireFeaturePermission_WithClubRegistrationsRoute()
        {
            var query = new RFFM.Api.Features.Coaches.ClubJoinRequests.Queries.ClubJoinRequestsQuery();
            var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(query);
            Assert.Equal(CoachFeatureRoutes.ClubRegistrations, requirement.FeatureRoute);
            Assert.Equal("Read", requirement.RequiredPermission);
        }

        [Fact]
        public void DeleteExerciseCommand_ImplementsIRequireFeaturePermission_WithTrainingsRoute()
        {
            var command = new RFFM.Api.Features.Coaches.Trainings.Exercises.DeleteExerciseCommand("id", "user");
            var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(command);
            Assert.Equal(CoachFeatureRoutes.Trainings, requirement.FeatureRoute);
            Assert.Equal("ReadWrite", requirement.RequiredPermission);
        }

        [Fact]
        public void GetExercisesQuery_ImplementsIRequireFeaturePermission_WithTrainingsRoute()
        {
            var query = new RFFM.Api.Features.Coaches.Trainings.Exercises.GetExercisesQuery("club", null, null, null, null, "user");
            var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(query);
            Assert.Equal(CoachFeatureRoutes.Trainings, requirement.FeatureRoute);
            Assert.Equal("Read", requirement.RequiredPermission);
        }

        [Fact]
        public void DeleteSessionCommand_ImplementsIRequireFeaturePermission_WithTrainingsRoute()
        {
            var command = new RFFM.Api.Features.Coaches.Trainings.Sessions.DeleteSessionCommand("id", "user");
            var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(command);
            Assert.Equal(CoachFeatureRoutes.Trainings, requirement.FeatureRoute);
            Assert.Equal("ReadWrite", requirement.RequiredPermission);
        }
    }
}
