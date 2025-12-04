using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.SportEventTypes.Queries
{
    public class GetSportEventTypes : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/sport-event-types",
                    async (IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        return await mediator.Send(new SportEventTypesQuery(), cancellationToken);
                    })
                .WithName(nameof(GetSportEventTypes))
                .WithTags(SportEventTypesConstants.SportEventTypesFeature)
                .Produces<SportEventTypeResponse[]>();
        }

        public record SportEventTypesQuery : IQueryApp<SportEventTypeResponse[]>, ICacheRequest
        {
            public string CacheKey => "SportEventTypes";
            public DateTime? AbsoluteExpirationRelativeToNow { get; }
        }

        public record SportEventTypeResponse()
        {
            public int Id { get; set; }
            public string Name { get; set; } = null!;

        };

        public class GetSportEventTypesRequestHandler : IRequestHandler<SportEventTypesQuery, SportEventTypeResponse[]>
        {
            private readonly AppDbContext _db;

            public GetSportEventTypesRequestHandler(AppDbContext db)
            {
                _db = db;
            }

            public async ValueTask<SportEventTypeResponse[]> Handle(SportEventTypesQuery request, CancellationToken cancellationToken = default)
            {
                return await _db.SportEventTypes
                    .Select(eventType => new SportEventTypeResponse
                    {
                        Id = eventType.Id,
                        Name = eventType.Name
                    })
                    .ToArrayAsync(cancellationToken);
            }
        }
    }
}
