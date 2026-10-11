using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Federation.LeagueSquadStats;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.LeagueSquadStats.Services;
using RFFM.Api.Features.Federation.Players.Models;
using RFFM.Api.Features.Federation.Seasons.Services;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.RivalStats
{
    /// <summary>
    /// GET /api/teams/{teamId}/rival-stats/teams/{teamCode} — jugadores de un equipo de la liga con sus
    /// estadísticas de la temporada actual y de la anterior.
    /// </summary>
    public class GetRivalTeamStats : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/teams/{teamId}/rival-stats/teams/{teamCode}",
                    async (string teamId, string teamCode, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new RivalTeamStatsQuery(teamId, teamCode), cancellationToken);
                        return result is null
                            ? Results.Problem(
                                title: "Equipo no encontrado",
                                detail: "El equipo no forma parte de las estadísticas de esta liga.",
                                statusCode: StatusCodes.Status404NotFound)
                            : Results.Ok(result);
                    })
                .WithName(nameof(GetRivalTeamStats))
                .WithTags(RivalStatsConstants.Feature)
                .Produces<RivalTeamStatsResponse>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict)
                .RequireAuthorization();
        }

        public record RivalTeamStatsQuery(string TeamId, string TeamCode)
            : IRequest<RivalTeamStatsResponse?>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string FeatureRoute => CoachFeatureRoutes.Convocations;
            public string RequiredPermission => "Read";
        }

        public record RivalTeamStatsResponse(string TeamCode, string TeamName, string? ShieldUrl, List<RivalPlayerResponse> Players);

        public record RivalPlayerResponse(string PlayerCode, string PlayerName, int? BirthYear, string? Position,
            List<RivalPlayerSeasonResponse> Seasons);

        public record RivalPlayerSeasonResponse(int SeasonId, string SeasonName, SeasonStats Stats,
            IReadOnlyList<PlayerSeasonParticipation> Teams);

        public class Handler(AppDbContext appDb, FederationDbContext db, IOptions<RffmOptions> rffmOptions)
            : IRequestHandler<RivalTeamStatsQuery, RivalTeamStatsResponse?>
        {
            public async ValueTask<RivalTeamStatsResponse?> Handle(RivalTeamStatsQuery request, CancellationToken cancellationToken)
            {
                var league = await RivalStatsLeague.ResolveAsync(appDb, request.TeamId, rffmOptions.Value, cancellationToken);
                var teamCode = request.TeamCode.Trim();

                var team = await (
                        from report in db.LeagueSquadStatsReports.AsNoTracking()
                        join squadTeam in db.LeagueSquadTeams.AsNoTracking().Include(t => t.Players) on report.Id equals squadTeam.ReportId
                        where report.SeasonId == league.SeasonId && report.CompetitionCode == league.CompetitionCode &&
                              report.GroupCode == league.GroupCode && squadTeam.TeamCode == teamCode
                        select squadTeam)
                    .SingleOrDefaultAsync(cancellationToken);
                if (team is null) return null;

                var seasons = new List<int> { league.SeasonId };
                var previousSeasonId = RffmSeasons.Previous(rffmOptions.Value, league.SeasonId);
                if (previousSeasonId.HasValue) seasons.Add(previousSeasonId.Value);

                var playerCodes = team.Players.Select(p => p.PlayerCode).ToList();
                var stats = (await db.RffmPlayerSeasonStats
                        .AsNoTracking()
                        .Where(s => playerCodes.Contains(s.PlayerCode) && seasons.Contains(s.SeasonId))
                        .ToListAsync(cancellationToken))
                    .ToLookup(s => s.PlayerCode);

                var players = team.Players
                    .Select(p => ToPlayer(p, stats[p.PlayerCode].ToList(), league.SeasonId))
                    .OrderByDescending(p => p.CurrentSeasonPlayed)
                    .ThenBy(p => p.Player.PlayerName, StringComparer.CurrentCultureIgnoreCase)
                    .Select(p => p.Player)
                    .ToList();

                return new RivalTeamStatsResponse(team.TeamCode, team.TeamName, team.ShieldUrl, players);
            }

            private (RivalPlayerResponse Player, int CurrentSeasonPlayed) ToPlayer(LeagueSquadPlayer player,
                IReadOnlyList<RffmPlayerSeasonStats> seasonStats, int currentSeasonId)
            {
                var latest = seasonStats.OrderByDescending(s => s.SeasonId).FirstOrDefault();
                var seasons = seasonStats
                    .Where(s => s.HasActivity)
                    .OrderByDescending(s => s.SeasonId)
                    .Select(s => new RivalPlayerSeasonResponse(
                        s.SeasonId,
                        RffmSeasons.Label(rffmOptions.Value, s.SeasonId),
                        new SeasonStats(s.Called, s.Starter, s.Substitute, s.Played, s.Goals, s.Yellow, s.Red, s.DoubleYellow),
                        PlayerSeasonTotalsMapper.ReadParticipations(s.ParticipationsJson)))
                    .ToList();

                var name = string.IsNullOrWhiteSpace(player.PlayerName) ? latest?.PlayerName ?? string.Empty : player.PlayerName;
                var birthYear = seasonStats.Select(s => s.BirthYear).FirstOrDefault(y => y.HasValue);
                var currentSeasonPlayed = seasonStats.FirstOrDefault(s => s.SeasonId == currentSeasonId)?.Played ?? 0;

                return (new RivalPlayerResponse(player.PlayerCode, name, birthYear, latest?.Position, seasons), currentSeasonPlayed);
            }
        }
    }
}
