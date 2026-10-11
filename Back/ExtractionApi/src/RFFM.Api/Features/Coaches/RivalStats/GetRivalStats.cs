using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.RivalStats
{
    /// <summary>
    /// GET /api/teams/{teamId}/rival-stats — estado de las estadísticas de la liga del equipo y sus equipos.
    /// IRequest (no IQueryApp): el estado cambia mientras se genera y no debe cachearse.
    /// </summary>
    public class GetRivalStats : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/teams/{teamId}/rival-stats",
                    async (string teamId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new RivalStatsQuery(teamId), cancellationToken);
                        return result is null
                            ? Results.Problem(
                                title: "Estadísticas no generadas",
                                detail: "Todavía no se han generado las estadísticas de esta liga.",
                                statusCode: StatusCodes.Status404NotFound)
                            : Results.Ok(result);
                    })
                .WithName(nameof(GetRivalStats))
                .WithTags(RivalStatsConstants.Feature)
                .Produces<RivalStatsResponse>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict)
                .RequireAuthorization();
        }

        public record RivalStatsQuery(string TeamId) : IRequest<RivalStatsResponse?>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string FeatureRoute => CoachFeatureRoutes.Convocations;
            public string RequiredPermission => "Read";
        }

        public record RivalStatsResponse(string Status, int TotalPlayers, int ProcessedPlayers, int FailedPlayers,
            DateTime? CompletedAt, DateTime? NextRefreshAllowedAt, string? ErrorMessage, string? OwnTeamCode,
            List<RivalTeamSummary> Teams);

        public record RivalTeamSummary(string TeamCode, string TeamName, string? ShieldUrl, int PlayerCount, bool IsOwnTeam);

        public class Handler(AppDbContext appDb, FederationDbContext db, IOptions<RffmOptions> rffmOptions)
            : IRequestHandler<RivalStatsQuery, RivalStatsResponse?>
        {
            public async ValueTask<RivalStatsResponse?> Handle(RivalStatsQuery request, CancellationToken cancellationToken)
            {
                var league = await RivalStatsLeague.ResolveAsync(appDb, request.TeamId, rffmOptions.Value, cancellationToken);

                var report = await db.LeagueSquadStatsReports
                    .AsNoTracking()
                    .Include(r => r.Teams).ThenInclude(t => t.Players)
                    .SingleOrDefaultAsync(r => r.SeasonId == league.SeasonId && r.CompetitionCode == league.CompetitionCode &&
                                               r.GroupCode == league.GroupCode, cancellationToken);
                if (report is null) return null;

                var teams = report.Teams
                    .Select(t => new RivalTeamSummary(t.TeamCode, t.TeamName, t.ShieldUrl, t.Players.Count, t.TeamCode == league.OwnTeamCode))
                    .OrderByDescending(t => t.IsOwnTeam)
                    .ThenBy(t => t.TeamName, StringComparer.CurrentCultureIgnoreCase)
                    .ToList();

                var status = RivalStatsStatusResponse.From(report,
                    TimeSpan.FromMinutes(rffmOptions.Value.LeagueSquadStats.MinRefreshMinutes));
                return new RivalStatsResponse(status.Status, status.TotalPlayers, status.ProcessedPlayers, status.FailedPlayers,
                    status.CompletedAt, status.NextRefreshAllowedAt, status.ErrorMessage, league.OwnTeamCode, teams);
            }
        }
    }
}
