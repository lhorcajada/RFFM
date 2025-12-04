using Azure.Storage.Blobs;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Clubs.Queries
{
    public class GetClubEmblem : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("api/catalog/club/{id}/emblem", // Cambiamos el endpoint para incluir el ID en la ruta
                    async ([FromRoute] string id, [FromServices] IMediator mediator,
                        CancellationToken cancellationToken) =>
                    {
                        var query = new GetClubEmblemQueryApp { ClubId = id }; // Pasamos el ID del club
                        var result = await mediator.Send(query, cancellationToken);
                        return result != null ? Results.File(result.Stream, result.ContentType) : Results.NotFound();
                    })
                .WithName(nameof(GetClubEmblem))
                .WithTags(ClubConstants.ClubFeature)
                .Produces(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status404NotFound);
        }
    }

    public class GetClubEmblemQueryApp : Common.IQueryApp<GetClubEmblemResult>
    {
        public string ClubId { get; set; } // Cambiamos el parámetro para que sea el ID del club
    }

    public class GetClubEmblemResult
    {
        public Stream Stream { get; set; }
        public string ContentType { get; set; }
    }

    public class GetClubEmblemHandler : IRequestHandler<GetClubEmblemQueryApp, GetClubEmblemResult>
    {
        private readonly BlobServiceClient _blobServiceClient;
        private readonly AppDbContext _db;

        public GetClubEmblemHandler(BlobServiceClient blobServiceClient, AppDbContext db)
        {
            _blobServiceClient = blobServiceClient;
            _db = db;
        }

        public async ValueTask<GetClubEmblemResult> Handle(GetClubEmblemQueryApp request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrEmpty(request.ClubId))
                throw new ArgumentException("Club ID cannot be null or empty.");
            {
                var club = await _db.Clubs
                    .Include(c => c.Country)
                    .FirstOrDefaultAsync(c => c.Id == request.ClubId, cancellationToken);
                if (club == null)
                    throw new KeyNotFoundException($"Club '{request.ClubId}' Not Found");

                var blobUri = new Uri(club.ShieldUrl);
                var containerClient = _blobServiceClient.GetBlobContainerClient(ClubConstants.ClubsContainerName);
                var blobName = string.Join("", blobUri.Segments.Skip(2));
                var blobClient = containerClient.GetBlobClient(blobName);

                if (!await blobClient.ExistsAsync(cancellationToken))
                    return null!;

                var blobDownloadInfo = await blobClient.DownloadAsync(cancellationToken);

                return new GetClubEmblemResult
                {
                    Stream = blobDownloadInfo.Value.Content,
                    ContentType = blobDownloadInfo.Value.ContentType
                };
            }
        }
    }
}
