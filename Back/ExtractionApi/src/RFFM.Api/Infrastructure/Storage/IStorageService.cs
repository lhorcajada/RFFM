using Microsoft.AspNetCore.Http;

namespace RFFM.Api.Infrastructure.Storage
{
    public interface IStorageService
    {
        Task<string> UploadAsync(string bucket, string filePath, IFormFile file, CancellationToken cancellationToken);
        Task<bool> DeleteAsync(string bucket, string filePath, CancellationToken cancellationToken);
        Task<(byte[] Content, string ContentType)?> DownloadAsync(string url, CancellationToken cancellationToken);
    }
}
