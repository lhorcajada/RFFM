#nullable enable
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.SportEvents.Queries;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetSportEventsHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetSportEventsHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string TeamId, string EventId)> SeedSportEventAsync(AppDbContext db, bool withConvocation)
        {
            var club = Club.Create($"GetSportEvents Test Club {Guid.NewGuid():N}", 1);
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
                Name = "GetSportEvents Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var sportEvent = SportEvent.CreateNew(
                "Entrenamiento",
                DateTime.UtcNow.AddDays(1),
                DateTime.UtcNow.AddDays(1),
                null, null, null, null,
                2, team.Id, null);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();

            if (withConvocation)
            {
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
                    FamilyMembers = new System.Collections.Generic.List<FamilyModel>()
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
            }

            return (team.Id, sportEvent.Id);
        }

        [Fact]
        public async Task Handle_EventWithConvocation_ReturnsHasConvokedPlayersTrue()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (teamId, eventId) = await SeedSportEventAsync(seedDb, withConvocation: true);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetSportEvents.GetSportEventsRequestHandler(db, new HttpContextAccessor());

            var result = await handler.Handle(new GetSportEvents.SportEventsQuery
            {
                TeamId = teamId,
                PageNumber = 1,
                PageSize = 10
            }, CancellationToken.None);

            var response = result.Single(e => e.Id == eventId);
            Assert.True(response.HasConvokedPlayers);
        }

        [Fact]
        public async Task Handle_EventWithoutConvocation_ReturnsHasConvokedPlayersFalse()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (teamId, eventId) = await SeedSportEventAsync(seedDb, withConvocation: false);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetSportEvents.GetSportEventsRequestHandler(db, new HttpContextAccessor());

            var result = await handler.Handle(new GetSportEvents.SportEventsQuery
            {
                TeamId = teamId,
                PageNumber = 1,
                PageSize = 10
            }, CancellationToken.None);

            var response = result.Single(e => e.Id == eventId);
            Assert.False(response.HasConvokedPlayers);
        }
    }
}
