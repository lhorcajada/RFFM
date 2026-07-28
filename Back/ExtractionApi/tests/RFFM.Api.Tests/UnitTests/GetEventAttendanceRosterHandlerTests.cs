#nullable enable
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Mobile.Attendance.Queries;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetEventAttendanceRosterHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetEventAttendanceRosterHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        // Same seeding pattern as ConfirmAttendanceHandlerTests.SeedTeamAndPlayerAsync.
        private async Task<(string TeamId, string TeamPlayerId)> SeedTeamAndPlayerAsync(AppDbContext db, string? alias = null)
        {
            var club = Club.Create($"Roster Test Club {Guid.NewGuid():N}", 1);
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
                Name = "Roster Test Team",
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
                Alias = alias ?? $"testplayer-{Guid.NewGuid():N}",
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

        // Same as SeedTeamAndPlayerAsync but also returns ClubId/SeasonId so a second
        // TeamPlayer can be added to the same team without re-querying the DB.
        private async Task<(string TeamId, string TeamPlayerId, string ClubId, string SeasonId)> SeedTeamAndTwoPlayersAsync(AppDbContext db)
        {
            var club = Club.Create($"Roster Test Club {Guid.NewGuid():N}", 1);
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
                Name = "Roster Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var player = Player.Create(new PlayerModelBase
            {
                Name = "First",
                LastName = "Player",
                Alias = "mixed-pending-player",
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

            return (team.Id, teamPlayer.Id, club.Id, season.Id);
        }

        [Fact]
        public async Task Handle_PlayerWithNoConfirmation_ReturnsPendingStatus()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var sportEventId = Guid.NewGuid().ToString();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db, "no-confirmation-player");

            var handler = new GetEventAttendanceRoster.Handler(db);
            var query = new GetEventAttendanceRoster.EventAttendanceRosterQuery
            {
                EventId = sportEventId,
                TeamId = teamId
            };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var row = Assert.Single(result, r => r.TeamPlayerId == teamPlayerId);
            Assert.Equal(AttendanceStatus.Pending.Name, row.Status);
            Assert.Equal(AttendanceStatus.Pending.Id, row.StatusId);
        }

        [Fact]
        public async Task Handle_PlayerWithExistingConfirmation_ReturnsThatStatus()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var sportEventId = Guid.NewGuid().ToString();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db, "going-player");

            var confirmation = new EventAttendanceConfirmation(
                sportEventId,
                teamPlayerId,
                Guid.NewGuid().ToString(),
                AttendanceStatus.Going.Id);
            db.Set<EventAttendanceConfirmation>().Add(confirmation);
            await db.SaveChangesAsync();

            var handler = new GetEventAttendanceRoster.Handler(db);
            var query = new GetEventAttendanceRoster.EventAttendanceRosterQuery
            {
                EventId = sportEventId,
                TeamId = teamId
            };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var row = Assert.Single(result, r => r.TeamPlayerId == teamPlayerId);
            Assert.Equal(AttendanceStatus.Going.Name, row.Status);
            Assert.Equal(AttendanceStatus.Going.Id, row.StatusId);
        }

        [Fact]
        public async Task Handle_MultiplePlayersMixedConfirmations_ReturnsCorrectStatusPerPlayer()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var sportEventId = Guid.NewGuid().ToString();
            var (teamId, pendingPlayerId, clubId, seasonId) = await SeedTeamAndTwoPlayersAsync(db);

            var secondPlayer = Player.Create(new PlayerModelBase
            {
                Name = "Second",
                LastName = "Player",
                Alias = "mixed-notgoing-player",
                ClubId = clubId
            });
            db.Players.Add(secondPlayer);
            await db.SaveChangesAsync();

            var secondTeamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = secondPlayer.Id,
                TeamId = teamId,
                SeasonId = seasonId,
                JoinedDate = DateTime.UtcNow,
                Dorsal = null,
                FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(secondTeamPlayer);
            await db.SaveChangesAsync();

            var confirmation = new EventAttendanceConfirmation(
                sportEventId,
                secondTeamPlayer.Id,
                Guid.NewGuid().ToString(),
                AttendanceStatus.NotGoing.Id);
            db.Set<EventAttendanceConfirmation>().Add(confirmation);
            await db.SaveChangesAsync();

            var handler = new GetEventAttendanceRoster.Handler(db);
            var query = new GetEventAttendanceRoster.EventAttendanceRosterQuery
            {
                EventId = sportEventId,
                TeamId = teamId
            };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.Equal(2, result.Length);
            var pendingRow = Assert.Single(result, r => r.TeamPlayerId == pendingPlayerId);
            Assert.Equal(AttendanceStatus.Pending.Name, pendingRow.Status);
            var notGoingRow = Assert.Single(result, r => r.TeamPlayerId == secondTeamPlayer.Id);
            Assert.Equal(AttendanceStatus.NotGoing.Name, notGoingRow.Status);
        }
    }
}
