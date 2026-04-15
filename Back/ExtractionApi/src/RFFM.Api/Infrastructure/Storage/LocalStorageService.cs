using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace RFFM.Api.Infrastructure.Storage
{
    public class LocalStorageService : IStorageService
    {
        private readonly string _basePath;

        public LocalStorageService(IConfiguration configuration)
        {
            _basePath = configuration["LocalStorage:BasePath"]
                ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "RFFM", "storage");
        }

        public async Task<string> UploadAsync(string bucket, string filePath, IFormFile file, CancellationToken cancellationToken)
        {
            var relativePath = filePath.Replace('/', Path.DirectorySeparatorChar);
            var fullDirectory = Path.Combine(_basePath, bucket, Path.GetDirectoryName(relativePath) ?? "");
            Directory.CreateDirectory(fullDirectory);

            var fullPath = Path.Combine(_basePath, bucket, relativePath);
            await using var stream = new FileStream(fullPath, FileMode.Create);
            await file.CopyToAsync(stream, cancellationToken);

            return $"{bucket}/{filePath.Replace('\\', '/')}";
        }

        public Task<bool> DeleteAsync(string bucket, string filePath, CancellationToken cancellationToken)
        {
            var relativePath = filePath.Replace('/', Path.DirectorySeparatorChar);
            var fullPath = Path.Combine(_basePath, bucket, relativePath);

            if (File.Exists(fullPath))
            {
                File.Delete(fullPath);
                return Task.FromResult(true);
            }

            return Task.FromResult(false);
        }

        public async Task<(byte[] Content, string ContentType)?> DownloadAsync(string url, CancellationToken cancellationToken)
        {
            var fullPath = Path.Combine(_basePath, url.Replace('/', Path.DirectorySeparatorChar));

            if (!File.Exists(fullPath))
                return null;

            var bytes = await File.ReadAllBytesAsync(fullPath, cancellationToken);
            return (bytes, GetContentType(Path.GetExtension(fullPath)));
        }

        public async Task<string> UploadBytesAsync(string bucket, string filePath, byte[] content, string contentType, CancellationToken cancellationToken)
        {
            var relativePath = filePath.Replace('/', Path.DirectorySeparatorChar);
            var fullDirectory = Path.Combine(_basePath, bucket, Path.GetDirectoryName(relativePath) ?? "");
            Directory.CreateDirectory(fullDirectory);

            var fullPath = Path.Combine(_basePath, bucket, relativePath);
            await File.WriteAllBytesAsync(fullPath, content, cancellationToken);

            return $"{bucket}/{filePath.Replace('\\', '/')}";
        }

        private static string GetContentType(string extension) => extension.ToLowerInvariant() switch
        {
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".gif" => "image/gif",
            ".webp" => "image/webp",
            ".svg" => "image/svg+xml",
            _ => "application/octet-stream"
        };
    }
}
