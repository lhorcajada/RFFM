using Microsoft.AspNetCore.Http;

namespace RFFM.Api.Infrastructure.Storage
{
    public class SupabaseStorageService : IStorageService
    {
        private readonly Supabase.Client _supabase;
        private readonly IHttpClientFactory _httpClientFactory;

        public SupabaseStorageService(Supabase.Client supabase, IHttpClientFactory httpClientFactory)
        {
            _supabase = supabase;
            _httpClientFactory = httpClientFactory;
        }

        public async Task<string> UploadAsync(string bucket, string filePath, IFormFile file, CancellationToken cancellationToken)
        {
            using var ms = new MemoryStream();
            await file.CopyToAsync(ms, cancellationToken);
            var bytes = ms.ToArray();

            await EnsureBucketExistsAsync(bucket);

            await _supabase.Storage
                .From(bucket)
                .Upload(bytes, filePath, new Supabase.Storage.FileOptions
                {
                    ContentType = file.ContentType,
                    Upsert = true
                });

            return _supabase.Storage.From(bucket).GetPublicUrl(filePath);
        }

        public async Task<string> UploadBytesAsync(string bucket, string filePath, byte[] content, string contentType, CancellationToken cancellationToken)
        {
            await EnsureBucketExistsAsync(bucket);

            await _supabase.Storage
                .From(bucket)
                .Upload(content, filePath, new Supabase.Storage.FileOptions
                {
                    ContentType = contentType,
                    Upsert = true
                });

            return _supabase.Storage.From(bucket).GetPublicUrl(filePath);
        }

        /// <summary>Supabase Storage buckets must exist before a file can be uploaded to them —
        /// unlike LocalStorageService, the SDK doesn't create them on demand. Every bucket used so
        /// far had been created manually in the Supabase dashboard ahead of time; the
        /// injury-protocol-attachments bucket wasn't, which caused a 500 in production while local
        /// dev (LocalStorageService) worked fine. This makes bucket creation self-healing instead
        /// of relying on a manual dashboard step for every new feature.</summary>
        private async Task EnsureBucketExistsAsync(string bucket)
        {
            try
            {
                var existing = await _supabase.Storage.GetBucket(bucket);
                if (existing != null) return;
            }
            catch
            {
                // GetBucket throws when the bucket doesn't exist yet — fall through to create it.
            }

            try
            {
                await _supabase.Storage.CreateBucket(bucket, new Supabase.Storage.BucketUpsertOptions { Public = true });
            }
            catch
            {
                // Lost a race with a concurrent request creating the same bucket — safe to ignore.
            }
        }

        public async Task<bool> DeleteAsync(string bucket, string filePath, CancellationToken cancellationToken)
        {
            var result = await _supabase.Storage
                .From(bucket)
                .Remove(new List<string> { filePath });

            return result != null && result.Count > 0;
        }

        public async Task<(byte[] Content, string ContentType)?> DownloadAsync(string url, CancellationToken cancellationToken)
        {
            if (!Uri.TryCreate(url, UriKind.Absolute, out _))
            {
                var relativePath = url.TrimStart('/');
                var bucketSeparatorIndex = relativePath.IndexOf('/');
                if (bucketSeparatorIndex <= 0 || bucketSeparatorIndex >= relativePath.Length - 1)
                    return null;

                var bucket = relativePath[..bucketSeparatorIndex];
                var filePath = relativePath[(bucketSeparatorIndex + 1)..];
                url = _supabase.Storage.From(bucket).GetPublicUrl(filePath);
            }

            var client = _httpClientFactory.CreateClient();
            var response = await client.GetAsync(url, cancellationToken);
            if (!response.IsSuccessStatusCode)
                return null;

            var content = await response.Content.ReadAsByteArrayAsync(cancellationToken);
            var contentType = response.Content.Headers.ContentType?.MediaType ?? "image/png";
            return (content, contentType);
        }
    }
}
