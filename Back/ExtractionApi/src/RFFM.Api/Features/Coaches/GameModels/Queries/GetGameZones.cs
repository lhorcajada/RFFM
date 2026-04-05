using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.GameModels.Queries
{
    public class GetGameZones : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/game-models/zones",
                    async (IMediator mediator, CancellationToken cancellationToken) =>
                        Results.Ok(await mediator.Send(new GameZonesQuery(), cancellationToken)))
                .WithName(nameof(GetGameZones))
                .WithTags(GameModelConstants.Tag)
                .RequireAuthorization()
                .Produces<GameZoneResponse[]>();
        }

        public record GameZonesQuery : IQueryApp<GameZoneResponse[]>;

        public record GameZoneResponse(int Id, string Name, int Order);

        public class Handler : IRequestHandler<GameZonesQuery, GameZoneResponse[]>
        {
            private readonly AppDbContext _db;
            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<GameZoneResponse[]> Handle(GameZonesQuery request, CancellationToken cancellationToken = default)
                => await _db.GameZones
                    .Where(z => z.IsActive)
                    .OrderBy(z => z.Order)
                    .Select(z => new GameZoneResponse(z.Id, z.Name, z.Order))
                    .AsNoTracking()
                    .ToArrayAsync(cancellationToken);
        }
    }
}
