using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Formations
{
    public class GetFormations : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/formations",
                    async (IMediator mediator, CancellationToken cancellationToken) =>
                        await mediator.Send(new GetFormationsQuery(), cancellationToken))
                .WithName(nameof(GetFormations))
                .WithTags("Formations")
                .Produces<FormationDto[]>();
        }

        public record GetFormationsQuery : IQueryApp<FormationDto[]>;

        public record FormationDto(string Id, string Name, string? Description);

        public class Handler : IRequestHandler<GetFormationsQuery, FormationDto[]>
        {
            private readonly AppDbContext _db;

            public Handler(AppDbContext db)
            {
                _db = db;
            }

            public async ValueTask<FormationDto[]> Handle(GetFormationsQuery request, CancellationToken cancellationToken = default)
            {
                return await _db.Formations
                    .AsNoTracking()
                    .OrderBy(f => f.Name)
                    .Select(f => new FormationDto(f.Id, f.Name, f.Description))
                    .ToArrayAsync(cancellationToken);
            }
        }
    }
}
