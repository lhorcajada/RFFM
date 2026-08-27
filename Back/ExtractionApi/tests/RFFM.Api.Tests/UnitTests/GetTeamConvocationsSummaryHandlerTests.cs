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
using RFFM.Api.Features.Coaches.Assistances.Queries;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetTeamConvocationsSummaryHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetTeamConvocationsSummaryHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<string> SeedTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"GetTeamConvocationsSummary Test Club {Guid.NewGuid():N}", 1);
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
                Name = "GetTeamConvocationsSummary Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return team.Id;
        }

        private async Task<(string EventId, string TeamPlayerId, string ConvocationId)> SeedConvocationAsync(
            AppDbContext db, string teamId, string seasonId, string clubId, string eventName)
        {
            var sportEvent = SportEvent.CreateNew(
                eventName,
                DateTime.UtcNow.AddDays(1),
                DateTime.UtcNow.AddDays(1),
                null, null, null, null,
                2, teamId, null);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();

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

            var convocation = Convocation.Create(new ConvocationModel
            {
                EventId = sportEvent.Id,
                TeamPlayerId = teamPlayer.Id,
                AssistanceTypeId = null,
                ResponseDateTime = DateTime.UtcNow,
                ConvocationStatusId = 1,
                ExcuseTypeId = null
            });
            db.Convocations.Add(convocation);
            await db.SaveChangesAsync();

            return (sportEvent.Id, teamPlayer.Id, convocation.Id);
        }

        [Fact]
        public async Task Handle_TeamWithConvocationsAcrossMultipleEvents_ReturnsOneRowPerConvocationTaggedByEvent()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(seedDb);

            var team = await seedDb.Teams.FirstAsync(t => t.Id == teamId);

            var first = await SeedConvocationAsync(seedDb, teamId, team.SeasonId, team.ClubId, "Entrenamiento 1");
            var second = await SeedConvocationAsync(seedDb, teamId, team.SeasonId, team.ClubId, "Entrenamiento 2");

            await using var db = _fixture.CreateDbContext();
            var handler = new GetTeamConvocationsSummary.Handler(db);

            var result = await handler.Handle(new GetTeamConvocationsSummary.Query { TeamId = teamId }, CancellationToken.None);

            Assert.Equal(2, result.Length);
            Assert.Contains(result, r => r.EventId == first.EventId && r.ConvocationId == first.ConvocationId);
            Assert.Contains(result, r => r.EventId == second.EventId && r.ConvocationId == second.ConvocationId);
        }

        [Fact]
        public async Task Handle_TeamWithoutConvocations_ReturnsEmptyArray()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetTeamConvocationsSummary.Handler(db);

            var result = await handler.Handle(new GetTeamConvocationsSummary.Query { TeamId = teamId }, CancellationToken.None);

            Assert.Empty(result);
        }
    }
}
