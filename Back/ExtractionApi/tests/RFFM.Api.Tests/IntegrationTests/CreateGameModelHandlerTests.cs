#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
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
    /// Integration tests for POST /api/game-models (<see cref="CreateGameModelCommand"/>),
    /// covering the new Principle → Scenario nesting.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class CreateGameModelHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public CreateGameModelHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string UserId, string TeamId)> SeedTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"CreateGameModel Test Club {Guid.NewGuid():N}", 1);
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
                Name = "CreateGameModel Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var userId = $"coach-{Guid.NewGuid():N}";
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            return (userId, team.Id);
        }

        [Fact]
        public async Task Create_WithPrincipleContainingScenarios_PersistsPrincipleAndScenarios()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, teamId) = await SeedTeamAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateGameModelHandler(db);

            var command = new CreateGameModelCommand(
                teamId, "Modelo de prueba", "2025-2026",
                new List<PrincipleRequest>
                {
                    new PrincipleRequest(
                        null, GameMomentId: 1, GameZoneId: 1, Order: 1, "Principio 1", "Descripcion 1",
                        new List<ScenarioRequest>
                        {
                            new ScenarioRequest(null, 1, "Escenario 1", "Contexto 1", new List<SubPrincipleRequest>()),
                            new ScenarioRequest(null, 2, "Escenario 2", "Contexto 2", new List<SubPrincipleRequest>())
                        })
                })
            { UserId = userId };

            var gameModelId = await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var principle = await verifyDb.GamePrinciples
                .Include(p => p.Scenarios)
                .SingleAsync(p => p.GameModelId == gameModelId);

            Assert.Equal("Principio 1", principle.Title);
            Assert.Equal("Descripcion 1", principle.Description);
            Assert.Equal(1, principle.GameMomentId);
            Assert.Equal(1, principle.GameZoneId);
            Assert.Equal(2, principle.Scenarios.Count);
            Assert.Contains(principle.Scenarios, s => s.Name == "Escenario 1");
            Assert.Contains(principle.Scenarios, s => s.Name == "Escenario 2");
        }

        [Fact]
        public async Task Create_WithMultiplePrinciples_PersistsEachIndependently()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var (userId, teamId) = await SeedTeamAsync(seedDb);

            await using var db = _fixture.CreateDbContext();
            var handler = new CreateGameModelHandler(db);

            var command = new CreateGameModelCommand(
                teamId, "Modelo de prueba", "2025-2026",
                new List<PrincipleRequest>
                {
                    new PrincipleRequest(null, 1, 1, 1, "Principio A", "", new List<ScenarioRequest>()),
                    new PrincipleRequest(null, 2, 2, 1, "Principio B", "", new List<ScenarioRequest>())
                })
            { UserId = userId };

            var gameModelId = await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var principles = await verifyDb.GamePrinciples
                .Where(p => p.GameModelId == gameModelId)
                .ToListAsync();

            Assert.Equal(2, principles.Count);
            Assert.Contains(principles, p => p.Title == "Principio A" && p.GameMomentId == 1);
            Assert.Contains(principles, p => p.Title == "Principio B" && p.GameMomentId == 2);
        }
    }
}
