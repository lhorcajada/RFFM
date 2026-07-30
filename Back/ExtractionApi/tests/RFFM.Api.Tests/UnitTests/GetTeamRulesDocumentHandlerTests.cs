#nullable enable
using System;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Mobile.Teams.Queries;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Storage;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetTeamRulesDocumentHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetTeamRulesDocumentHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<string> SeedTeamAsync(AppDbContext db, string? rulesDocumentUrl)
        {
            var club = Club.Create($"Get Rules Doc Test Club {Guid.NewGuid():N}", 1);
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
                Name = "Get Rules Doc Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            if (rulesDocumentUrl != null)
            {
                team.UpdateRulesDocumentUrl(rulesDocumentUrl);
                await db.SaveChangesAsync();
            }

            return team.Id;
        }

        [Fact]
        public async Task Handle_DocumentExists_ReturnsContent()
        {
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db, "team-rules-documents/rules.pdf");

            var bytes = Encoding.UTF8.GetBytes("%PDF-1.4 fake content");
            var storage = new Mock<IStorageService>();
            storage.Setup(s => s.DownloadAsync("team-rules-documents/rules.pdf", It.IsAny<CancellationToken>()))
                .ReturnsAsync((bytes, "application/pdf"));

            var handler = new GetTeamRulesDocument.Handler(db, storage.Object);
            var query = new GetTeamRulesDocument.GetTeamRulesDocumentQuery { TeamId = teamId };

            var result = await handler.Handle(query, CancellationToken.None);

            Assert.NotNull(result);
            Assert.Equal(bytes, result!.Content);
        }

        [Fact]
        public async Task Handle_NoDocumentUploaded_ReturnsNull()
        {
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db, null);

            var storage = new Mock<IStorageService>();
            var handler = new GetTeamRulesDocument.Handler(db, storage.Object);
            var query = new GetTeamRulesDocument.GetTeamRulesDocumentQuery { TeamId = teamId };

            var result = await handler.Handle(query, CancellationToken.None);

            Assert.Null(result);
            storage.Verify(s => s.DownloadAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Handle_TeamDoesNotExist_ThrowsNotFoundException()
        {
            await using var db = _fixture.CreateDbContext();

            var storage = new Mock<IStorageService>();
            var handler = new GetTeamRulesDocument.Handler(db, storage.Object);
            var query = new GetTeamRulesDocument.GetTeamRulesDocumentQuery { TeamId = "non-existent-team-id" };

            await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(query, CancellationToken.None).AsTask());
        }
    }
}
