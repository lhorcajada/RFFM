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
    public class PublishNewsHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public PublishNewsHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<NewsItem> CreateTestNewsAsync(AppDbContext db, NewsStatus status)
        {
            var news = NewsItem.Create("Test Title", "Test Subtitle", "Test Body", "https://example.com/image.jpg", status);
            db.News.Add(news);
            await db.SaveChangesAsync();
            return news;
        }

        [Fact]
        public async Task Handle_TransitionsDraftToPublished()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var news = await CreateTestNewsAsync(seedDb, NewsStatus.Draft);

            await using var db = _fixture.CreateDbContext();
            var handler = new PublishNewsHandler(db);
            var command = new PublishNewsCommand(news.Id);

            var result = await handler.Handle(command, CancellationToken.None);

            Assert.Equal(NewsStatus.Published.Name, result.Status);
            Assert.NotNull(result.PublishedAt);

            await using var verifyDb = _fixture.CreateDbContext();
            var updated = await verifyDb.News.SingleAsync(n => n.Id == news.Id);
            Assert.Equal(NewsStatus.Published, updated.Status);
            Assert.NotNull(updated.PublishedAt);
        }

        [Fact]
        public async Task Handle_WithAlreadyPublishedItem_ThrowsConflictException()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var news = await CreateTestNewsAsync(seedDb, NewsStatus.Published);

            await using var db = _fixture.CreateDbContext();
            var handler = new PublishNewsHandler(db);
            var command = new PublishNewsCommand(news.Id);

            var exception = await Assert.ThrowsAsync<ConflictException>(
                async () => await handler.Handle(command, CancellationToken.None)
            );
            Assert.Equal(ErrorCodes.NewsAlreadyPublished, exception.Code);
        }

        [Fact]
        public async Task Handle_WithNonExistentId_ThrowsNotFoundException()
        {
            await using var db = _fixture.CreateDbContext();
            var handler = new PublishNewsHandler(db);
            var command = new PublishNewsCommand("nonexistent-id");

            var exception = await Assert.ThrowsAsync<NotFoundException>(
                async () => await handler.Handle(command, CancellationToken.None)
            );
            Assert.Equal(ErrorCodes.NewsNotFound, exception.Code);
        }
    }
}
