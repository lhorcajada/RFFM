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
    public class GetNewsDraftsHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetNewsDraftsHandlerTests(PostgresContainerFixture fixture)
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
                    status
                );
                db.News.Add(news);
            }
            await db.SaveChangesAsync();
        }

        // News has no per-club/team scoping (design.md Non-Goals) and all tests in this
        // collection share one Postgres container for the whole run, so exact-count/order
        // assertions require a clean table first.
        private async Task ClearNewsTableAsync()
        {
            await using var db = _fixture.CreateDbContext();
            db.News.RemoveRange(db.News);
            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task Handle_OnlyReturnsDraftItems()
        {
            await ClearNewsTableAsync();
            await using var seedDb = _fixture.CreateDbContext();
            await CreateTestNewsAsync(seedDb, 2, NewsStatus.Published);
            await CreateTestNewsAsync(seedDb, 3, NewsStatus.Draft);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetNewsDraftsHandler(db, null!);
            var query = new GetNewsDraftsQuery(1, 20);

            var result = await handler.Handle(query, CancellationToken.None);

            Assert.Equal(3, result.Length);
            foreach (var item in result)
            {
                Assert.Equal("Draft", item.Status);
            }
        }

        [Fact]
        public async Task Handle_SortsByCreatedAtDescending()
        {
            await ClearNewsTableAsync();
            await using var seedDb = _fixture.CreateDbContext();

            var draft1 = NewsItem.Create("Draft 1", "Sub 1", "Body 1", "https://example.com/1.jpg", NewsStatus.Draft);
            seedDb.News.Add(draft1);
            await seedDb.SaveChangesAsync();

            await Task.Delay(100);

            var draft2 = NewsItem.Create("Draft 2", "Sub 2", "Body 2", "https://example.com/2.jpg", NewsStatus.Draft);
            seedDb.News.Add(draft2);
            await seedDb.SaveChangesAsync();

            await using var db = _fixture.CreateDbContext();
            var handler = new GetNewsDraftsHandler(db, null!);
            var query = new GetNewsDraftsQuery(1, 20);

            var result = await handler.Handle(query, CancellationToken.None);

            Assert.Equal(2, result.Length);
            // Most recent first (draft2 was created after draft1)
            Assert.Equal("Draft 2", result[0].Title);
            Assert.Equal("Draft 1", result[1].Title);
        }
    }
}
