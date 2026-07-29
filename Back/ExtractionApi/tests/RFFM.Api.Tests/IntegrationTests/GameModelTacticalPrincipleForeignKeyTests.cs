#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.GameModels.Commands;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Regression tests for PUT /api/game-models/{id} saving "principios tacticos colectivos".
    ///
    /// The join tables app."ScenarioTacticalPrinciples" and app."SubPrincipleTacticalPrinciples"
    /// store a TacticalGoalsEnum id (the 21-row app."TacticalGoals" catalog, ids 1-21, surfaced to
    /// the frontend by GET /api/technical-goals) in a column misleadingly named
    /// "TechnicalGoalId". The migration that created these join tables
    /// (20260401163621_AddSubPrinciplesTables) mistakenly pointed the foreign key at
    /// app."TechnicalGoals" (the unrelated 8-row individual-training-goal catalog) instead of
    /// app."TacticalGoals". Any tactical principle id outside 1-8 (i.e. most of the 21 real
    /// options, e.g. 11 = Pressing) then violates the FK on save.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class GameModelTacticalPrincipleForeignKeyTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GameModelTacticalPrincipleForeignKeyTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string UserId, string TeamId, string GameModelId, string ScenarioId, string SubPrincipleId)> SeedGameModelAsync(AppDbContext db)
        {
            var club = Club.Create($"TacticalGoals FK Test Club {Guid.NewGuid():N}", 1);
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
                Name = "TacticalGoals FK Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var model = new GameModel(team.Id, "Modelo de prueba FK", "2025-2026");
            var scenario = new GameScenario(model.Id, gameMomentId: 1, gameZoneId: 1, order: 0, "Escenario 1", "Contexto");
            var subPrinciple = new SubPrinciple(scenario.Id, "A", "Subprincipio 1", "Contexto", order: 0);
            scenario.SubPrinciples.Add(subPrinciple);

            model.Scenarios.Add(scenario);
            db.GameModels.Add(model);
            await db.SaveChangesAsync();

            return (userId, team.Id, model.Id, scenario.Id, subPrinciple.Id);
        }

        [Fact]
        public async Task SavingScenarioWithTacticalPrincipleIdAbove8_DoesNotThrow()
        {
            // Arrange
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, gameModelId, scenarioId, subPrincipleId) = await SeedGameModelAsync(seedDb);

            await using var updateDb = _fixture.CreateDbContext();
            var handler = new UpdateGameModelHandler(updateDb);

            // 11 = "Pressing" in TacticalGoalsEnum (the real 21-row catalog served by
            // GET /api/technical-goals) -- outside the 1-8 range of the unrelated
            // TechnicalGoalsEnum catalog the buggy FK currently points at.
            const int tacticalPrincipleId = 11;

            var command = new UpdateGameModelCommand(
                "Modelo de prueba FK",
                new List<ScenarioRequest>
                {
                    new ScenarioRequest(
                        scenarioId,
                        1,
                        1,
                        0,
                        "Escenario 1",
                        "Contexto",
                        new List<int> { tacticalPrincipleId },
                        new List<SubPrincipleRequest>
                        {
                            new SubPrincipleRequest(
                                subPrincipleId,
                                "A",
                                0,
                                "Subprincipio 1",
                                "Contexto",
                                new List<SubSubPrincipleRequest>())
                        })
                })
            {
                Id = gameModelId,
                UserId = userId
            };

            // Act / Assert - must not throw a Postgres FK violation.
            var ex = await Record.ExceptionAsync(() => handler.Handle(command, CancellationToken.None).AsTask());
            Assert.Null(ex);

            await using var verifyDb = _fixture.CreateDbContext();
            var persistedScenario = await verifyDb.GameModels
                .Where(gm => gm.Id == gameModelId)
                .SelectMany(gm => gm.Scenarios)
                .Include(s => s.TacticalPrinciples)
                .Include(s => s.SubPrinciples)
                .SingleAsync();

            Assert.Single(persistedScenario.TacticalPrinciples);
            Assert.Equal(tacticalPrincipleId, persistedScenario.TacticalPrinciples.Single().TechnicalGoalId);
        }
    }
}
