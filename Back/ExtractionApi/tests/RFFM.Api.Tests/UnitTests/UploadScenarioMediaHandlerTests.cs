#nullable enable
using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
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
    public class UploadScenarioMediaHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public UploadScenarioMediaHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static IFormFile CreateFormFile(string contentType, string fileName = "file.bin", int length = 10)
        {
            var content = Encoding.UTF8.GetBytes(new string('a', length));
            var stream = new MemoryStream(content);
            return new FormFile(stream, 0, stream.Length, "file", fileName)
            {
                Headers = new HeaderDictionary(),
                ContentType = contentType
            };
        }

        private async Task<(string UserId, string TeamId, string ScenarioId)> SeedScenarioAsync(AppDbContext db, string? existingMediaUrl = null, string? existingMediaType = null)
        {
            var club = Club.Create($"Scenario Media Test Club {Guid.NewGuid():N}", 1);
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
                Name = "Scenario Media Test Team",
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
            var principle = new GamePrinciple(model.Id, gameMomentId: 1, gameZoneId: 1, order: 1, "Principio 1", "");
            var scenario = new GameScenario(principle.Id, order: 0, "Escenario 1", "Contexto");
            if (existingMediaUrl is not null && existingMediaType is not null)
                scenario.UpdateMedia(existingMediaUrl, existingMediaType);

            principle.Scenarios.Add(scenario);
            model.Principles.Add(principle);
            db.GameModels.Add(model);
            await db.SaveChangesAsync();

            return (userId, team.Id, scenario.Id);
        }

        [Fact]
        public async Task Handle_UploadsImage_SetsMediaUrlAndTypeImage()
        {
            await using var db = _fixture.CreateDbContext();
            var (userId, _, scenarioId) = await SeedScenarioAsync(db);

            var storage = new Mock<IStorageService>();
            storage.Setup(s => s.UploadAsync("game-scenarios", It.IsAny<string>(), It.IsAny<IFormFile>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync("https://storage.test/game-scenarios/foo.jpg");

            var handler = new UploadScenarioMediaHandler(db, storage.Object);
            var command = new UploadScenarioMediaCommand(scenarioId, CreateFormFile("image/jpeg", "photo.jpg"), userId);

            var result = await handler.Handle(command, CancellationToken.None);

            Assert.Equal("image", result.MediaType);
            Assert.Equal("https://storage.test/game-scenarios/foo.jpg", result.Url);

            await using var verifyDb = _fixture.CreateDbContext();
            var persisted = await verifyDb.GameScenarios.SingleAsync(s => s.Id == scenarioId);
            Assert.Equal("https://storage.test/game-scenarios/foo.jpg", persisted.MediaUrl);
            Assert.Equal("image", persisted.MediaType);
        }

        [Fact]
        public async Task Handle_UploadsVideo_SetsMediaTypeVideo()
        {
            await using var db = _fixture.CreateDbContext();
            var (userId, _, scenarioId) = await SeedScenarioAsync(db);

            var storage = new Mock<IStorageService>();
            storage.Setup(s => s.UploadAsync("game-scenarios", It.IsAny<string>(), It.IsAny<IFormFile>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync("https://storage.test/game-scenarios/foo.mp4");

            var handler = new UploadScenarioMediaHandler(db, storage.Object);
            var command = new UploadScenarioMediaCommand(scenarioId, CreateFormFile("video/mp4", "clip.mp4"), userId);

            var result = await handler.Handle(command, CancellationToken.None);

            Assert.Equal("video", result.MediaType);
        }

        [Fact]
        public async Task Handle_ReplacingExistingMedia_DeletesOldFile()
        {
            await using var db = _fixture.CreateDbContext();
            var (userId, _, scenarioId) = await SeedScenarioAsync(db, "https://storage.test/game-scenarios/old.jpg", "image");

            var storage = new Mock<IStorageService>();
            storage.Setup(s => s.UploadAsync("game-scenarios", It.IsAny<string>(), It.IsAny<IFormFile>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync("https://storage.test/game-scenarios/new.jpg");
            storage.Setup(s => s.DeleteAsync("game-scenarios", "old.jpg", It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            var handler = new UploadScenarioMediaHandler(db, storage.Object);
            var command = new UploadScenarioMediaCommand(scenarioId, CreateFormFile("image/jpeg", "new.jpg"), userId);

            await handler.Handle(command, CancellationToken.None);

            storage.Verify(s => s.DeleteAsync("game-scenarios", "old.jpg", It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Handle_UserWithoutClubAccess_ThrowsDomainException()
        {
            await using var db = _fixture.CreateDbContext();
            var (_, _, scenarioId) = await SeedScenarioAsync(db);

            var storage = new Mock<IStorageService>();
            var handler = new UploadScenarioMediaHandler(db, storage.Object);
            var command = new UploadScenarioMediaCommand(scenarioId, CreateFormFile("image/jpeg"), "someone-else");

            var ex = await Assert.ThrowsAsync<DomainException>(() => handler.Handle(command, CancellationToken.None).AsTask());
            Assert.Equal(ErrorCodes.GameModelAccessDenied, ex.Code);
        }

        [Fact]
        public async Task Handle_ScenarioNotFound_ThrowsDomainException()
        {
            await using var db = _fixture.CreateDbContext();

            var storage = new Mock<IStorageService>();
            var handler = new UploadScenarioMediaHandler(db, storage.Object);
            var command = new UploadScenarioMediaCommand(Guid.NewGuid().ToString(), CreateFormFile("image/jpeg"), "any-user");

            var ex = await Assert.ThrowsAsync<DomainException>(() => handler.Handle(command, CancellationToken.None).AsTask());
            Assert.Equal(ErrorCodes.ScenarioNotFound, ex.Code);
        }
    }
}
