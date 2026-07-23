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
    /// Regression tests for PUT /api/game-models/{id} around re-saving tactical principles on an
    /// existing scenario / sub-principle.
    ///
    /// UpdateGameModelHandler.Handle used to replace tactical principles with
    /// `RemoveRange(existing.TacticalPrinciples); existing.TacticalPrinciples.Clear();` followed by
    /// `Add(new ScenarioTacticalPrinciple(...))` for every requested id (same pattern for
    /// SubPrincipleTacticalPrinciples in UpsertSubPrinciples). ScenarioTacticalPrinciple and
    /// SubPrincipleTacticalPrinciple have composite keys (GameScenarioId, TechnicalGoalId) /
    /// (SubPrincipleId, TechnicalGoalId).
    ///
    /// EF Core 9's SaveChanges can merge a Deleted + re-Added entity that share the same key into
    /// a single change, so simply resending the exact same (non-duplicated) id list does NOT
    /// reproduce a crash -- confirmed via
    /// <see cref="ResavingScenarioWithSameTacticalPrincipleIds_DoesNotThrow"/>. However, a
    /// duplicate id *within* the same resent list DOES throw
    /// `InvalidOperationException: The instance of entity type 'ScenarioTacticalPrinciple' cannot
    /// be tracked because another instance with the same key value ... is already being tracked`
    /// at SaveChangesAsync, because two brand-new instances with the identical composite key get
    /// added in the same change-tracking pass -- see
    /// <see cref="ResavingScenarioWithDuplicateTacticalPrincipleIdInSameList_ThrowsInvalidOperationException"/>.
    ///
    /// Fix: diff the existing collection against the requested (deduplicated) ids instead of
    /// clearing + re-adding everything -- keep ids still present, remove ids no longer present,
    /// add only genuinely new ids.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class UpdateGameModelResavePrinciplesTests
    {
        private readonly PostgresContainerFixture _fixture;

        public UpdateGameModelResavePrinciplesTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string UserId, string TeamId, string GameModelId)> SeedGameModelWithPrinciplesAsync(AppDbContext db)
        {
            var club = Club.Create($"GameModel Resave Test Club {Guid.NewGuid():N}", 1);
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
                Name = "GameModel Resave Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var model = new GameModel(team.Id, "Modelo de prueba", "2025-2026");
            var scenario = new GameScenario(model.Id, gameMomentId: 1, gameZoneId: 1, order: 0, "Escenario 1", "Contexto");
            scenario.TacticalPrinciples.Add(new ScenarioTacticalPrinciple(scenario.Id, technicalGoalId: 1));

            var subPrinciple = new SubPrinciple(scenario.Id, "A", "Subprincipio 1", "Contexto", order: 0);
            subPrinciple.TacticalPrinciples.Add(new SubPrincipleTacticalPrinciple(subPrinciple.Id, technicalGoalId: 1));
            scenario.SubPrinciples.Add(subPrinciple);

            model.Scenarios.Add(scenario);
            db.GameModels.Add(model);
            await db.SaveChangesAsync();

            return (userId, team.Id, model.Id);
        }

        [Fact]
        public async Task ResavingScenarioWithSameTacticalPrincipleIds_DoesNotThrow()
        {
            // Arrange
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, gameModelId) = await SeedGameModelWithPrinciplesAsync(seedDb);

            await using var updateDb = _fixture.CreateDbContext();
            var handler = new UpdateGameModelHandler(updateDb);

            var scenario = await updateDb.GameModels
                .Where(gm => gm.Id == gameModelId)
                .SelectMany(gm => gm.Scenarios)
                .Include(s => s.SubPrinciples)
                .SingleAsync();

            var subPrinciple = scenario.SubPrinciples.Single();

            var command = new UpdateGameModelCommand(
                "Modelo de prueba",
                new List<ScenarioRequest>
                {
                    new ScenarioRequest(
                        scenario.Id,
                        scenario.GameMomentId,
                        scenario.GameZoneId,
                        scenario.Order,
                        scenario.Name,
                        scenario.Context,
                        new List<int> { 1 }, // same TacticalPrincipleId resent
                        new List<SubPrincipleRequest>
                        {
                            new SubPrincipleRequest(
                                subPrinciple.Id,
                                subPrinciple.Label,
                                subPrinciple.Order,
                                subPrinciple.Name,
                                subPrinciple.Context,
                                new List<int> { 1 }, // same TacticalPrincipleId resent
                                new List<SubSubPrincipleRequest>())
                        })
                })
            {
                Id = gameModelId,
                UserId = userId
            };

            // Act
            await handler.Handle(command, CancellationToken.None);

            // Assert - no exception thrown, and the tactical principle assignment survives.
            await using var verifyDb = _fixture.CreateDbContext();
            var persistedScenario = await verifyDb.GameModels
                .Where(gm => gm.Id == gameModelId)
                .SelectMany(gm => gm.Scenarios)
                .Include(s => s.TacticalPrinciples)
                .Include(s => s.SubPrinciples)
                    .ThenInclude(sp => sp.TacticalPrinciples)
                .SingleAsync();

            Assert.Single(persistedScenario.TacticalPrinciples);
            Assert.Equal(1, persistedScenario.TacticalPrinciples.Single().TechnicalGoalId);
            Assert.Single(persistedScenario.SubPrinciples.Single().TacticalPrinciples);
            Assert.Equal(1, persistedScenario.SubPrinciples.Single().TacticalPrinciples.Single().TechnicalGoalId);
        }

        [Fact]
        public async Task ResavingScenarioWithDuplicateTacticalPrincipleIdInSameList_ThrowsInvalidOperationException()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, gameModelId) = await SeedGameModelWithPrinciplesAsync(seedDb);

            await using var updateDb = _fixture.CreateDbContext();
            var handler = new UpdateGameModelHandler(updateDb);

            var scenario = await updateDb.GameModels
                .Where(gm => gm.Id == gameModelId)
                .SelectMany(gm => gm.Scenarios)
                .Include(s => s.SubPrinciples)
                .SingleAsync();

            var command = new UpdateGameModelCommand(
                "Modelo de prueba",
                new List<ScenarioRequest>
                {
                    new ScenarioRequest(
                        scenario.Id,
                        scenario.GameMomentId,
                        scenario.GameZoneId,
                        scenario.Order,
                        scenario.Name,
                        scenario.Context,
                        new List<int> { 1, 1 }, // duplicate id within the same resent list
                        new List<SubPrincipleRequest>())
                })
            {
                Id = gameModelId,
                UserId = userId
            };

            // Act / Assert - must not throw even if the incoming list has a duplicate id.
            var ex = await Record.ExceptionAsync(() => handler.Handle(command, CancellationToken.None).AsTask());
            Assert.Null(ex);

            await using var verifyDb = _fixture.CreateDbContext();
            var persistedScenario = await verifyDb.GameModels
                .Where(gm => gm.Id == gameModelId)
                .SelectMany(gm => gm.Scenarios)
                .Include(s => s.TacticalPrinciples)
                .SingleAsync();

            Assert.Single(persistedScenario.TacticalPrinciples);
            Assert.Equal(1, persistedScenario.TacticalPrinciples.Single().TechnicalGoalId);
        }
    }
}
