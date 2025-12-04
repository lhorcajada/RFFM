using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Models;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Players.Queries
{
    public class GetPlayer : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/player/{id}",
                    async (string id, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var query = new GetPlayerQuery
                        {
                            PlayerId = id

                        };
                        return await mediator.Send(query, cancellationToken);
                    })
                .WithName(nameof(GetPlayer))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<GetPlayerResponse>();
        }

        public record GetPlayerQuery : IQueryApp<GetPlayerResponse>, ICacheRequest
        {
            public string PlayerId { get; set; } = null!;
            public string CacheKey => PlayerConstants.CachePrefix;
            public DateTime? AbsoluteExpirationRelativeToNow { get; }
        }

        public record GetPlayerResponse(PlayerModel PlayerModel);

        public class GetPlayerRequestHandler(AppDbContext db) : IRequestHandler<GetPlayerQuery, GetPlayerResponse>
        {
            public async ValueTask<GetPlayerResponse> Handle(GetPlayerQuery request,
                CancellationToken cancellationToken = default)
            {
                var player = await db.Players
                    .FirstOrDefaultAsync(c => c.Id == request.PlayerId, cancellationToken);
                if (player == null)
                    throw new KeyNotFoundException($"{nameof(Player)} '{request.PlayerId}' Not Found");

                return new GetPlayerResponse(new PlayerModel
                {
                    Id = player.Id,
                    Alias = player.Alias,
                    Name = player.Name,
                    LastName = player.LastName,
                    BirthDate = player.BirthDate,
                    Dni = player.Dni,
                    UrlPhoto = player.UrlPhoto
                });


            }
        }
    }
}