using System.Security.Claims;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Seasons.Queries
{
    public class GetSeasons : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/seasons",
                    async (IMediator mediator, string clubId, CancellationToken cancellationToken) =>
                    {
                        return await mediator.Send(new SeasonsQuery { ClubId = clubId }, cancellationToken);    
                    })
                .WithName(nameof(GetSeasons))
                .WithTags(SeasonConstants.SeasonFeature)
                .Produces<SeasonsResponse[]>();
        }

        public record SeasonsQuery : IQueryApp<SeasonsResponse[]>
        {
            public string ClubId { get; internal set; }
        }

        public record SeasonsResponse(string Id, string Name, DateTime StartDate, DateTime EndDate, bool IsActive);

        public class SeasonsRequestHandler : IRequestHandler<SeasonsQuery, SeasonsResponse[]>
        {
            private readonly AppDbContext _db;

            public SeasonsRequestHandler(AppDbContext db)
            {
                _db = db;
            }

            public async ValueTask<SeasonsResponse[]> Handle(SeasonsQuery request, CancellationToken cancellationToken = default)
            {
                return await _db.Seasons
                    .Where(s=> s.ClubId == request.ClubId)
                    .Select(td => new SeasonsResponse(td.Id, td.Name, td.StartDate, td.EndDate, td.IsActive))
                    .ToArrayAsync(cancellationToken);
            }
        }
    }
}
