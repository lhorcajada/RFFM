using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Auth;
using RFFM.Api.Features.Coaches.Clubs;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Competitions.Categories.Queries
{
    public class GetCategories : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/categories",
                    async (IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        return await mediator.Send(new CategoriesQueryApp(), cancellationToken);
                    })
                .WithName(nameof(GetCategories))
                .WithTags(CategoriesConstants.CategoriesFeature)
                .Produces<CategoriesResponse[]>();
        }

        public record CategoriesQueryApp : Common.IQueryApp<CategoriesResponse[]>;

        public record CategoriesResponse(int Id, string Name);

        public class CategoriesRequestHandler : IRequestHandler<CategoriesQueryApp, CategoriesResponse[]>
        {
            private readonly AppDbContext _db;

            public CategoriesRequestHandler(AppDbContext db)
            {
                _db = db;
            }

            public async ValueTask<CategoriesResponse[]> Handle(CategoriesQueryApp request, CancellationToken cancellationToken = default)
            {
                return await _db.Categories
                    .Select(c => new CategoriesResponse(c.Id, c.Name))
                    .ToArrayAsync(cancellationToken);
            }
        }
    }
}