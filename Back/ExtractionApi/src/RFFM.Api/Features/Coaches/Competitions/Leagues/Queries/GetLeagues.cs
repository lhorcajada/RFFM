using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Competitions.Leagues.Queries
{
    public class GetLeagues : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/leagues/{categoryId}",
                    async (int categoryId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        return await mediator.Send(new LeaguesQueryApp(categoryId), cancellationToken);
                    })
                .WithName(nameof(GetLeagues))
                .WithTags(LeaguesConstants.LeaguesFeature)
                .Produces<LeaguesResponse[]>();
        }

        public record LeaguesQueryApp (int CategoryId) : Common.IQueryApp<LeaguesResponse[]>;

        public record LeaguesResponse(int Id, string Name);

        public class LeaguesRequestHandler : IRequestHandler<LeaguesQueryApp, LeaguesResponse[]>
        {
            private readonly AppDbContext _db;

            public LeaguesRequestHandler(AppDbContext db)
            {
                _db = db;
            }

            public async ValueTask<LeaguesResponse[]> Handle(LeaguesQueryApp request, CancellationToken cancellationToken = default)
            {
                return await _db.Leagues
                    .Where(l=> l.CategoryId == request.CategoryId)
                    .Select(c => new LeaguesResponse(c.Id, c.Name))
                    .ToArrayAsync(cancellationToken);
            }
        }
    }
}
