using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Caching.Memory;
using Moq;
using RFFM.Api.Infrastructure.Storage;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class CachingStorageServiceTests
    {
        private const string Url = "https://x.supabase.co/storage/v1/object/public/emblems/a.png";

        private readonly Mock<IStorageService> _inner = new();
        private readonly IMemoryCache _cache = new MemoryCache(new MemoryCacheOptions());

        private CachingStorageService CreateSut() => new(_inner.Object, _cache);

        [Fact]
        public async Task DownloadAsync_SecondCallForSameUrl_DoesNotHitInnerAgain()
        {
            _inner.Setup(s => s.DownloadAsync(Url, It.IsAny<CancellationToken>()))
                .ReturnsAsync((new byte[] { 1, 2, 3 }, "image/png"));
            var sut = CreateSut();

            await sut.DownloadAsync(Url, CancellationToken.None);
            var second = await sut.DownloadAsync(Url, CancellationToken.None);

            Assert.Equal(new byte[] { 1, 2, 3 }, second!.Value.Content);
            _inner.Verify(s => s.DownloadAsync(Url, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task DownloadAsync_WhenInnerReturnsNull_DoesNotCacheTheMiss()
        {
            _inner.Setup(s => s.DownloadAsync(Url, It.IsAny<CancellationToken>()))
                .ReturnsAsync(((byte[] Content, string ContentType)?)null);
            var sut = CreateSut();

            await sut.DownloadAsync(Url, CancellationToken.None);
            await sut.DownloadAsync(Url, CancellationToken.None);

            _inner.Verify(s => s.DownloadAsync(Url, It.IsAny<CancellationToken>()), Times.Exactly(2));
        }

        [Fact]
        public async Task DownloadAsync_FileLargerThanLimit_IsNotCached()
        {
            var big = new byte[CachingStorageService.MaxCachedBytes + 1];
            _inner.Setup(s => s.DownloadAsync(Url, It.IsAny<CancellationToken>()))
                .ReturnsAsync((big, "image/png"));
            var sut = CreateSut();

            await sut.DownloadAsync(Url, CancellationToken.None);
            await sut.DownloadAsync(Url, CancellationToken.None);

            _inner.Verify(s => s.DownloadAsync(Url, It.IsAny<CancellationToken>()), Times.Exactly(2));
        }

        [Fact]
        public async Task UploadBytesAsync_EvictsCachedEntryOfTheUploadedFile()
        {
            _inner.Setup(s => s.DownloadAsync(Url, It.IsAny<CancellationToken>()))
                .ReturnsAsync((new byte[] { 1 }, "image/png"));
            _inner.Setup(s => s.UploadBytesAsync("emblems", "a.png", It.IsAny<byte[]>(), "image/png", It.IsAny<CancellationToken>()))
                .ReturnsAsync(Url);
            var sut = CreateSut();
            await sut.DownloadAsync(Url, CancellationToken.None);

            await sut.UploadBytesAsync("emblems", "a.png", new byte[] { 2 }, "image/png", CancellationToken.None);
            await sut.DownloadAsync(Url, CancellationToken.None);

            _inner.Verify(s => s.DownloadAsync(Url, It.IsAny<CancellationToken>()), Times.Exactly(2));
        }

        [Fact]
        public async Task DeleteAsync_EvictsCachedRelativeEntry()
        {
            const string relative = "emblems/a.png";
            _inner.Setup(s => s.DownloadAsync(relative, It.IsAny<CancellationToken>()))
                .ReturnsAsync((new byte[] { 1 }, "image/png"));
            _inner.Setup(s => s.DeleteAsync("emblems", "a.png", It.IsAny<CancellationToken>())).ReturnsAsync(true);
            var sut = CreateSut();
            await sut.DownloadAsync(relative, CancellationToken.None);

            await sut.DeleteAsync("emblems", "a.png", CancellationToken.None);
            await sut.DownloadAsync(relative, CancellationToken.None);

            _inner.Verify(s => s.DownloadAsync(relative, It.IsAny<CancellationToken>()), Times.Exactly(2));
        }
    }

    public class CachedFileResultTests
    {
        private static async Task<DefaultHttpContext> ExecuteAsync(IResult result, string? ifNoneMatch = null)
        {
            var context = new DefaultHttpContext { RequestServices = new ServiceCollection().AddLogging().BuildServiceProvider() };
            context.Response.Body = new MemoryStream();
            if (ifNoneMatch != null)
                context.Request.Headers.IfNoneMatch = ifNoneMatch;
            await result.ExecuteAsync(context);
            return context;
        }

        [Fact]
        public async Task Create_Public_SetsPublicCacheControlAndEtag()
        {
            var context = await ExecuteAsync(CachedFileResult.Create(new byte[] { 1, 2, 3 }, "image/png", isPublic: true));

            Assert.Equal("public, max-age=86400", context.Response.Headers.CacheControl.ToString());
            Assert.False(string.IsNullOrEmpty(context.Response.Headers.ETag.ToString()));
        }

        [Fact]
        public async Task Create_NotPublic_SetsPrivateCacheControl()
        {
            var context = await ExecuteAsync(CachedFileResult.Create(new byte[] { 1 }, "image/png", isPublic: false));

            Assert.Equal("private, max-age=86400", context.Response.Headers.CacheControl.ToString());
        }

        [Fact]
        public async Task Create_WhenIfNoneMatchMatchesEtag_Returns304()
        {
            var first = await ExecuteAsync(CachedFileResult.Create(new byte[] { 1, 2, 3 }, "image/png", isPublic: true));
            var etag = first.Response.Headers.ETag.ToString();

            var second = await ExecuteAsync(CachedFileResult.Create(new byte[] { 1, 2, 3 }, "image/png", isPublic: true), etag);

            Assert.Equal(StatusCodes.Status304NotModified, second.Response.StatusCode);
        }
    }
}
