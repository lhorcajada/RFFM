using FluentValidation;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Storage;

namespace RFFM.Api.Features.Coaches.Rivals.Commands
{
    public class UploadRivalPhoto : IFeatureModule
    {
        public const string RivalsContainerName = "rivalphotos";

        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/rivals/photo",
                    async (IFormFile file, IStorageService storageService, CancellationToken cancellationToken) =>
                    {
                        if (file == null || file.Length == 0)
                            return Results.BadRequest("File is invalid.");

                        var fileName = Guid.NewGuid() + System.IO.Path.GetExtension(file.FileName);
                        var url = await storageService.UploadAsync(RivalsContainerName, fileName, file, cancellationToken);

                        return Results.Ok(new UploadRivalPhotoResult { Url = url });
                    })
                .WithName(nameof(UploadRivalPhoto))
                .WithTags("Rivals")
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .DisableAntiforgery();
        }
    }

    public class UploadRivalPhotoResult
    {
        public string Url { get; set; } = null!;
    }
}
