#nullable enable
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain.Entities.News;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Coaches.News;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetNewsByIdHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetNewsByIdHandlerTests(PostgresContainerFixture fixture)
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
        public async Task Handle_PublishedItemVisibleToAnyRole()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var news = await CreateTestNewsAsync(seedDb, NewsStatus.Published);

            var mockCurrentUser = new Mock<ICurrentUserService>();
            mockCurrentUser.Setup(x => x.Roles).Returns(new[] { "FamilyMember" });

            await using var db = _fixture.CreateDbContext();
            var handler = new GetNewsByIdHandler(db, mockCurrentUser.Object);
            var query = new GetNewsByIdQuery(news.Id);

            var result = await handler.Handle(query, CancellationToken.None);

            Assert.NotNull(result);
            Assert.Equal("Test Title", result.Title);
        }

        [Fact]
        public async Task Handle_DraftItemVisibleToCoach()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var news = await CreateTestNewsAsync(seedDb, NewsStatus.Draft);

            var mockCurrentUser = new Mock<ICurrentUserService>();
            mockCurrentUser.Setup(x => x.Roles).Returns(new[] { "Coach" });

            await using var db = _fixture.CreateDbContext();
            var handler = new GetNewsByIdHandler(db, mockCurrentUser.Object);
            var query = new GetNewsByIdQuery(news.Id);

            var result = await handler.Handle(query, CancellationToken.None);

            Assert.NotNull(result);
            Assert.Equal("Test Title", result.Title);
        }

        [Fact]
        public async Task Handle_DraftItemVisibleToAdministrator()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var news = await CreateTestNewsAsync(seedDb, NewsStatus.Draft);

            var mockCurrentUser = new Mock<ICurrentUserService>();
            mockCurrentUser.Setup(x => x.Roles).Returns(new[] { "Administrator" });

            await using var db = _fixture.CreateDbContext();
            var handler = new GetNewsByIdHandler(db, mockCurrentUser.Object);
            var query = new GetNewsByIdQuery(news.Id);

            var result = await handler.Handle(query, CancellationToken.None);

            Assert.NotNull(result);
            Assert.Equal("Test Title", result.Title);
        }

        [Fact]
        public async Task Handle_DraftItemNotVisibleToFamilyMember()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var news = await CreateTestNewsAsync(seedDb, NewsStatus.Draft);

            var mockCurrentUser = new Mock<ICurrentUserService>();
            mockCurrentUser.Setup(x => x.Roles).Returns(new[] { "FamilyMember" });

            await using var db = _fixture.CreateDbContext();
            var handler = new GetNewsByIdHandler(db, mockCurrentUser.Object);
            var query = new GetNewsByIdQuery(news.Id);

            var result = await handler.Handle(query, CancellationToken.None);

            Assert.Null(result);
        }

        [Fact]
        public async Task Handle_DraftItemNotVisibleToPlayer()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var news = await CreateTestNewsAsync(seedDb, NewsStatus.Draft);

            var mockCurrentUser = new Mock<ICurrentUserService>();
            mockCurrentUser.Setup(x => x.Roles).Returns(new[] { "Player" });

            await using var db = _fixture.CreateDbContext();
            var handler = new GetNewsByIdHandler(db, mockCurrentUser.Object);
            var query = new GetNewsByIdQuery(news.Id);

            var result = await handler.Handle(query, CancellationToken.None);

            Assert.Null(result);
        }

        [Fact]
        public async Task Handle_DraftItemNotVisibleToUserWithoutRole()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var news = await CreateTestNewsAsync(seedDb, NewsStatus.Draft);

            var mockCurrentUser = new Mock<ICurrentUserService>();
            mockCurrentUser.Setup(x => x.Roles).Returns((string[]?)null);

            await using var db = _fixture.CreateDbContext();
            var handler = new GetNewsByIdHandler(db, mockCurrentUser.Object);
            var query = new GetNewsByIdQuery(news.Id);

            var result = await handler.Handle(query, CancellationToken.None);

            Assert.Null(result);
        }

        [Fact]
        public async Task Handle_UnknownIdReturnsNull()
        {
            var mockCurrentUser = new Mock<ICurrentUserService>();
            mockCurrentUser.Setup(x => x.Roles).Returns(new[] { "Coach" });

            await using var db = _fixture.CreateDbContext();
            var handler = new GetNewsByIdHandler(db, mockCurrentUser.Object);
            var query = new GetNewsByIdQuery("nonexistent-id");

            var result = await handler.Handle(query, CancellationToken.None);

            Assert.Null(result);
        }
    }
}
