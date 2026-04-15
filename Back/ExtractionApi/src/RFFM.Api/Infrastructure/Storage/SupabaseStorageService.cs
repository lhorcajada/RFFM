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
            await _supabase.Storage
                .From(bucket)
                .Upload(content, filePath, new Supabase.Storage.FileOptions
                {
                    ContentType = contentType,
                    Upsert = true
                });

            return _supabase.Storage.From(bucket).GetPublicUrl(filePath);
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
