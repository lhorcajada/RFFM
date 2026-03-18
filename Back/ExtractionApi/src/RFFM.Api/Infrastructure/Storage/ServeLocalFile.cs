using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.Configuration;
using RFFM.Api.FeatureModules;

namespace RFFM.Api.Infrastructure.Storage
{
    public class ServeLocalFile : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("api/local-storage/{bucket}/{**path}",
                    ([FromRoute] string bucket, [FromRoute] string path,
                        [FromServices] IConfiguration configuration) =>
                    {
                        var basePath = configuration["LocalStorage:BasePath"]
                            ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "RFFM", "storage");

                        var relativePath = path.Replace('/', Path.DirectorySeparatorChar);
                        var fullPath = Path.GetFullPath(Path.Combine(basePath, bucket, relativePath));

                        // Prevent path traversal attacks
                        var allowedRoot = Path.GetFullPath(basePath);
                        if (!fullPath.StartsWith(allowedRoot, StringComparison.OrdinalIgnoreCase))
                            return Results.BadRequest();

                        if (!File.Exists(fullPath))
                            return Results.NotFound();

                        var provider = new FileExtensionContentTypeProvider();
                        if (!provider.TryGetContentType(fullPath, out var contentType))
                            contentType = "application/octet-stream";

                        return Results.File(fullPath, contentType);
                    })
                .WithName("ServeLocalFile")
                .WithTags("LocalStorage")
                .Produces(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status404NotFound);
        }
    }
}
