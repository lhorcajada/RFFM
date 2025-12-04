using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain.Models;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Players.Queries
{
    public class GetPlayers : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/players/{clubId}",
                    async (string clubId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        return await mediator.Send(new PlayersQuery(){ClubId = clubId}, cancellationToken);
                    })
                .WithName(nameof(GetPlayers))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<PlayersResponse[]>();
        }

        public record PlayersQuery : IQueryApp<PlayersResponse[]>, ICacheRequest
        {
            public string ClubId { get; set; } = null!;
            public string CacheKey => PlayerConstants.CachePrefix;
            public DateTime? AbsoluteExpirationRelativeToNow { get; }
        }

        public record PlayersResponse(PlayerModel PlayerModel);

        public class GetPlayersRequestHandler : IRequestHandler<PlayersQuery, PlayersResponse[]>
        {
            private readonly AppDbContext _db;

            public GetPlayersRequestHandler(AppDbContext db)
            {
                _db = db;
            }

            public async ValueTask<PlayersResponse[]> Handle(PlayersQuery request, CancellationToken cancellationToken = default)
            {
                return await _db.Players
                    .Where(p => p.ClubId == request.ClubId)
                    .Select(player => new PlayersResponse(new PlayerModel
                    {
                        Id = player.Id,
                        Alias = player.Alias,
                        Name = player.Name,
                        LastName = player.LastName,
                        BirthDate = player.BirthDate,
                        Dni = player.Dni,
                        UrlPhoto = player.UrlPhoto,
                        ClubId = player.ClubId

                    }))
                    .ToArrayAsync(cancellationToken);
            }
        }
    }
}
