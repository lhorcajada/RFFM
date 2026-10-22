using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RFFM.Api.Domain.Entities.Federation.LeagueSquadStats;
using RFFM.Api.Domain.Entities.Federation.Results;
using RFFM.Api.Domain.Services.MatchSimulation;
using RFFM.Api.Features.Federation.LeagueSquadStats.Services;
using RFFM.Api.Features.Federation.MatchResults.Services;
using RFFM.Api.Features.Federation.Seasons.Services;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.RivalStats.Services
{
    public record RivalSimulationData(SimulationInput Input, IReadOnlyDictionary<string, SimTeam> Teams, bool UsesSquadStrength);

    /// <summary>Carga calendario, puntos, sanciones y plantillas de la liga del equipo para el simulador.</summary>
    public class RivalSimulationInputLoader(FederationDbContext db, IOptions<RffmOptions> rffmOptions)
    {
        /// <returns>null si todavía no hay calendario de la liga.</returns>
        public async Task<RivalSimulationData?> LoadAsync(RivalStatsLeague league, CancellationToken cancellationToken)
        {
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

            return new RivalSimulationData(input, teams.ToDictionary(t => t.Code), squads.Count > 0);
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

        private static int? ParseGoals(string value) => int.TryParse(value, out var goals) ? goals : null;

        private static string? NullIfEmpty(string value) => string.IsNullOrWhiteSpace(value) ? null : value;
    }
}
