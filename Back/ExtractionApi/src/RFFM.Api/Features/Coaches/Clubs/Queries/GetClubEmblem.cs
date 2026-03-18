using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Storage;

namespace RFFM.Api.Features.Coaches.Clubs.Queries
{
    public class GetClubEmblem : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("api/catalog/club/{id}/emblem",
                    async ([FromRoute] string id, [FromServices] IMediator mediator,
                        CancellationToken cancellationToken) =>
                    {
                        var query = new GetClubEmblemQueryApp { ClubId = id };
                        var result = await mediator.Send(query, cancellationToken);
                        return result != null ? Results.File(result.Content, result.ContentType) : Results.NotFound();
                    })
                .WithName(nameof(GetClubEmblem))
                .WithTags(ClubConstants.ClubFeature)
                .Produces(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status404NotFound);
        }
    }

    public class GetClubEmblemQueryApp : Common.IQueryApp<GetClubEmblemResult>
    {
        public string ClubId { get; set; }
    }

    public class GetClubEmblemResult
    {
        public byte[] Content { get; set; }
        public string ContentType { get; set; }
    }

    public class GetClubEmblemHandler : IRequestHandler<GetClubEmblemQueryApp, GetClubEmblemResult>
    {
        private readonly AppDbContext _db;
        private readonly IStorageService _storageService;

        public GetClubEmblemHandler(AppDbContext db, IStorageService storageService)
        {
            _db = db;
            _storageService = storageService;
        }

        public async ValueTask<GetClubEmblemResult> Handle(GetClubEmblemQueryApp request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrEmpty(request.ClubId))
                throw new ArgumentException("Club ID cannot be null or empty.");

            var club = await _db.Clubs
                .FirstOrDefaultAsync(c => c.Id == request.ClubId, cancellationToken);
            if (club == null)
                throw new KeyNotFoundException($"Club '{request.ClubId}' Not Found");

            if (string.IsNullOrEmpty(club.ShieldUrl))
                return null!;

            var download = await _storageService.DownloadAsync(club.ShieldUrl, cancellationToken);
            if (download == null)
                return null!;

            return new GetClubEmblemResult { Content = download.Value.Content, ContentType = download.Value.ContentType };
        }
    }
}
