using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Storage;
using System.IO;

namespace RFFM.Api.Features.Infrastructure
{
    public class GetPublicStorageFile : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/public/storage",
                    async ([FromQuery] string url, [FromServices] IStorageService storageService, [FromServices] IConfiguration configuration,
                        CancellationToken cancellationToken) =>
                    {
                        if (string.IsNullOrEmpty(url)) return Results.BadRequest();

                        // If url is absolute (http/https) try storageService (works for Supabase public URLs)
                        if (url.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                        {
                            var file = await storageService.DownloadAsync(url, cancellationToken);
                            if (file == null) return Results.NotFound();
                            return Results.File(file.Value.Content, file.Value.ContentType);
                        }

                        // Non-absolute URL: treat as local storage relative path
                        var basePath = configuration["LocalStorage:BasePath"]
                            ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "RFFM", "storage");

                        var relative = url.Replace('/', Path.DirectorySeparatorChar);
                        var fullPath = Path.Combine(basePath, relative);
                        if (!File.Exists(fullPath))
                        {
                            // As a fallback, try storageService.DownloadAsync (in case the storage accepts relative keys)
                            var file = await storageService.DownloadAsync(url, cancellationToken);
                            if (file == null) return Results.NotFound();
                            return Results.File(file.Value.Content, file.Value.ContentType);
                        }

                        var bytes = await File.ReadAllBytesAsync(fullPath, cancellationToken);
                        var contentType = fullPath.EndsWith(".png", StringComparison.OrdinalIgnoreCase) ? "image/png"
                            : fullPath.EndsWith(".jpg", StringComparison.OrdinalIgnoreCase) || fullPath.EndsWith(".jpeg", StringComparison.OrdinalIgnoreCase) ? "image/jpeg"
                            : fullPath.EndsWith(".gif", StringComparison.OrdinalIgnoreCase) ? "image/gif"
                            : fullPath.EndsWith(".webp", StringComparison.OrdinalIgnoreCase) ? "image/webp"
                            : "application/octet-stream";

                        return Results.File(bytes, contentType);
                    })
                .WithName(nameof(GetPublicStorageFile))
                .WithTags("Storage")
                .Produces(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status404NotFound)
                .DisableAntiforgery();
        }
    }
}
