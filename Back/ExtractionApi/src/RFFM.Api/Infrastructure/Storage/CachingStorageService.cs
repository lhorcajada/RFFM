using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;

namespace RFFM.Api.Infrastructure.Storage
{
    /// <summary>Keeps downloaded files in memory so the same shield/photo isn't pulled from
    /// Supabase Storage (and billed as egress) on every request.</summary>
    public class CachingStorageService : IStorageService
    {
        public const int MaxCachedBytes = 2 * 1024 * 1024;
        private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(30);

        private readonly IStorageService _inner;
        private readonly IMemoryCache _cache;

        public CachingStorageService(IStorageService inner, IMemoryCache cache)
        {
            _inner = inner;
            _cache = cache;
        }

        public async Task<(byte[] Content, string ContentType)?> DownloadAsync(string url, CancellationToken cancellationToken)
        {
            var key = CacheKey(url);
            if (_cache.TryGetValue(key, out (byte[] Content, string ContentType) cached))
                return cached;

            var file = await _inner.DownloadAsync(url, cancellationToken);
            if (file is { Content.Length: <= MaxCachedBytes })
                _cache.Set(key, file.Value, Ttl);

            return file;
        }

        public async Task<string> UploadAsync(string bucket, string filePath, IFormFile file, CancellationToken cancellationToken)
        {
            var url = await _inner.UploadAsync(bucket, filePath, file, cancellationToken);
            Evict(bucket, filePath, url);
            return url;
        }

        public async Task<string> UploadBytesAsync(string bucket, string filePath, byte[] content, string contentType, CancellationToken cancellationToken)
        {
            var url = await _inner.UploadBytesAsync(bucket, filePath, content, contentType, cancellationToken);
            Evict(bucket, filePath, url);
            return url;
        }

        public async Task<bool> DeleteAsync(string bucket, string filePath, CancellationToken cancellationToken)
        {
            var deleted = await _inner.DeleteAsync(bucket, filePath, cancellationToken);
            Evict(bucket, filePath, null);
            return deleted;
        }

        private void Evict(string bucket, string filePath, string? url)
        {
            _cache.Remove(CacheKey($"{bucket}/{filePath}"));
            if (url != null)
                _cache.Remove(CacheKey(url));
        }

        private static string CacheKey(string url) => $"storage-file:{url}";
    }
}
