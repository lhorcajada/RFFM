using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Kits
{
    public class GetTeamKits : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/teams/{teamId}/kits",
                    async (string teamId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new TeamKitsQuery { TeamId = teamId }, cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetTeamKits))
                .WithTags("Kits")
                .Produces<ClubKitResponse[]>();
        }

        public record TeamKitsQuery : IQueryApp<ClubKitResponse[]>
        {
            public string TeamId { get; init; } = null!;
        }

        public record ClubKitResponse(int KitNumber, string ShirtColor, string ShortsColor, string SocksColor);

        public class Handler : IRequestHandler<TeamKitsQuery, ClubKitResponse[]>
        {
            private readonly AppDbContext _db;
            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<ClubKitResponse[]> Handle(TeamKitsQuery request, CancellationToken cancellationToken = default)
            {
                var team = await _db.Teams
                    .AsNoTracking()
                    .FirstOrDefaultAsync(t => t.Id == request.TeamId, cancellationToken);

                if (team == null)
                    return [];

                var kits = await _db.ClubKits
                    .AsNoTracking()
                    .Where(k => k.ClubId == team.ClubId && k.SeasonId == team.SeasonId)
                    .OrderBy(k => k.KitNumber)
                    .Select(k => new ClubKitResponse(k.KitNumber, k.ShirtColor, k.ShortsColor, k.SocksColor))
                    .ToArrayAsync(cancellationToken);

                return kits;
            }
        }
    }
}
