#nullable enable
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.UserClubs;
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
    /// <summary>
    /// Covers the new <see cref="PrincipleResponse"/> nesting level returned by GET /api/game-models
    /// (a scenario now sits inside a Principio, not directly under a moment/zone cell), and that
    /// the removed "Principios tácticos colectivos" field no longer appears in the response shape.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class GetGameModelPrincipleShapeTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetGameModelPrincipleShapeTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        [Fact]
        public async Task Handle_ReturnsScenariosNestedUnderPrinciple()
        {
            await using var db = _fixture.CreateDbContext();

            var club = Club.Create($"GetGameModel Principle Test Club {Guid.NewGuid():N}", 1);
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
                Name = "GetGameModel Principle Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var model = new GameModel(team.Id, "Modelo con principio", "2025-2026");
            var principle = new GamePrinciple(model.Id, gameMomentId: 1, gameZoneId: 1, order: 1, "Principio 1", "Descripcion 1");
            var scenario = new GameScenario(principle.Id, order: 1, "Escenario 1", "Contexto 1");
            principle.Scenarios.Add(scenario);
            model.Principles.Add(principle);
            db.GameModels.Add(model);
            await db.SaveChangesAsync();

            var handler = new Handler(db);
            var result = await handler.Handle(new GameModelQuery(team.Id, model.Season, userId), CancellationToken.None);

            Assert.NotNull(result);
            var principleResponse = Assert.Single(result!.Principles);
            Assert.Equal("Principio 1", principleResponse.Title);
            Assert.Equal("Descripcion 1", principleResponse.Description);
            Assert.Equal(1, principleResponse.GameMomentId);
            Assert.Equal(1, principleResponse.GameZoneId);

            var scenarioResponse = Assert.Single(principleResponse.Scenarios);
            Assert.Equal("Escenario 1", scenarioResponse.Name);
        }
    }
}
