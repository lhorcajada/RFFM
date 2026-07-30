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
    public class UpdateNewsHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public UpdateNewsHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<NewsItem> CreateTestNewsAsync(AppDbContext db, NewsStatus status)
        {
            var news = NewsItem.Create("Original Title", "Original Subtitle", "Original Body", "https://example.com/original.jpg", status);
            db.News.Add(news);
            await db.SaveChangesAsync();
            return news;
        }

        [Fact]
        public async Task Handle_UpdatesDraftItemFields()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var news = await CreateTestNewsAsync(seedDb, NewsStatus.Draft);

            await using var db = _fixture.CreateDbContext();
            var handler = new UpdateNewsHandler(db);
            var command = new UpdateNewsCommand(
                Title: "Updated Title",
                Subtitle: "Updated Subtitle",
                Body: "Updated Body",
                CoverImageUrl: "https://example.com/updated.jpg"
            )
            { Id = news.Id };

            await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var updated = await verifyDb.News.SingleAsync(n => n.Id == news.Id);
            Assert.Equal("Updated Title", updated.Title);
            Assert.Equal("Updated Subtitle", updated.Subtitle);
            Assert.Equal("Updated Body", updated.Body);
            Assert.Equal("https://example.com/updated.jpg", updated.CoverImageUrl);
            Assert.Equal(NewsStatus.Draft, updated.Status);
        }

        [Fact]
        public async Task Handle_UpdatesPublishedItemFieldsWithoutChangingStatus()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var news = await CreateTestNewsAsync(seedDb, NewsStatus.Published);

            // Re-read from a fresh context so the comparison value has gone through the same
            // Postgres timestamp precision truncation as `updated.PublishedAt` below — comparing
            // against the in-memory `news.PublishedAt` (full .NET tick precision) against a
            // round-tripped value causes spurious sub-microsecond mismatches.
            await using var readBackDb = _fixture.CreateDbContext();
            var originalPublishedAt = (await readBackDb.News.SingleAsync(n => n.Id == news.Id)).PublishedAt;

            await using var db = _fixture.CreateDbContext();
            var handler = new UpdateNewsHandler(db);
            var command = new UpdateNewsCommand(
                Title: "Updated Title",
                Subtitle: "Updated Subtitle",
                Body: "Updated Body",
                CoverImageUrl: "https://example.com/updated.jpg"
            )
            { Id = news.Id };

            await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var updated = await verifyDb.News.SingleAsync(n => n.Id == news.Id);
            Assert.Equal("Updated Title", updated.Title);
            Assert.Equal(NewsStatus.Published, updated.Status);
            Assert.Equal(originalPublishedAt, updated.PublishedAt);
        }

        [Fact]
        public async Task Handle_WithNonExistentId_ThrowsNotFoundException()
        {
            await using var db = _fixture.CreateDbContext();
            var handler = new UpdateNewsHandler(db);
            var command = new UpdateNewsCommand(
                Title: "Title",
                Subtitle: "Subtitle",
                Body: "Body",
                CoverImageUrl: "https://example.com/image.jpg"
            )
            { Id = "nonexistent-id" };

            var exception = await Assert.ThrowsAsync<NotFoundException>(
                async () => await handler.Handle(command, CancellationToken.None)
            );
            Assert.Equal(ErrorCodes.NewsNotFound, exception.Code);
        }
    }
}
