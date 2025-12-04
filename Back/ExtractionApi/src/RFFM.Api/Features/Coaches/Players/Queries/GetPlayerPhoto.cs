using Azure.Storage.Blobs;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Common;
using RFFM.Api.FeatureModules;

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
                        return result != null ? Results.File(result.Stream, result.ContentType) : Results.NotFound();
                    })
                .WithName(nameof(GetPlayerPhoto))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status404NotFound);

        }
    }

    public class GetPlayerPhotoQuery : IQueryApp<GetPlayerPhotoResult>
    {
        public string Url { get; set; }
    }

    public class GetPlayerPhotoResult
    {
        public Stream Stream { get; set; }
        public string ContentType { get; set; }
    }

    public class GetPlayerPhotoHandler : IRequestHandler<GetPlayerPhotoQuery, GetPlayerPhotoResult>
    {
        private readonly BlobServiceClient _blobServiceClient;

        public GetPlayerPhotoHandler(BlobServiceClient blobServiceClient)
        {
            _blobServiceClient = blobServiceClient;
        }

        public async ValueTask<GetPlayerPhotoResult> Handle(GetPlayerPhotoQuery request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrEmpty(request.Url))
                throw new ArgumentException("URL cannot be null or empty.");

            var blobUri = new Uri(request.Url);
            var containerClient = _blobServiceClient.GetBlobContainerClient(PlayerConstants.PlayersContainerName);
            var blobName = string.Join("", blobUri.Segments.Skip(2));
            var blobClient = containerClient.GetBlobClient(blobName);

            if (!await blobClient.ExistsAsync(cancellationToken))
                return null!;

            var blobDownloadInfo = await blobClient.DownloadAsync(cancellationToken);

            return new GetPlayerPhotoResult
            {
                Stream = blobDownloadInfo.Value.Content,
                ContentType = blobDownloadInfo.Value.ContentType
            };
        }
    }
}
