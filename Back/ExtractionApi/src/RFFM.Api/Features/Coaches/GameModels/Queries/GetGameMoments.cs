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
    public class GetGameMoments : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/game-models/moments",
                    async (IMediator mediator, CancellationToken cancellationToken) =>
                        Results.Ok(await mediator.Send(new GameMomentsQuery(), cancellationToken)))
                .WithName(nameof(GetGameMoments))
                .WithTags(GameModelConstants.Tag)
                .RequireAuthorization()
                .Produces<GameMomentResponse[]>();
        }

        public record GameMomentsQuery : IQueryApp<GameMomentResponse[]>;

        public record GameMomentResponse(int Id, string Name, int Order);

        public class Handler : IRequestHandler<GameMomentsQuery, GameMomentResponse[]>
        {
            private readonly AppDbContext _db;
            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<GameMomentResponse[]> Handle(GameMomentsQuery request, CancellationToken cancellationToken = default)
                => await _db.GameMoments
                    .Where(m => m.IsActive)
                    .OrderBy(m => m.Order)
                    .Select(m => new GameMomentResponse(m.Id, m.Name, m.Order))
                    .AsNoTracking()
                    .ToArrayAsync(cancellationToken);
        }
    }
}
