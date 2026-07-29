#nullable enable
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.GameModels.Queries;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Features.Coaches.GameModels.Queries.GetGameModel;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetGameModelHandlerMediaTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetGameModelHandlerMediaTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        [Fact]
        public async Task Handle_ScenarioWithMedia_ReflectsMediaUrlAndTypeInResponse()
        {
            await using var db = _fixture.CreateDbContext();

            var club = Club.Create($"GetGameModel Media Test Club {Guid.NewGuid():N}", 1);
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
                Name = "GetGameModel Media Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var model = new GameModel(team.Id, "Modelo con media", "2025-2026");
            var scenario = new GameScenario(model.Id, gameMomentId: 1, gameZoneId: 1, order: 0, "Escenario 1", "Contexto");
            scenario.UpdateMedia("https://storage.test/game-scenarios/foo.jpg", "image");
            model.Scenarios.Add(scenario);
            db.GameModels.Add(model);
            await db.SaveChangesAsync();

            var handler = new Handler(db);
            var result = await handler.Handle(new GameModelQuery(team.Id, model.Season, userId), CancellationToken.None);

            Assert.NotNull(result);
            var scenarioResponse = result!.Scenarios.Single();
            Assert.Equal("https://storage.test/game-scenarios/foo.jpg", scenarioResponse.MediaUrl);
            Assert.Equal("image", scenarioResponse.MediaType);
        }
    }
}
