using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Common;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Storage;

namespace RFFM.Api.Features.Coaches.Players.Queries
{
    public class GetPlayerPhoto : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("api/catalog/player/photo",
                    async ([FromQuery] string url, [FromServices] IMediator mediator,
                        CancellationToken cancellationToken) =>
                    {
                        var query = new GetPlayerPhotoQuery { Url = url };
                        var result = await mediator.Send(query, cancellationToken);
                        return result != null
                            ? Results.File(result.Content, result.ContentType)
                            : Results.NotFound();
                    })
                .WithName(nameof(GetPlayerPhoto))
                .WithTags(PlayerConstants.PlayerFeature)
                .RequireAuthorization()
                .Produces(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status404NotFound);
        }
    }

    public class GetPlayerPhotoQuery : IQueryApp<GetPlayerPhotoResult>
    {
        public string Url { get; set; } = null!;
    }

    public class GetPlayerPhotoResult
    {
        public byte[] Content { get; set; } = Array.Empty<byte>();
        public string ContentType { get; set; } = "image/png";
    }

    public class GetPlayerPhotoHandler : IRequestHandler<GetPlayerPhotoQuery, GetPlayerPhotoResult>
    {
        private static readonly HashSet<string> AllowedExtensions =
            new(StringComparer.OrdinalIgnoreCase) { ".png", ".jpg", ".jpeg", ".gif", ".webp" };

        private readonly IStorageService _storageService;

        public GetPlayerPhotoHandler(IStorageService storageService)
        {
            _storageService = storageService;
        }

        public async ValueTask<GetPlayerPhotoResult> Handle(GetPlayerPhotoQuery request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrEmpty(request.Url))
                return null!;

            // Strip query-string before checking extension (handles Supabase public URLs)
            var pathPart = request.Url.Contains('?')
                ? request.Url[..request.Url.IndexOf('?')]
                : request.Url;

            var ext = Path.GetExtension(pathPart);
            if (!AllowedExtensions.Contains(ext))
                return null!;

            var file = await _storageService.DownloadAsync(request.Url, cancellationToken);
            if (file == null)
                return null!;

            return new GetPlayerPhotoResult
            {
                Content = file.Value.Content,
                ContentType = file.Value.ContentType
            };
        }
    }
}
