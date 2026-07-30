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
    public class DeleteNewsHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public DeleteNewsHandlerTests(PostgresContainerFixture fixture)
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
        public async Task Handle_DeletesDraftItem()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var news = await CreateTestNewsAsync(seedDb, NewsStatus.Draft);

            await using var db = _fixture.CreateDbContext();
            var handler = new DeleteNewsHandler(db);
            var command = new DeleteNewsCommand(news.Id);

            await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var deleted = await verifyDb.News.FirstOrDefaultAsync(n => n.Id == news.Id);
            Assert.Null(deleted);
        }

        [Fact]
        public async Task Handle_DeletesPublishedItem()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var news = await CreateTestNewsAsync(seedDb, NewsStatus.Published);

            await using var db = _fixture.CreateDbContext();
            var handler = new DeleteNewsHandler(db);
            var command = new DeleteNewsCommand(news.Id);

            await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var deleted = await verifyDb.News.FirstOrDefaultAsync(n => n.Id == news.Id);
            Assert.Null(deleted);
        }

        [Fact]
        public async Task Handle_WithNonExistentId_ThrowsNotFoundException()
        {
            await using var db = _fixture.CreateDbContext();
            var handler = new DeleteNewsHandler(db);
            var command = new DeleteNewsCommand("nonexistent-id");

            var exception = await Assert.ThrowsAsync<NotFoundException>(
                async () => await handler.Handle(command, CancellationToken.None)
            );
            Assert.Equal(ErrorCodes.NewsNotFound, exception.Code);
        }
    }
}
