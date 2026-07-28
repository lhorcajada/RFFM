#nullable enable
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Mobile.Attendance.Commands;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class ConfirmAttendanceHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public ConfirmAttendanceHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private Mock<ICurrentUserService> MockCurrentUser(string userId, string[] roles)
        {
            var mock = new Mock<ICurrentUserService>();
            mock.Setup(u => u.UserId).Returns(userId);
            mock.Setup(u => u.IsAuthenticated).Returns(true);
            mock.Setup(u => u.Roles).Returns(roles);
            return mock;
        }

        // Same seeding pattern as InjuryEndpointAuthorizationTests.CreateTeamPlayerAsync:
        // TeamPlayer has real FKs to Team and Player, and UserTeam.LinkedTeamPlayerId has a
        // real FK to TeamPlayer, so a full graph is required for LinkPlayer() to persist.
        private async Task<(string TeamId, string TeamPlayerId)> SeedTeamAndPlayerAsync(AppDbContext db)
        {
            var club = Club.Create($"Attendance Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}",
                DateTime.UtcNow,
                DateTime.UtcNow.AddMonths(9),
                isActive: true,
                club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "Attendance Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var player = Player.Create(new PlayerModelBase
            {
                Name = "Test",
                LastName = "Player",
                Alias = $"testplayer-{Guid.NewGuid():N}",
                ClubId = club.Id
            });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = team.Id,
                SeasonId = season.Id,
                JoinedDate = DateTime.UtcNow,
                Dorsal = null,
                FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();

            return (team.Id, teamPlayer.Id);
        }

        [Fact]
        public async Task Handle_PlayerConfirmsOwnAttendance_CreatesRecord()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var userId = Guid.NewGuid().ToString();
            var sportEventId = Guid.NewGuid().ToString();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);

            var userTeam = new UserTeam(userId, teamId, Membership.Player.Id);
            db.Set<UserTeam>().Add(userTeam);
            await db.SaveChangesAsync();

            userTeam.LinkPlayer(teamPlayerId);
            await db.SaveChangesAsync();

            var mockCurrentUser = MockCurrentUser(userId, new[] { "Player" });
            var handler = new ConfirmAttendance.Handler(db, mockCurrentUser.Object);
            var cmd = new ConfirmAttendance.ConfirmAttendanceCommand
            {
                SportEventId = sportEventId,
                TeamId = teamId,
                TeamPlayerId = teamPlayerId,
                Status = "Going"
            };

            // Act
            await handler.Handle(cmd, CancellationToken.None);

            // Assert
            var created = await db.Set<EventAttendanceConfirmation>()
                .AsNoTracking()
                .FirstOrDefaultAsync(eac =>
                    eac.SportEventId == sportEventId &&
                    eac.TeamPlayerId == teamPlayerId);

            Assert.NotNull(created);
            Assert.Equal(userId, created!.ConfirmedByApplicationUserId);
            Assert.Equal(AttendanceStatus.Going.Id, created.AttendanceStatusId);
        }

        [Fact]
        public async Task Handle_FamilyMemberConfirmsLinkedPlayer_CreatesRecord()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var familyMemberId = Guid.NewGuid().ToString();
            var sportEventId = Guid.NewGuid().ToString();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);

            var userTeam = new UserTeam(familyMemberId, teamId, Membership.FamilyPlayer.Id);
            db.Set<UserTeam>().Add(userTeam);
            await db.SaveChangesAsync();

            userTeam.LinkPlayer(teamPlayerId);
            await db.SaveChangesAsync();

            var mockCurrentUser = MockCurrentUser(familyMemberId, new[] { "FamilyMember" });
            var handler = new ConfirmAttendance.Handler(db, mockCurrentUser.Object);
            var cmd = new ConfirmAttendance.ConfirmAttendanceCommand
            {
                SportEventId = sportEventId,
                TeamId = teamId,
                TeamPlayerId = teamPlayerId,
                Status = "NotGoing"
            };

            // Act
            await handler.Handle(cmd, CancellationToken.None);

            // Assert
            var created = await db.Set<EventAttendanceConfirmation>()
                .AsNoTracking()
                .FirstOrDefaultAsync(eac =>
                    eac.SportEventId == sportEventId &&
                    eac.TeamPlayerId == teamPlayerId);

            Assert.NotNull(created);
            Assert.Equal(familyMemberId, created!.ConfirmedByApplicationUserId);
            Assert.Equal(AttendanceStatus.NotGoing.Id, created.AttendanceStatusId);
        }

        [Fact]
        public async Task Handle_FamilyMemberConfirmsUnlinkedPlayer_ThrowsForbiddenAccessException()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var familyMemberId = Guid.NewGuid().ToString();
            var sportEventId = Guid.NewGuid().ToString();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var (_, unlinkedTeamPlayerId) = await SeedTeamAndPlayerAsync(db);

            var userTeam = new UserTeam(familyMemberId, teamId, Membership.FamilyPlayer.Id);
            db.Set<UserTeam>().Add(userTeam);
            await db.SaveChangesAsync();

            userTeam.LinkPlayer(teamPlayerId);
            await db.SaveChangesAsync();

            var mockCurrentUser = MockCurrentUser(familyMemberId, new[] { "FamilyMember" });
            var handler = new ConfirmAttendance.Handler(db, mockCurrentUser.Object);
            var cmd = new ConfirmAttendance.ConfirmAttendanceCommand
            {
                SportEventId = sportEventId,
                TeamId = teamId,
                TeamPlayerId = unlinkedTeamPlayerId,
                Status = "Going"
            };

            // Act & Assert
            await Assert.ThrowsAsync<ForbiddenAccessException>(
                async () => await handler.Handle(cmd, CancellationToken.None));
        }

        [Fact]
        public async Task Handle_PlayerConfirmsAnotherPlayersAttendance_ThrowsForbiddenAccessException()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var userId = Guid.NewGuid().ToString();
            var sportEventId = Guid.NewGuid().ToString();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var (_, otherTeamPlayerId) = await SeedTeamAndPlayerAsync(db);

            var userTeam = new UserTeam(userId, teamId, Membership.Player.Id);
            db.Set<UserTeam>().Add(userTeam);
            await db.SaveChangesAsync();

            userTeam.LinkPlayer(teamPlayerId);
            await db.SaveChangesAsync();

            var mockCurrentUser = MockCurrentUser(userId, new[] { "Player" });
            var handler = new ConfirmAttendance.Handler(db, mockCurrentUser.Object);
            var cmd = new ConfirmAttendance.ConfirmAttendanceCommand
            {
                SportEventId = sportEventId,
                TeamId = teamId,
                TeamPlayerId = otherTeamPlayerId,
                Status = "Going"
            };

            // Act & Assert
            await Assert.ThrowsAsync<ForbiddenAccessException>(
                async () => await handler.Handle(cmd, CancellationToken.None));
        }

        [Fact]
        public async Task Handle_CoachConfirmsAnotherPlayersAttendance_CreatesRecord()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var coachUserId = Guid.NewGuid().ToString();
            var sportEventId = Guid.NewGuid().ToString();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);

            // No UserTeam/LinkPlayer link for the Coach — they are not the player's owner.
            var mockCurrentUser = MockCurrentUser(coachUserId, new[] { "Coach" });
            var handler = new ConfirmAttendance.Handler(db, mockCurrentUser.Object);
            var cmd = new ConfirmAttendance.ConfirmAttendanceCommand
            {
                SportEventId = sportEventId,
                TeamId = teamId,
                TeamPlayerId = teamPlayerId,
                Status = "Going"
            };

            // Act
            await handler.Handle(cmd, CancellationToken.None);

            // Assert
            var created = await db.Set<EventAttendanceConfirmation>()
                .AsNoTracking()
                .FirstOrDefaultAsync(eac =>
                    eac.SportEventId == sportEventId &&
                    eac.TeamPlayerId == teamPlayerId);

            Assert.NotNull(created);
            Assert.Equal(coachUserId, created!.ConfirmedByApplicationUserId);
            Assert.Equal(AttendanceStatus.Going.Id, created.AttendanceStatusId);
        }

        [Fact]
        public async Task Handle_AdministratorConfirmsAnotherPlayersAttendance_CreatesRecord()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var adminUserId = Guid.NewGuid().ToString();
            var sportEventId = Guid.NewGuid().ToString();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);

            var mockCurrentUser = MockCurrentUser(adminUserId, new[] { "Administrator" });
            var handler = new ConfirmAttendance.Handler(db, mockCurrentUser.Object);
            var cmd = new ConfirmAttendance.ConfirmAttendanceCommand
            {
                SportEventId = sportEventId,
                TeamId = teamId,
                TeamPlayerId = teamPlayerId,
                Status = "NotGoing"
            };

            // Act
            await handler.Handle(cmd, CancellationToken.None);

            // Assert
            var created = await db.Set<EventAttendanceConfirmation>()
                .AsNoTracking()
                .FirstOrDefaultAsync(eac =>
                    eac.SportEventId == sportEventId &&
                    eac.TeamPlayerId == teamPlayerId);

            Assert.NotNull(created);
            Assert.Equal(adminUserId, created!.ConfirmedByApplicationUserId);
            Assert.Equal(AttendanceStatus.NotGoing.Id, created.AttendanceStatusId);
        }
    }
}
