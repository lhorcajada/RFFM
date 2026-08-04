#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
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
    /// Integration tests for PUT /api/game-models/{id} (<see cref="UpdateGameModelCommand"/>),
    /// covering create/update/delete of principles and their nested scenarios.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class UpdateGameModelHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public UpdateGameModelHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string UserId, string TeamId, string GameModelId, string PrincipleId, string ScenarioId)> SeedGameModelAsync(AppDbContext db)
        {
            var club = Club.Create($"UpdateGameModel Test Club {Guid.NewGuid():N}", 1);
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
                Name = "UpdateGameModel Test Team",
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
            var principle = new GamePrinciple(model.Id, gameMomentId: 1, gameZoneId: 1, order: 1, "Principio original", "Descripcion original");
            var scenario = new GameScenario(principle.Id, order: 1, "Escenario original", "Contexto original");
            principle.Scenarios.Add(scenario);
            model.Principles.Add(principle);
            db.GameModels.Add(model);
            await db.SaveChangesAsync();

            return (userId, team.Id, model.Id, principle.Id, scenario.Id);
        }

        [Fact]
        public async Task Update_WithNewPrincipleContainingScenario_CreatesPrincipleAndScenario()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, gameModelId, principleId, scenarioId) = await SeedGameModelAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new UpdateGameModelHandler(db);

            var command = new UpdateGameModelCommand(
                "Modelo de prueba",
                new List<PrincipleRequest>
                {
                    new PrincipleRequest(principleId, 1, 1, 1, "Principio original", "Descripcion original",
                        new List<ScenarioRequest> { new ScenarioRequest(scenarioId, 1, "Escenario original", "Contexto original", new List<SubPrincipleRequest>()) }),
                    new PrincipleRequest(null, 2, 2, 1, "Principio nuevo", "Descripcion nueva",
                        new List<ScenarioRequest> { new ScenarioRequest(null, 1, "Escenario nuevo", "Contexto nuevo", new List<SubPrincipleRequest>()) })
                })
            { Id = gameModelId, UserId = userId };

            await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var principles = await verifyDb.GamePrinciples
                .Include(p => p.Scenarios)
                .Where(p => p.GameModelId == gameModelId)
                .ToListAsync();

            Assert.Equal(2, principles.Count);
            var newPrinciple = Assert.Single(principles, p => p.Title == "Principio nuevo");
            Assert.Single(newPrinciple.Scenarios);
            Assert.Equal("Escenario nuevo", newPrinciple.Scenarios.Single().Name);
        }

        [Fact]
        public async Task Update_ExistingPrincipleTitleAndDescription_UpdatesInPlace_ScenariosUnaffected()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, gameModelId, principleId, scenarioId) = await SeedGameModelAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new UpdateGameModelHandler(db);

            var command = new UpdateGameModelCommand(
                "Modelo de prueba",
                new List<PrincipleRequest>
                {
                    new PrincipleRequest(principleId, 1, 1, 1, "Principio editado", "Descripcion editada",
                        new List<ScenarioRequest> { new ScenarioRequest(scenarioId, 1, "Escenario original", "Contexto original", new List<SubPrincipleRequest>()) })
                })
            { Id = gameModelId, UserId = userId };

            await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var principle = await verifyDb.GamePrinciples
                .Include(p => p.Scenarios)
                .SingleAsync(p => p.Id == principleId);

            Assert.Equal("Principio editado", principle.Title);
            Assert.Equal("Descripcion editada", principle.Description);
            var scenario = Assert.Single(principle.Scenarios);
            Assert.Equal(scenarioId, scenario.Id);
            Assert.Equal("Escenario original", scenario.Name);
        }

        [Fact]
        public async Task Update_WithoutPreviouslyExistingPrinciple_DeletesPrincipleAndItsScenarios()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, gameModelId, principleId, scenarioId) = await SeedGameModelAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new UpdateGameModelHandler(db);

            var command = new UpdateGameModelCommand("Modelo de prueba", new List<PrincipleRequest>())
            { Id = gameModelId, UserId = userId };

            await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            Assert.False(await verifyDb.GamePrinciples.AnyAsync(p => p.Id == principleId));
            Assert.False(await verifyDb.GameScenarios.AnyAsync(s => s.Id == scenarioId));
        }

        [Fact]
        public async Task Update_AddingScenarioToExistingPrinciple_PersistsNewScenario()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, gameModelId, principleId, scenarioId) = await SeedGameModelAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new UpdateGameModelHandler(db);

            var command = new UpdateGameModelCommand(
                "Modelo de prueba",
                new List<PrincipleRequest>
                {
                    new PrincipleRequest(principleId, 1, 1, 1, "Principio original", "Descripcion original",
                        new List<ScenarioRequest>
                        {
                            new ScenarioRequest(scenarioId, 1, "Escenario original", "Contexto original", new List<SubPrincipleRequest>()),
                            new ScenarioRequest(null, 2, "Escenario adicional", "Contexto adicional", new List<SubPrincipleRequest>())
                        })
                })
            { Id = gameModelId, UserId = userId };

            await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var scenarios = await verifyDb.GameScenarios
                .Where(s => s.GamePrincipleId == principleId)
                .ToListAsync();

            Assert.Equal(2, scenarios.Count);
            Assert.Contains(scenarios, s => s.Name == "Escenario adicional");
        }

        [Fact]
        public async Task Update_RemovingScenarioFromExistingPrinciple_DeletesScenario()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, gameModelId, principleId, scenarioId) = await SeedGameModelAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new UpdateGameModelHandler(db);

            var command = new UpdateGameModelCommand(
                "Modelo de prueba",
                new List<PrincipleRequest>
                {
                    new PrincipleRequest(principleId, 1, 1, 1, "Principio original", "Descripcion original", new List<ScenarioRequest>())
                })
            { Id = gameModelId, UserId = userId };

            await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            Assert.False(await verifyDb.GameScenarios.AnyAsync(s => s.Id == scenarioId));
            Assert.True(await verifyDb.GamePrinciples.AnyAsync(p => p.Id == principleId));
        }

        [Fact]
        public async Task Update_UnknownGameModelId_ThrowsGameModelNotFound()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, _, _, _, _) = await SeedGameModelAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new UpdateGameModelHandler(db);

            var command = new UpdateGameModelCommand("Modelo de prueba", new List<PrincipleRequest>())
            { Id = Guid.NewGuid().ToString(), UserId = userId };

            var ex = await Assert.ThrowsAsync<DomainException>(() => handler.Handle(command, CancellationToken.None).AsTask());
            Assert.Equal(ErrorCodes.GameModelNotFound, ex.Code);
        }

        [Fact]
        public async Task Update_UserWithoutAccess_ThrowsGameModelAccessDenied()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (_, _, gameModelId, _, _) = await SeedGameModelAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new UpdateGameModelHandler(db);

            var command = new UpdateGameModelCommand("Modelo de prueba", new List<PrincipleRequest>())
            { Id = gameModelId, UserId = $"stranger-{Guid.NewGuid():N}" };

            var ex = await Assert.ThrowsAsync<DomainException>(() => handler.Handle(command, CancellationToken.None).AsTask());
            Assert.Equal(ErrorCodes.GameModelAccessDenied, ex.Code);
        }
    }
}
