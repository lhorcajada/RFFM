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
    public class GetNewsHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetNewsHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task CreateTestNewsAsync(AppDbContext db, int count, NewsStatus status)
        {
            for (int i = 0; i < count; i++)
            {
                var news = NewsItem.Create(
                    $"Title {i}",
                    $"Subtitle {i}",
                    $"Body {i}",
                    "https://example.com/image.jpg",
                    status,
                    new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc)
                );
                db.News.Add(news);
            }
            await db.SaveChangesAsync();
        }

        // News has no per-club/team scoping (design.md Non-Goals — it is global to the tenant),
        // and all tests in this collection share one Postgres container for the whole run, so
        // exact-count/order assertions require a clean table first.
        private async Task ClearNewsTableAsync()
        {
            await using var db = _fixture.CreateDbContext();
            db.News.RemoveRange(db.News);
            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task Handle_OnlyReturnsPublishedItems()
        {
            await ClearNewsTableAsync();
            await using var seedDb = _fixture.CreateDbContext();
            await CreateTestNewsAsync(seedDb, 2, NewsStatus.Draft);
            await CreateTestNewsAsync(seedDb, 3, NewsStatus.Published);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetNewsHandler(db, null!);
            var query = new GetNewsQuery(1, 20);

            var result = await handler.Handle(query, CancellationToken.None);

            Assert.Equal(3, result.Length);
            foreach (var item in result)
            {
                Assert.Equal("Published", item.Status);
            }
        }

        [Fact]
        public async Task Handle_NeverIncludesDraftItems()
        {
            await ClearNewsTableAsync();
            await using var seedDb = _fixture.CreateDbContext();
            await CreateTestNewsAsync(seedDb, 5, NewsStatus.Draft);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetNewsHandler(db, null!);
            var query = new GetNewsQuery(1, 20);

            var result = await handler.Handle(query, CancellationToken.None);

            Assert.Empty(result);
        }

        [Fact]
        public async Task Handle_SortsByNewsDateAscending()
        {
            await ClearNewsTableAsync();
            await using var seedDb = _fixture.CreateDbContext();

            // news1 is published after news2 but has an earlier NewsDate, so it must come first
            // in the response — the feed orders by relevance date, not by publish order.
            var news1 = NewsItem.Create("News 1", "Sub 1", "Body 1", "https://example.com/1.jpg", NewsStatus.Published, new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc));
            seedDb.News.Add(news1);
            await seedDb.SaveChangesAsync();

            await Task.Delay(100); // Ensure time difference in PublishedAt

            var news2 = NewsItem.Create("News 2", "Sub 2", "Body 2", "https://example.com/2.jpg", NewsStatus.Published, new DateTime(2026, 8, 1, 0, 0, 0, DateTimeKind.Utc));
            seedDb.News.Add(news2);
            await seedDb.SaveChangesAsync();

            await using var db = _fixture.CreateDbContext();
            var handler = new GetNewsHandler(db, null!);
            var query = new GetNewsQuery(1, 20);

            var result = await handler.Handle(query, CancellationToken.None);

            Assert.Equal(2, result.Length);
            // Earliest NewsDate first, regardless of publish order.
            Assert.Equal("News 2", result[0].Title);
            Assert.Equal("News 1", result[1].Title);
        }

        [Fact]
        public async Task Handle_PaginationWorks()
        {
            await ClearNewsTableAsync();
            await using var seedDb = _fixture.CreateDbContext();
            await CreateTestNewsAsync(seedDb, 5, NewsStatus.Published);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetNewsHandler(db, null!);

            var query1 = new GetNewsQuery(1, 2);
            var result1 = await handler.Handle(query1, CancellationToken.None);
            Assert.Equal(2, result1.Length);

            var query2 = new GetNewsQuery(2, 2);
            var result2 = await handler.Handle(query2, CancellationToken.None);
            Assert.Equal(2, result2.Length);

            var query3 = new GetNewsQuery(3, 2);
            var result3 = await handler.Handle(query3, CancellationToken.None);
            Assert.Single(result3);
        }
    }
}
