#nullable enable
using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Mobile.Teams.Commands;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Storage;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class UploadTeamRulesDocumentHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public UploadTeamRulesDocumentHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static IFormFile CreateFormFile(string contentType = "application/pdf", string fileName = "rules.pdf", int length = 10)
        {
            var content = Encoding.UTF8.GetBytes(new string('a', length));
            var stream = new MemoryStream(content);
            return new FormFile(stream, 0, stream.Length, "file", fileName)
            {
                Headers = new HeaderDictionary(),
                ContentType = contentType
            };
        }

        private async Task<string> SeedTeamAsync(AppDbContext db, string? existingRulesDocumentUrl = null)
        {
            var club = Club.Create($"Rules Doc Test Club {Guid.NewGuid():N}", 1);
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
                Name = "Rules Doc Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            if (existingRulesDocumentUrl != null)
            {
                team.UpdateRulesDocumentUrl(existingRulesDocumentUrl);
                await db.SaveChangesAsync();
            }

            return team.Id;
        }

        [Fact]
        public async Task Handle_UploadsPdf_SetsRulesDocumentUrl()
        {
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db);

            var storage = new Mock<IStorageService>();
            storage.Setup(s => s.UploadAsync(
                    UploadTeamRulesDocument.ContainerName, It.IsAny<string>(), It.IsAny<IFormFile>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync("team-rules-documents/new.pdf");

            var handler = new UploadTeamRulesDocument.Handler(db, storage.Object);
            var command = new UploadTeamRulesDocument.UploadTeamRulesDocumentCommand
            {
                TeamId = teamId,
                File = CreateFormFile()
            };

            var result = await handler.Handle(command, CancellationToken.None);

            Assert.Equal("team-rules-documents/new.pdf", result.Url);

            await using var verifyDb = _fixture.CreateDbContext();
            var persisted = await verifyDb.Teams.SingleAsync(t => t.Id == teamId);
            Assert.Equal("team-rules-documents/new.pdf", persisted.RulesDocumentUrl);
        }

        [Fact]
        public async Task Handle_ReplacingExistingDocument_DeletesOldFile()
        {
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db, "team-rules-documents/old.pdf");

            var storage = new Mock<IStorageService>();
            storage.Setup(s => s.UploadAsync(
                    UploadTeamRulesDocument.ContainerName, It.IsAny<string>(), It.IsAny<IFormFile>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync("team-rules-documents/new.pdf");
            storage.Setup(s => s.DeleteAsync(UploadTeamRulesDocument.ContainerName, "old.pdf", It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            var handler = new UploadTeamRulesDocument.Handler(db, storage.Object);
            var command = new UploadTeamRulesDocument.UploadTeamRulesDocumentCommand
            {
                TeamId = teamId,
                File = CreateFormFile()
            };

            await handler.Handle(command, CancellationToken.None);

            storage.Verify(s => s.DeleteAsync(UploadTeamRulesDocument.ContainerName, "old.pdf", It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Handle_NoExistingDocument_DoesNotCallDelete()
        {
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db);

            var storage = new Mock<IStorageService>();
            storage.Setup(s => s.UploadAsync(
                    UploadTeamRulesDocument.ContainerName, It.IsAny<string>(), It.IsAny<IFormFile>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync("team-rules-documents/new.pdf");

            var handler = new UploadTeamRulesDocument.Handler(db, storage.Object);
            var command = new UploadTeamRulesDocument.UploadTeamRulesDocumentCommand
            {
                TeamId = teamId,
                File = CreateFormFile()
            };

            await handler.Handle(command, CancellationToken.None);

            storage.Verify(s => s.DeleteAsync(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
                Times.Never);
        }

        [Fact]
        public async Task Handle_TeamDoesNotExist_ThrowsNotFoundException()
        {
            await using var db = _fixture.CreateDbContext();

            var storage = new Mock<IStorageService>();
            var handler = new UploadTeamRulesDocument.Handler(db, storage.Object);
            var command = new UploadTeamRulesDocument.UploadTeamRulesDocumentCommand
            {
                TeamId = "non-existent-team-id",
                File = CreateFormFile()
            };

            await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(command, CancellationToken.None).AsTask());
        }
    }
}
