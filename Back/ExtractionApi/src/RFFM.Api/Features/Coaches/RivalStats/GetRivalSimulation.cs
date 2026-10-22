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
using RFFM.Api.Domain.Entities.Federation.Results;
using RFFM.Api.Domain.Services.MatchSimulation;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.LeagueSquadStats.Services;
using RFFM.Api.Features.Federation.MatchResults.Services;
using RFFM.Api.Features.Federation.Seasons.Services;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.RivalStats
{
    /// <summary>
    /// GET /api/teams/{teamId}/rival-stats/simulation — predicción de los partidos pendientes de la liga del
    /// equipo y clasificación proyectada (design.md D6).
    /// IRequest (no IQueryApp): cambia con cada sincronización de resultados y no debe cachearse.
    /// </summary>
    public class GetRivalSimulation : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/teams/{teamId}/rival-stats/simulation",
                    async (string teamId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new RivalSimulationQuery(teamId), cancellationToken);
                        return result is null
                            ? Results.Problem(
                                title: "Calendario no disponible",
                                detail: "Todavía no se ha descargado el calendario de esta liga.",
                                statusCode: StatusCodes.Status404NotFound)
                            : Results.Ok(result);
                    })
                .WithName(nameof(GetRivalSimulation))
                .WithTags(RivalStatsConstants.Feature)
                .Produces<RivalSimulationResponse>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict)
                .RequireAuthorization();
        }

        public record RivalSimulationQuery(string TeamId) : IRequest<RivalSimulationResponse?>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string FeatureRoute => CoachFeatureRoutes.Convocations;
            public string RequiredPermission => "Read";
        }

        public record RivalSimulationResponse(int PlayedMatches, int PendingMatches, bool UsesSquadStrength, string? OwnTeamCode,
            int Iterations, List<MatchPredictionResponse> Matches, List<ProjectedStandingResponse> Standings);

        public record MatchPredictionResponse(int Round, DateOnly? Date,
            string LocalTeamCode, string LocalTeamName, string? LocalShieldUrl,
            string VisitorTeamCode, string VisitorTeamName, string? VisitorShieldUrl,
            double LocalWinProbability, double DrawProbability, double VisitorWinProbability,
            double LocalExpectedGoals, double VisitorExpectedGoals, int MostLikelyLocalGoals, int MostLikelyVisitorGoals);

        public record ProjectedStandingResponse(string TeamCode, string TeamName, string? ShieldUrl,
            int CurrentPosition, int CurrentPoints, double ExpectedPoints, int MostLikelyPosition,
            double ChampionProbability, List<double> PositionProbabilities,
            double Attack, double Defense, double SquadStrength);

        public class Handler(AppDbContext appDb, FederationDbContext db, IOptions<RffmOptions> rffmOptions)
            : IRequestHandler<RivalSimulationQuery, RivalSimulationResponse?>
        {
            public async ValueTask<RivalSimulationResponse?> Handle(RivalSimulationQuery request, CancellationToken cancellationToken)
            {
                var league = await RivalStatsLeague.ResolveAsync(appDb, request.TeamId, rffmOptions.Value, cancellationToken);

                var matches = await db.RffmMatches
                    .AsNoTracking()
                    .Join(db.RffmRounds.AsNoTracking().Where(r => r.GroupCode == league.GroupCode),
                        m => m.RffmRoundId, r => r.Id, (m, r) => new { Round = r.Number, Match = m })
                    .OrderBy(x => x.Round).ThenBy(x => x.Match.SortOrder)
                    .ToListAsync(cancellationToken);
                var calendar = matches
                    .Where(x => !string.IsNullOrWhiteSpace(x.Match.LocalTeamCode) && !string.IsNullOrWhiteSpace(x.Match.VisitorTeamCode))
                    .ToList();
                if (calendar.Count == 0) return null;

                var teams = calendar
                    .OrderByDescending(x => x.Round)
                    .SelectMany(x => new[]
                    {
                        new SimTeam(x.Match.LocalTeamCode, x.Match.LocalTeamName, NullIfEmpty(x.Match.LocalTeamImageUrl)),
                        new SimTeam(x.Match.VisitorTeamCode, x.Match.VisitorTeamName, NullIfEmpty(x.Match.VisitorTeamImageUrl))
                    })
                    .GroupBy(t => t.Code)
                    .Select(g => g.First())
                    .ToList();

                var group = await db.RffmCompetitionGroups
                    .AsNoTracking()
                    .FirstOrDefaultAsync(g => g.GroupCode == league.GroupCode, cancellationToken);
                var sanctions = RffmStandingsMapper.Sanctions(RffmStandingsMapper.Parse(group?.OfficialStandingsJson));

                var squads = await LoadSquadsAsync(league, cancellationToken);

                var input = new SimulationInput(
                    teams,
                    calendar.Select(x => new SimMatch(x.Round, x.Match.LocalTeamCode, x.Match.VisitorTeamCode,
                        ParseGoals(x.Match.LocalGoals), ParseGoals(x.Match.VisitorGoals), x.Match.MatchDate)).ToList(),
                    squads,
                    group?.Points ?? RffmPointsSystem.Default,
                    sanctions);

                var result = SeasonSimulator.Run(input);
                var teamsByCode = teams.ToDictionary(t => t.Code);

                return new RivalSimulationResponse(
                    result.PlayedMatches,
                    result.PendingMatches,
                    squads.Count > 0,
                    league.OwnTeamCode,
                    SeasonSimulator.DefaultIterations,
                    result.Predictions.Select(p => ToMatchResponse(p, teamsByCode)).ToList(),
                    result.Standings.Select(s => ToStandingResponse(s, teamsByCode[s.TeamCode])).ToList());
            }

            private async Task<IReadOnlyDictionary<string, IReadOnlyList<SimPlayer>>> LoadSquadsAsync(RivalStatsLeague league,
                CancellationToken cancellationToken)
            {
                var report = await db.LeagueSquadStatsReports
                    .AsNoTracking()
                    .Include(r => r.Teams).ThenInclude(t => t.Players)
                    .SingleOrDefaultAsync(r => r.SeasonId == league.SeasonId && r.CompetitionCode == league.CompetitionCode &&
                                               r.GroupCode == league.GroupCode, cancellationToken);
                var hasCompletedReport = report is not null && report.CompletedAt.HasValue;
                if (!hasCompletedReport) return new Dictionary<string, IReadOnlyList<SimPlayer>>();

                var previousSeasonId = RffmSeasons.Previous(rffmOptions.Value, league.SeasonId);
                var seasons = previousSeasonId.HasValue ? new[] { league.SeasonId, previousSeasonId.Value } : new[] { league.SeasonId };
                var playerCodes = report!.Teams.SelectMany(t => t.Players).Select(p => p.PlayerCode).Distinct().ToList();
                var stats = (await db.RffmPlayerSeasonStats
                        .AsNoTracking()
                        .Where(s => playerCodes.Contains(s.PlayerCode) && seasons.Contains(s.SeasonId))
                        .ToListAsync(cancellationToken))
                    .ToLookup(s => s.PlayerCode);

                return report.Teams
                    .Where(t => t.Players.Count > 0)
                    .GroupBy(t => t.TeamCode)
                    .ToDictionary(
                        g => g.Key,
                        g => (IReadOnlyList<SimPlayer>)g.SelectMany(t => t.Players)
                            .Select(p => ToSimPlayer(stats[p.PlayerCode].ToList(), league.SeasonId, previousSeasonId))
                            .ToList());
            }

            private static SimPlayer ToSimPlayer(IReadOnlyList<RffmPlayerSeasonStats> seasonStats, int currentSeasonId, int? previousSeasonId)
            {
                var current = seasonStats.FirstOrDefault(s => s.SeasonId == currentSeasonId);
                var previous = seasonStats.FirstOrDefault(s => s.SeasonId == previousSeasonId && s.HasActivity);
                var participations = previous is null
                    ? []
                    : PlayerSeasonTotalsMapper.ReadParticipations(previous.ParticipationsJson)
                        .Select(p => new SimPlayerParticipation(p.CompetitionName, p.GroupName, p.TeamPosition))
                        .ToList();

                return new SimPlayer(
                    current?.Called ?? 0, current?.Starter ?? 0, current?.Substitute ?? 0,
                    previous is not null, previous?.Called ?? 0, previous?.Starter ?? 0, previous?.Played ?? 0, previous?.Goals ?? 0,
                    participations);
            }

            private static MatchPredictionResponse ToMatchResponse(MatchPrediction p, IReadOnlyDictionary<string, SimTeam> teams)
            {
                var local = teams[p.Match.LocalCode];
                var visitor = teams[p.Match.VisitorCode];
                return new MatchPredictionResponse(p.Match.Round, p.Match.Date,
                    local.Code, local.Name, local.ShieldUrl,
                    visitor.Code, visitor.Name, visitor.ShieldUrl,
                    Probability(p.Outcome.Home), Probability(p.Outcome.Draw), Probability(p.Outcome.Away),
                    Rating(p.LocalExpectedGoals), Rating(p.VisitorExpectedGoals),
                    p.Outcome.MostLikelyLocalGoals, p.Outcome.MostLikelyVisitorGoals);
            }

            private static ProjectedStandingResponse ToStandingResponse(ProjectedStanding s, SimTeam team) => new(
                team.Code, team.Name, team.ShieldUrl,
                s.CurrentPosition, s.CurrentPoints, Rating(s.ExpectedPoints), s.MostLikelyPosition,
                Probability(s.ChampionProbability), s.PositionProbabilities.Select(Probability).ToList(),
                Rating(s.Attack), Rating(s.Defense), Rating(s.SquadStrength));

            private static double Probability(double value) => Math.Round(value, 4);

            private static double Rating(double value) => Math.Round(value, 2);

            private static int? ParseGoals(string value) => int.TryParse(value, out var goals) ? goals : null;

            private static string? NullIfEmpty(string value) => string.IsNullOrWhiteSpace(value) ? null : value;
        }
    }
}
