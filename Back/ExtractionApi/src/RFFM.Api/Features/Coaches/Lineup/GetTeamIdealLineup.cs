using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Lineup
{
    public class GetTeamIdealLineup : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/team/{teamId}/ideal-lineup",
                    async (string teamId, string? seasonId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new GetTeamIdealLineupQuery(teamId, seasonId), cancellationToken);
                        return result is null ? Results.NotFound() : Results.Ok(result);
                    })
                .WithName(nameof(GetTeamIdealLineup))
                .WithTags("Lineup")
                .RequireAuthorization()
                .Produces<TeamIdealLineupDto>()
                .Produces(StatusCodes.Status404NotFound);
        }

        public record GetTeamIdealLineupQuery(string TeamId, string? SeasonId) : IQueryApp<TeamIdealLineupDto?>;

        public record IdealLineupSlotDto(int SlotIndex, string? TeamPlayerId);

        public record TeamIdealLineupDto(string Id, string FormationId, IEnumerable<IdealLineupSlotDto> Slots);

        public class Handler : IRequestHandler<GetTeamIdealLineupQuery, TeamIdealLineupDto?>
        {
            private readonly AppDbContext _db;

            public Handler(AppDbContext db)
            {
                _db = db;
            }

            public async ValueTask<TeamIdealLineupDto?> Handle(GetTeamIdealLineupQuery request, CancellationToken cancellationToken = default)
            {
                var seasonId = request.SeasonId ?? string.Empty;
                var lineup = await _db.TeamIdealLineups
                    .AsNoTracking()
                    .Include(l => l.Slots)
                    .Where(l => l.TeamId == request.TeamId && l.SeasonId == seasonId)
                    .FirstOrDefaultAsync(cancellationToken);

                if (lineup is null) return null;

                return new TeamIdealLineupDto(
                    lineup.Id,
                    lineup.FormationId,
                    lineup.Slots.Select(s => new IdealLineupSlotDto(s.SlotIndex, s.TeamPlayerId))
                );
            }
        }
    }
}
