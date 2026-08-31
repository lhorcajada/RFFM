#nullable enable
using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.News;
using RFFM.Api.Features.Coaches.News;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class UnpublishNewsHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public UnpublishNewsHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<NewsItem> CreateTestNewsAsync(AppDbContext db, NewsStatus status)
        {
            var news = NewsItem.Create("Test Title", "Test Subtitle", "Test Body", "https://example.com/image.jpg", status, new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc));
            db.News.Add(news);
            await db.SaveChangesAsync();
            return news;
        }

        [Fact]
        public async Task Handle_TransitionsPublishedToDraft()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var news = await CreateTestNewsAsync(seedDb, NewsStatus.Published);

            await using var db = _fixture.CreateDbContext();
            var handler = new UnpublishNewsHandler(db);
            var command = new UnpublishNewsCommand(news.Id);

            var result = await handler.Handle(command, CancellationToken.None);

            Assert.Equal(NewsStatus.Draft.Name, result.Status);
            Assert.Null(result.PublishedAt);

            await using var verifyDb = _fixture.CreateDbContext();
            var updated = await verifyDb.News.SingleAsync(n => n.Id == news.Id);
            Assert.Equal(NewsStatus.Draft, updated.Status);
            Assert.Null(updated.PublishedAt);
        }

        [Fact]
        public async Task Handle_WithAlreadyDraftItem_ThrowsConflictException()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var news = await CreateTestNewsAsync(seedDb, NewsStatus.Draft);

            await using var db = _fixture.CreateDbContext();
            var handler = new UnpublishNewsHandler(db);
            var command = new UnpublishNewsCommand(news.Id);

            var exception = await Assert.ThrowsAsync<ConflictException>(
                async () => await handler.Handle(command, CancellationToken.None)
            );
            Assert.Equal(ErrorCodes.NewsNotPublished, exception.Code);
        }

        [Fact]
        public async Task Handle_WithNonExistentId_ThrowsNotFoundException()
        {
            await using var db = _fixture.CreateDbContext();
            var handler = new UnpublishNewsHandler(db);
            var command = new UnpublishNewsCommand("nonexistent-id");

            var exception = await Assert.ThrowsAsync<NotFoundException>(
                async () => await handler.Handle(command, CancellationToken.None)
            );
            Assert.Equal(ErrorCodes.NewsNotFound, exception.Code);
        }

        [Fact]
        public async Task Handle_UnpublishedItemDisappearsFromGetNews()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var news = await CreateTestNewsAsync(seedDb, NewsStatus.Published);

            await using var db = _fixture.CreateDbContext();
            var unpublishHandler = new UnpublishNewsHandler(db);
            var unpublishCommand = new UnpublishNewsCommand(news.Id);
            await unpublishHandler.Handle(unpublishCommand, CancellationToken.None);

            await using var getNewsDb = _fixture.CreateDbContext();
            var getNewsHandler = new GetNewsHandler(getNewsDb, null!);
            var getNewsQuery = new GetNewsQuery(1, 20);

            var result = await getNewsHandler.Handle(getNewsQuery, CancellationToken.None);

            Assert.DoesNotContain(result, r => r.Id == news.Id);
        }
    }
}
