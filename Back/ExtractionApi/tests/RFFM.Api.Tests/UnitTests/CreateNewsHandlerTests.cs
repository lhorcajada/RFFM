#nullable enable
using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.News;
using RFFM.Api.Features.Coaches.News;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class CreateNewsHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public CreateNewsHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        [Fact]
        public async Task Handle_WithDraftStatus_SetPublishedAtToNull()
        {
            await using var db = _fixture.CreateDbContext();
            var handler = new CreateNewsHandler(db);
            var command = new CreateNewsCommand(
                Title: "Test Draft News",
                Subtitle: "Draft Subtitle",
                Body: "Draft body content",
                CoverImageUrl: "https://example.com/image.jpg",
                Status: "Draft"
            );

            var newsId = await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var news = await verifyDb.News.SingleAsync(n => n.Id == newsId);
            Assert.Equal("Test Draft News", news.Title);
            Assert.Equal("Draft Subtitle", news.Subtitle);
            Assert.Equal("Draft body content", news.Body);
            Assert.Equal("https://example.com/image.jpg", news.CoverImageUrl);
            Assert.Equal(NewsStatus.Draft, news.Status);
            Assert.Null(news.PublishedAt);
        }

        [Fact]
        public async Task Handle_WithPublishedStatus_SetPublishedAtToCurrent()
        {
            await using var db = _fixture.CreateDbContext();
            var handler = new CreateNewsHandler(db);
            var beforeCreation = DateTime.UtcNow;
            var command = new CreateNewsCommand(
                Title: "Test Published News",
                Subtitle: "Published Subtitle",
                Body: "Published body content",
                CoverImageUrl: "https://example.com/image.jpg",
                Status: "Published"
            );

            var newsId = await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var news = await verifyDb.News.SingleAsync(n => n.Id == newsId);
            Assert.Equal(NewsStatus.Published, news.Status);
            Assert.NotNull(news.PublishedAt);
            Assert.True(news.PublishedAt >= beforeCreation);
            Assert.True(news.PublishedAt <= DateTime.UtcNow.AddSeconds(1));
        }

        [Fact]
        public async Task Handle_CreatesNewsItemWithAllFields()
        {
            await using var db = _fixture.CreateDbContext();
            var handler = new CreateNewsHandler(db);
            var command = new CreateNewsCommand(
                Title: "Complete Test News",
                Subtitle: "Complete Subtitle",
                Body: "Complete body content with lots of text",
                CoverImageUrl: "https://example.com/complete.jpg",
                Status: "Draft"
            );

            var newsId = await handler.Handle(command, CancellationToken.None);

            await using var verifyDb = _fixture.CreateDbContext();
            var news = await verifyDb.News.SingleAsync(n => n.Id == newsId);
            Assert.NotNull(news.CreatedAt);
            Assert.NotNull(news.UpdatedAt);
            Assert.Equal(news.CreatedAt, news.UpdatedAt);
        }
    }
}
