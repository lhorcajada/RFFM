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
            currentUser.Setup(c => c.Role).Returns($"Coach-{Guid.NewGuid():N}"); // rol único, sin fila seed

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
            var query = new RFFM.Api.Features.Coaches.Trainings.Exercises.GetExercisesQuery("club", null, "user");
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
