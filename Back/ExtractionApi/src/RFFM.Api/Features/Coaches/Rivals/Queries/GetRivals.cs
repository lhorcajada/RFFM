using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Rivals.Queries
{
    public class GetRivals : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/rivals",
                    async (IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        return await mediator.Send(new RivalsQuery(), cancellationToken);
                    })
                .WithName(nameof(GetRivals))
                .WithTags("Rivals")
                .Produces<RivalResponse[]>();
        }

        public record RivalsQuery : IQueryApp<RivalResponse[]>, ICacheRequest
        {
            public string CacheKey => "Rivals";
            public DateTime? AbsoluteExpirationRelativeToNow { get; }
        }

        public record RivalResponse()
        {
            public string Id { get; set; } = null!;
            public string Name { get; set; } = null!;
            public string? UrlPhoto { get; set; }

        };

        public class GetRivalsRequestHandler : IRequestHandler<RivalsQuery, RivalResponse[]>
        {
            private readonly AppDbContext _db;

            public GetRivalsRequestHandler(AppDbContext db)
            {
                _db = db;
            }

            public async ValueTask<RivalResponse[]> Handle(RivalsQuery request, CancellationToken cancellationToken = default)
            {
                var rivals = await _db.Rivals
                    .Select(rival => new RivalResponse
                    {
                        Id = rival.Id
                            .Replace("\r", "")
                            .Replace("\n", "")
                            .Trim(),
                        Name = rival.Name,
                        UrlPhoto = rival.UrlPhoto
                    })
                    .ToArrayAsync(cancellationToken);
                return rivals;
            }
        }
    }
}
