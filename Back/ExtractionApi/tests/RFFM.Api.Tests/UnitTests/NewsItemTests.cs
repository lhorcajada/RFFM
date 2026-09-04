#nullable enable
using System;
using Xunit;
using RFFM.Api.Domain.Entities.News;

namespace RFFM.Api.Tests.UnitTests
{
    public class NewsItemTests
    {
        private static NewsItem CreateDefaultNews() =>
            NewsItem.Create(
                "Test Title",
                "Test Subtitle",
                "Test Body",
                "https://example.com/image.jpg",
                NewsStatus.Draft,
                new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc),
                NewsLinkType.None,
                null,
                null,
                null
            );

        [Fact]
        public void Create_WithLinkTypeNone_Succeeds_WithNullLinkFields()
        {
            var news = NewsItem.Create(
                "Title",
                "Subtitle",
                "Body",
                "https://example.com/image.jpg",
                NewsStatus.Draft,
                new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc),
                NewsLinkType.None,
                null,
                null,
                null
            );

            Assert.Equal(NewsLinkType.None, news.LinkType);
            Assert.Null(news.LinkedEventId);
            Assert.Null(news.LinkedTeamId);
            Assert.Null(news.LinkUrl);
        }

        [Fact]
        public void Create_WithMatchConvocation_MissingEventId_Throws()
        {
            var ex = Assert.Throws<ArgumentException>(() =>
                NewsItem.Create(
                    "Title",
                    "Subtitle",
                    "Body",
                    "https://example.com/image.jpg",
                    NewsStatus.Draft,
                    new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc),
                    NewsLinkType.MatchConvocation,
                    null,
                    "team-123",
                    null
                )
            );

            Assert.Contains("partido enlazado", ex.Message);
        }

        [Fact]
        public void Create_WithMatchConvocation_MissingTeamId_Throws()
        {
            var ex = Assert.Throws<ArgumentException>(() =>
                NewsItem.Create(
                    "Title",
                    "Subtitle",
                    "Body",
                    "https://example.com/image.jpg",
                    NewsStatus.Draft,
                    new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc),
                    NewsLinkType.MatchConvocation,
                    "event-123",
                    null,
                    null
                )
            );

            Assert.Contains("partido enlazado", ex.Message);
        }

        [Fact]
        public void Create_WithMatchConvocation_ValidIds_StoresThem()
        {
            var news = NewsItem.Create(
                "Title",
                "Subtitle",
                "Body",
                "https://example.com/image.jpg",
                NewsStatus.Draft,
                new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc),
                NewsLinkType.MatchConvocation,
                "event-123",
                "team-456",
                null
            );

            Assert.Equal(NewsLinkType.MatchConvocation, news.LinkType);
            Assert.Equal("event-123", news.LinkedEventId);
            Assert.Equal("team-456", news.LinkedTeamId);
            Assert.Null(news.LinkUrl);
        }

        [Fact]
        public void Create_WithExternal_MissingUrl_Throws()
        {
            var ex = Assert.Throws<ArgumentException>(() =>
                NewsItem.Create(
                    "Title",
                    "Subtitle",
                    "Body",
                    "https://example.com/image.jpg",
                    NewsStatus.Draft,
                    new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc),
                    NewsLinkType.External,
                    null,
                    null,
                    null
                )
            );

            Assert.Contains("URL", ex.Message);
        }

        [Fact]
        public void Create_WithExternal_ValidUrl_StoresIt()
        {
            var news = NewsItem.Create(
                "Title",
                "Subtitle",
                "Body",
                "https://example.com/image.jpg",
                NewsStatus.Draft,
                new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc),
                NewsLinkType.External,
                null,
                null,
                "https://maps.google.com/path"
            );

            Assert.Equal(NewsLinkType.External, news.LinkType);
            Assert.Null(news.LinkedEventId);
            Assert.Null(news.LinkedTeamId);
            Assert.Equal("https://maps.google.com/path", news.LinkUrl);
        }

        [Fact]
        public void UpdateContent_ChangingLinkTypeToNone_ClearsLinkFields()
        {
            var news = NewsItem.Create(
                "Title",
                "Subtitle",
                "Body",
                "https://example.com/image.jpg",
                NewsStatus.Draft,
                new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc),
                NewsLinkType.External,
                null,
                null,
                "https://maps.google.com/path"
            );

            Assert.Equal(NewsLinkType.External, news.LinkType);
            Assert.Equal("https://maps.google.com/path", news.LinkUrl);

            // Update to None, clearing all link fields
            news.UpdateContent(
                "Updated Title",
                "Updated Subtitle",
                "Updated Body",
                "https://example.com/updated.jpg",
                new DateTime(2026, 9, 2, 0, 0, 0, DateTimeKind.Utc),
                NewsLinkType.None,
                null,
                null,
                null
            );

            Assert.Equal(NewsLinkType.None, news.LinkType);
            Assert.Null(news.LinkedEventId);
            Assert.Null(news.LinkedTeamId);
            Assert.Null(news.LinkUrl);
        }

        [Fact]
        public void UpdateContent_WithMatchConvocation_MissingTeamId_Throws()
        {
            var news = CreateDefaultNews();

            var ex = Assert.Throws<ArgumentException>(() =>
                news.UpdateContent(
                    "Updated Title",
                    "Updated Subtitle",
                    "Updated Body",
                    "https://example.com/updated.jpg",
                    new DateTime(2026, 9, 2, 0, 0, 0, DateTimeKind.Utc),
                    NewsLinkType.MatchConvocation,
                    "event-123",
                    null,
                    null
                )
            );

            Assert.Contains("partido enlazado", ex.Message);
        }
    }
}
