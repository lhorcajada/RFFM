using System.Security.Cryptography;
using Microsoft.AspNetCore.Http;
using Microsoft.Net.Http.Headers;

namespace RFFM.Api.Infrastructure.Storage
{
    /// <summary>File response with Cache-Control and a content ETag, so browsers reuse the
    /// image (or get a 304) instead of requesting it again on every screen.</summary>
    public static class CachedFileResult
    {
        private const int MaxAgeSeconds = 86400;

        public static IResult Create(byte[] content, string contentType, bool isPublic)
        {
            var hash = Convert.ToHexString(SHA256.HashData(content))[..16];
            var etag = new EntityTagHeaderValue($"\"{hash}\"");
            var scope = isPublic ? "public" : "private";
            return new CacheHeaderResult(Results.File(content, contentType, entityTag: etag), $"{scope}, max-age={MaxAgeSeconds}");
        }

        private sealed class CacheHeaderResult : IResult
        {
            private readonly IResult _inner;
            private readonly string _cacheControl;

            public CacheHeaderResult(IResult inner, string cacheControl)
            {
                _inner = inner;
                _cacheControl = cacheControl;
            }

            public Task ExecuteAsync(HttpContext httpContext)
            {
                httpContext.Response.Headers.CacheControl = _cacheControl;
                return _inner.ExecuteAsync(httpContext);
            }
        }
    }
}
