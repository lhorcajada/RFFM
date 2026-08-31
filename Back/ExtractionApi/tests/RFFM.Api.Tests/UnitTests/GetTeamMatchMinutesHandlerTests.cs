#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Players.Queries;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetTeamMatchMinutesHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetTeamMatchMinutesHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string TeamId, string SeasonId, string ClubId)> SeedTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"GetTeamMatchMinutes Test Club {Guid.NewGuid():N}", 1);
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
                Name = "GetTeamMatchMinutes Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return (team.Id, season.Id, club.Id);
        }

        private async Task<string> SeedEventAsync(AppDbContext db, string teamId, string eventName)
        {
            var sportEvent = SportEvent.CreateNew(
                eventName,
                DateTime.UtcNow.AddDays(1),
                DateTime.UtcNow.AddDays(1),
                null, null, null, null,
                2, teamId, null);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();

            return sportEvent.Id;
        }

        private async Task<string> SeedTeamPlayerAsync(AppDbContext db, string teamId, string seasonId, string clubId)
        {
            var player = Player.Create(new PlayerModelBase
            {
                Name = "Test",
                LastName = "Player",
                Alias = $"testplayer-{Guid.NewGuid():N}",
                ClubId = clubId
            });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = teamId,
                SeasonId = seasonId,
                JoinedDate = DateTime.UtcNow,
                Dorsal = null,
                FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();

            return teamPlayer.Id;
        }

        private async Task SeedParticipationAsync(
            AppDbContext db,
            string eventId,
            string teamId,
            string teamPlayerId,
            int minutesPlayed,
            string matchPhase)
        {
            var participation = MatchParticipation.Create(
                eventId,
                teamId,
                teamPlayerId,
                minutesPlayed,
                isStarter: true,
                enteredAtMinute: 0,
                exitedAtMinute: null,
                scoreLocal: 0,
                scoreVisitor: 0,
                matchPhase: matchPhase,
                substitutionWindowsJson: null,
                ratingSnapshotsJson: null,
                goalsJson: null);
            db.MatchParticipations.Add(participation);
            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task Handle_TeamWithFinishedParticipationsAcrossMultipleEventsAndPlayers_ReturnsOneRowPerParticipation()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (teamId, seasonId, clubId) = await SeedTeamAsync(seedDb);

            var eventOne = await SeedEventAsync(seedDb, teamId, "Partido 1");
            var eventTwo = await SeedEventAsync(seedDb, teamId, "Partido 2");

            var playerOne = await SeedTeamPlayerAsync(seedDb, teamId, seasonId, clubId);
            var playerTwo = await SeedTeamPlayerAsync(seedDb, teamId, seasonId, clubId);

            await SeedParticipationAsync(seedDb, eventOne, teamId, playerOne, 90, "finished");
            await SeedParticipationAsync(seedDb, eventOne, teamId, playerTwo, 45, "finished");
            await SeedParticipationAsync(seedDb, eventTwo, teamId, playerOne, 60, "finished");

            await using var db = _fixture.CreateDbContext();
            var handler = new GetTeamMatchMinutes.Handler(db);

            var result = await handler.Handle(new GetTeamMatchMinutes.Query { TeamId = teamId }, CancellationToken.None);

            Assert.Equal(3, result.Length);
            Assert.Contains(result, r => r.EventId == eventOne && r.TeamPlayerId == playerOne && r.MinutesPlayed == 90);
            Assert.Contains(result, r => r.EventId == eventOne && r.TeamPlayerId == playerTwo && r.MinutesPlayed == 45);
            Assert.Contains(result, r => r.EventId == eventTwo && r.TeamPlayerId == playerOne && r.MinutesPlayed == 60);
        }

        [Fact]
        public async Task Handle_TeamWithoutParticipations_ReturnsEmptyArray()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (teamId, _, _) = await SeedTeamAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetTeamMatchMinutes.Handler(db);

            var result = await handler.Handle(new GetTeamMatchMinutes.Query { TeamId = teamId }, CancellationToken.None);

            Assert.Empty(result);
        }

        [Fact]
        public async Task Handle_ParticipationNotFinished_IsExcludedFromResult()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (teamId, seasonId, clubId) = await SeedTeamAsync(seedDb);

            var eventId = await SeedEventAsync(seedDb, teamId, "Partido en curso");
            var playerId = await SeedTeamPlayerAsync(seedDb, teamId, seasonId, clubId);

            await SeedParticipationAsync(seedDb, eventId, teamId, playerId, 30, "live");

            await using var db = _fixture.CreateDbContext();
            var handler = new GetTeamMatchMinutes.Handler(db);

            var result = await handler.Handle(new GetTeamMatchMinutes.Query { TeamId = teamId }, CancellationToken.None);

            Assert.Empty(result);
        }
    }
}
