#nullable enable
using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.GameModels.Commands;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Storage;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class DeleteScenarioMediaHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public DeleteScenarioMediaHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string UserId, string TeamId, string ScenarioId)> SeedScenarioAsync(AppDbContext db, string? existingMediaUrl = null, string? existingMediaType = null)
        {
            var club = Club.Create($"Delete Scenario Media Test Club {Guid.NewGuid():N}", 1);
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
                Name = "Delete Scenario Media Test Team",
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
            if (existingMediaUrl is not null && existingMediaType is not null)
                scenario.UpdateMedia(existingMediaUrl, existingMediaType);

            model.Scenarios.Add(scenario);
            db.GameModels.Add(model);
            await db.SaveChangesAsync();

            return (userId, team.Id, scenario.Id);
        }

        [Fact]
        public async Task Handle_WithExistingMedia_ClearsFieldsAndDeletesFile()
        {
            await using var db = _fixture.CreateDbContext();
            var (userId, _, scenarioId) = await SeedScenarioAsync(db, "https://storage.test/game-scenarios/old.jpg", "image");

            var storage = new Mock<IStorageService>();
            storage.Setup(s => s.DeleteAsync("game-scenarios", "old.jpg", It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            var handler = new DeleteScenarioMediaHandler(db, storage.Object);
            var command = new DeleteScenarioMediaCommand(scenarioId, userId);

            await handler.Handle(command, CancellationToken.None);

            storage.Verify(s => s.DeleteAsync("game-scenarios", "old.jpg", It.IsAny<CancellationToken>()), Times.Once);

            await using var verifyDb = _fixture.CreateDbContext();
            var persisted = await verifyDb.GameScenarios.SingleAsync(s => s.Id == scenarioId);
            Assert.Null(persisted.MediaUrl);
            Assert.Null(persisted.MediaType);
        }

        [Fact]
        public async Task Handle_WithoutExistingMedia_IsIdempotent()
        {
            await using var db = _fixture.CreateDbContext();
            var (userId, _, scenarioId) = await SeedScenarioAsync(db);

            var storage = new Mock<IStorageService>();
            var handler = new DeleteScenarioMediaHandler(db, storage.Object);
            var command = new DeleteScenarioMediaCommand(scenarioId, userId);

            var ex = await Record.ExceptionAsync(() => handler.Handle(command, CancellationToken.None).AsTask());

            Assert.Null(ex);
            storage.Verify(s => s.DeleteAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Handle_UserWithoutClubAccess_ThrowsDomainException()
        {
            await using var db = _fixture.CreateDbContext();
            var (_, _, scenarioId) = await SeedScenarioAsync(db);

            var storage = new Mock<IStorageService>();
            var handler = new DeleteScenarioMediaHandler(db, storage.Object);
            var command = new DeleteScenarioMediaCommand(scenarioId, "someone-else");

            var ex = await Assert.ThrowsAsync<DomainException>(() => handler.Handle(command, CancellationToken.None).AsTask());
            Assert.Equal(ErrorCodes.GameModelAccessDenied, ex.Code);
        }

        [Fact]
        public async Task Handle_ScenarioNotFound_ThrowsDomainException()
        {
            await using var db = _fixture.CreateDbContext();

            var storage = new Mock<IStorageService>();
            var handler = new DeleteScenarioMediaHandler(db, storage.Object);
            var command = new DeleteScenarioMediaCommand(Guid.NewGuid().ToString(), "any-user");

            var ex = await Assert.ThrowsAsync<DomainException>(() => handler.Handle(command, CancellationToken.None).AsTask());
            Assert.Equal(ErrorCodes.ScenarioNotFound, ex.Code);
        }
    }
}
