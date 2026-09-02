using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Common;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Storage;

namespace RFFM.Api.Features.Coaches.Teams.Queries
{
    public class GetTeamPhoto : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("api/catalog/team/photo",
                    async ([FromQuery] string url, [FromServices] IMediator mediator,
                        CancellationToken cancellationToken) =>
                    {
                        var query = new GetTeamPhotoQuery { Url = url };
                        var result = await mediator.Send(query, cancellationToken);
                        return result != null
                            ? Results.File(result.Content, result.ContentType)
                            : Results.NotFound();
                    })
                .WithName(nameof(GetTeamPhoto))
                .WithTags(TeamConstants.TeamFeature)
                // Anonymous on purpose: a plain <img src> (match cards, event lists…) can't
                // attach an Authorization header, and this is the only way to render a team
                // shield stored via LocalStorageService, whose upload returns a bare
                // "{bucket}/{file}" relative path instead of a public URL. Same trust level
                // as rival shields, which are already unauthenticated RFFM/Supabase URLs.
                .Produces(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status404NotFound);
        }
    }

    public class GetTeamPhotoQuery : IQueryApp<GetTeamPhotoResult>
    {
        public string Url { get; set; } = null!;
    }

    public class GetTeamPhotoResult
    {
        public byte[] Content { get; set; } = Array.Empty<byte>();
        public string ContentType { get; set; } = "image/png";
    }

    public class GetTeamPhotoHandler : IRequestHandler<GetTeamPhotoQuery, GetTeamPhotoResult>
    {
        private static readonly HashSet<string> AllowedExtensions =
            new(StringComparer.OrdinalIgnoreCase) { ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg" };

        private readonly IStorageService _storageService;

        public GetTeamPhotoHandler(IStorageService storageService)
        {
            _storageService = storageService;
        }

        public async ValueTask<GetTeamPhotoResult> Handle(GetTeamPhotoQuery request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrEmpty(request.Url))
                return null!;

            var pathPart = request.Url.Contains('?')
                ? request.Url[..request.Url.IndexOf('?')]
                : request.Url;

            var ext = Path.GetExtension(pathPart);
            if (!AllowedExtensions.Contains(ext))
                return null!;

            var file = await _storageService.DownloadAsync(request.Url, cancellationToken);
            if (file == null)
                return null!;

            return new GetTeamPhotoResult
            {
                Content = file.Value.Content,
                ContentType = file.Value.ContentType
            };
        }
    }
}
