using Azure.Storage.Blobs;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Common;
using RFFM.Api.FeatureModules;

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
                        return result != null ? Results.File(result.Stream, result.ContentType) : Results.NotFound();
                    })
                .WithName(nameof(GetTeamPhoto))
                .WithTags(TeamConstants.TeamFeature)
                .Produces(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status404NotFound);
        }
    }

    public class GetTeamPhotoQuery : IQueryApp<GetTeamPhotoResult>
    {
        public string Url { get; set; }
    }

    public class GetTeamPhotoResult
    {
        public Stream Stream { get; set; }
        public string ContentType { get; set; }
    }

    public class GetTeamPhotoHandler : IRequestHandler<GetTeamPhotoQuery, GetTeamPhotoResult>
    {
        private readonly BlobServiceClient _blobServiceClient;

        public GetTeamPhotoHandler(BlobServiceClient blobServiceClient)
        {
            _blobServiceClient = blobServiceClient;
        }

        public async ValueTask<GetTeamPhotoResult> Handle(GetTeamPhotoQuery request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrEmpty(request.Url))
                throw new ArgumentException("URL cannot be null or empty.");

            var blobUri = new Uri(request.Url);
            var containerClient = _blobServiceClient.GetBlobContainerClient(TeamConstants.TeamsContainerName);
            var blobName = string.Join("", blobUri.Segments.Skip(2));
            var blobClient = containerClient.GetBlobClient(blobName);

            if (!await blobClient.ExistsAsync(cancellationToken))
                return null!;

            var blobDownloadInfo = await blobClient.DownloadAsync(cancellationToken);

            return new GetTeamPhotoResult
            {
                Stream = blobDownloadInfo.Value.Content,
                ContentType = blobDownloadInfo.Value.ContentType
            };
        }
    }
}
