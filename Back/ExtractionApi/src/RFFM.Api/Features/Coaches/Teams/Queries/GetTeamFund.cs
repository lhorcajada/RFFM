using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Teams.Queries
{
    /// <summary>
    /// GET /api/catalog/team/{teamId}/fund — the team's current fund balance ("bolsa del
    /// equipo") plus its movement history (add-team-fund-and-sanction-player-photo, design.md
    /// Decisión 3). Balance = SUM(Amount) over the team's TeamFundMovement rows (0 if none).
    /// Open to every authenticated role, mirroring the existing sanctions GETs in
    /// SetPlayerSanction.cs.
    /// </summary>
    public class GetTeamFund : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/team/{teamId}/fund",
                    async (string teamId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new TeamFundQuery(teamId), cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetTeamFund))
                .WithTags(TeamConstants.TeamFeature)
                .Produces<TeamFundResponse>()
                .RequireAuthorization();
        }

        public record TeamFundQuery(string TeamId) : IQueryApp<TeamFundResponse>;

        public record TeamFundResponse(string TeamId, decimal Balance, TeamFundMovementResponse[] Movements);

        public record TeamFundMovementResponse(
            string Id, decimal Amount, string Source, string? SourceSanctionId,
            DateTime OccurredAt, string? Description);

        public class Handler : IRequestHandler<TeamFundQuery, TeamFundResponse>
        {
            private readonly AppDbContext _db;

            public Handler(AppDbContext db)
            {
                _db = db;
            }

            public async ValueTask<TeamFundResponse> Handle(TeamFundQuery request, CancellationToken cancellationToken = default)
            {
                var movements = await _db.TeamFundMovements
                    .AsNoTracking()
                    .Where(m => m.TeamId == request.TeamId)
                    .OrderByDescending(m => m.OccurredAt)
                    .ToListAsync(cancellationToken);

                var balance = movements.Sum(m => m.Amount);

                var movementResponses = movements
                    .Select(m => new TeamFundMovementResponse(
                        m.Id, m.Amount, m.Source.Name, m.SourceSanctionId, m.OccurredAt, m.Description))
                    .ToArray();

                return new TeamFundResponse(request.TeamId, balance, movementResponses);
            }
        }
    }
}
